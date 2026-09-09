import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { isDemoActive, onDemoModeChange } from './demoMode';

export type SyncActionType = 'CREATE_DIAGNOSTIC_ORDER' | 'ADD_DIAGNOSTIC_RESULT' | 'UPDATE_DIAGNOSTIC_STATUS'
  | 'CREATE_REFERRAL' | 'CREATE_ASHA_VISIT' | 'UPDATE_INVENTORY' | 'DISPENSE_MEDICINE' | 'CREATE_INVENTORY_ORDER' | 'UPDATE_INVENTORY_ORDER' | 'CREATE_PATIENT';
export interface SyncAction {
  id: string;
  type: SyncActionType;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  error?: string;
  response?: unknown;
  demo?: boolean;
  discarded?: boolean;
  rejectionStatus?: number;
}
type Store = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
const key = 'medisync_offline_actions';
const verifiedKey = 'medisync_outbox_verified_v2';
const types: SyncActionType[] = ['CREATE_DIAGNOSTIC_ORDER', 'ADD_DIAGNOSTIC_RESULT', 'UPDATE_DIAGNOSTIC_STATUS',
  'CREATE_REFERRAL', 'CREATE_ASHA_VISIT', 'UPDATE_INVENTORY', 'DISPENSE_MEDICINE', 'CREATE_INVENTORY_ORDER', 'UPDATE_INVENTORY_ORDER', 'CREATE_PATIENT'];

// A persisted local outbox, not WatermelonDB synchronization. Never replay legacy
// "synced" actions automatically: previous versions did not contact a server.
export function createSyncService(store: Store, origin: string, send: typeof fetch = fetch, demoMode: () => boolean = () => false) {
  let actions: SyncAction[] = [];
  let initialized: Promise<void> | undefined;
  let serial: Promise<unknown> = Promise.resolve();
  let syncing = false;
  let online = true;
  let error = '';
  let networkStarted = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  const exclusive = <T,>(fn: () => Promise<T>): Promise<T> => {
    const next = serial.then(fn);
    serial = next.catch(() => undefined);
    return next;
  };
  const persist = async (next: SyncAction[]) => {
    try {
      await store.setItem(key, JSON.stringify(next));
      actions = next;
      notify();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Local storage failed';
      notify();
      throw e;
    }
  };
  const load = () => {
    if (!initialized) initialized = exclusive(async () => {
      const raw = await store.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed) || parsed.some(a => !a || typeof a.id !== 'string' ||
        !types.includes(a.type) || !a.payload || typeof a.payload !== 'object' ||
        !['pending', 'syncing', 'synced', 'error'].includes(a.status))) {
        throw new Error('Invalid saved outbox. Data was retained; contact support.');
      }
      const verified = await store.getItem(verifiedKey);
      const recovered = (parsed as SyncAction[]).map(a => {
        if (!verified) return { ...a, demo: true, status: 'error' as const,
          error: 'Legacy action: server delivery unverified. Review manually before recreating.' };
        return a.status === 'syncing' ? { ...a, status: 'pending' as const } : a;
      });
      await persist(recovered);
      await store.setItem(verifiedKey, 'true');
    }).catch(e => {
      initialized = undefined;
      error = e instanceof Error ? e.message : 'Cannot load local outbox';
      notify();
      throw e;
    });
    return initialized;
  };
  const processAction = async (action: SyncAction) => {
    if (action.demo) throw new Error('Demo/legacy action is local only and cannot be sent.');
    if (demoMode()) throw new Error('Demo mode is active. Server actions remain paused.');
    if (!origin.trim()) throw new Error('Backend not configured. Action remains saved on this device.');
    const url = new URL(origin.trim());
    if (!['https:', 'http:'].includes(url.protocol) || !['/', '/api', '/api/'].includes(url.pathname) || url.search || url.hash || url.username || url.password) {
      throw new Error('Invalid backend origin');
    }
    let endpoint: string;
    let method = 'POST';
    let payload = action.payload;
    // Only replay operations with server-side durable idempotency. Other workflows
    // remain visible, saved locally, until their backend contract is implemented.
    if (action.type === 'CREATE_DIAGNOSTIC_ORDER') endpoint = '/diagnostics/orders';
    else if (action.type === 'CREATE_REFERRAL') endpoint = '/referrals';
    else if (action.type === 'CREATE_PATIENT') endpoint = '/patients';
    else if (['CREATE_ASHA_VISIT', 'UPDATE_INVENTORY', 'DISPENSE_MEDICINE', 'CREATE_INVENTORY_ORDER', 'UPDATE_INVENTORY_ORDER'].includes(action.type)) {
      endpoint = '/field-workflows/actions';
      payload = { id: action.id, type: action.type, payload: action.payload };
    }
    else if (action.type === 'ADD_DIAGNOSTIC_RESULT' || action.type === 'UPDATE_DIAGNOSTIC_STATUS') {
      const { orderId, ...body } = action.payload;
      if (typeof orderId !== 'string' || !orderId) throw new Error('Order ID required');
      endpoint = `/diagnostics/orders/${encodeURIComponent(orderId)}/${action.type === 'ADD_DIAGNOSTIC_RESULT' ? 'result' : 'status'}`;
      method = 'PATCH';
      payload = body;
    }
    else throw new Error('This operation is saved locally; replay-safe backend support is not configured.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await send(`${url.origin}/api${endpoint}`, {
        method, signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': action.id },
        body: JSON.stringify(payload),
      });
      const body = await result.json();
      const data = body?.data;
      const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
      const submitted = action.payload;
      const matchesText = (value: unknown, expected: unknown) => nonempty(value) && nonempty(expected) && value === expected.trim();
      let acknowledged = !!data && typeof data === 'object' && !Array.isArray(data) && nonempty(data.id);
      if (acknowledged) {
        switch (action.type) {
          case 'CREATE_ASHA_VISIT':
          case 'UPDATE_INVENTORY':
          case 'DISPENSE_MEDICINE':
          case 'CREATE_INVENTORY_ORDER':
          case 'UPDATE_INVENTORY_ORDER':
            acknowledged = data.id === action.id && data.type === action.type && nonempty(data.entityId) &&
              data.entityId === (action.type === 'UPDATE_INVENTORY_ORDER' ? submitted.orderId : action.id) &&
              (action.type !== 'CREATE_ASHA_VISIT' || ['pending', 'updated'].includes(data.patientProjection));
            // Synced means a durable receipt, not a completed patient projection.
            // Retain patientProjection unchanged so callers can show pending work.
            break;
          case 'CREATE_DIAGNOSTIC_ORDER':
            acknowledged = matchesText(data.patientId, submitted.patientId) && matchesText(data.facilityId, submitted.facilityId) &&
              Array.isArray(submitted.tests) && submitted.tests.length > 0 && Array.isArray(data.tests) &&
              data.tests.length === submitted.tests.length &&
              submitted.tests.every((code, index) => matchesText(data.tests[index], code));
            break;
          case 'ADD_DIAGNOSTIC_RESULT':
            acknowledged = data.id === submitted.orderId && Array.isArray(data.results) &&
              data.results.some((entry: Record<string, unknown> | null) => entry && nonempty(entry.id) &&
                matchesText(entry.testCode, submitted.testCode) && matchesText(entry.value, submitted.value) &&
                typeof submitted.unit === 'string' && entry.unit === submitted.unit.trim() &&
                ['NORMAL', 'ABNORMAL', 'CRITICAL'].includes(String(submitted.flag)) && entry.flag === submitted.flag &&
                (submitted.referenceRange === undefined || matchesText(entry.referenceRange, submitted.referenceRange)));
            break;
          case 'UPDATE_DIAGNOSTIC_STATUS':
            // Idempotent replay returns the original acknowledged snapshot, not current state.
            acknowledged = data.id === submitted.orderId && data.status === submitted.status &&
              ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(data.status);
            break;
          case 'CREATE_PATIENT':
            acknowledged = ['name', 'phone', 'village', 'district', 'languagePreference', 'gender']
              .every(field => matchesText(data[field], submitted[field])) &&
              typeof submitted.age === 'number' && data.age === submitted.age &&
              data.abhaId === (submitted.abhaId ?? '') &&
              ['trimester', 'nextVisitDate', 'lastVisit'].every(field => submitted[field] === undefined || data[field] === submitted[field]);
            break;
          case 'CREATE_REFERRAL':
            acknowledged = matchesText(data.patientId, submitted.patientId);
            break;
          default:
            acknowledged = false;
        }
      }
      if (!result.ok || body?.success !== true || !acknowledged) {
        throw Object.assign(new Error(result.status === 409 ? 'Server conflict. Local action retained for review; not synced.'
          : typeof body?.error === 'string' ? body.error : `Server did not acknowledge action (${result.status})`), { rejectionStatus: result.status });
      }
      return data;
    } finally { clearTimeout(timer); }
  };
  const service = {
    async init() {
      await load();
      if (!networkStarted) {
        NetInfo.addEventListener(state => {
          online = state.isConnected !== false && state.isInternetReachable !== false;
          notify();
          if (online) void service.syncAll().catch(() => undefined);
        });
        networkStarted = true;
      }
    },
    isOnline: () => online,
    isSyncing: () => syncing,
    lastError: () => error,
    getPendingCount: () => actions.filter(a => a.status !== 'synced' && !a.discarded).length,
    getActions: () => JSON.parse(JSON.stringify(actions)) as SyncAction[],
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async enqueue(input: Omit<SyncAction, 'id' | 'status' | 'retryCount'>) {
      await load();
      await exclusive(async () => {
        if (!types.includes(input.type) || !input.payload || !Number.isFinite(input.timestamp)) throw new Error('Invalid queued action');
        const action: SyncAction = { ...JSON.parse(JSON.stringify(input)),
          id: `action-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
          status: 'pending', retryCount: 0, demo: input.demo || demoMode() };
        await persist([...actions, action]);
      });
      if (online) void service.syncAll().catch(() => undefined);
    },
    async syncAll() {
      await load();
      if (syncing || !online) return;
      syncing = true;
      error = '';
      notify();
      let finished = false;
      try {
        const ids = actions.filter(a => a.status !== 'synced' && !a.discarded).map(a => a.id);
        for (const id of ids) {
          if (!online) break;
          const action = actions.find(a => a.id === id)!;
          await exclusive(() => persist(actions.map(a => a.id === id ? { ...a, status: 'syncing' } : a)));
          let response: unknown;
          try {
            response = await processAction(action);
          } catch (e) {
            error = e instanceof Error ? e.message : 'Sync failed';
            const rejectionStatus = e instanceof Error && 'rejectionStatus' in e && typeof e.rejectionStatus === 'number' ? e.rejectionStatus : undefined;
            await exclusive(() => persist(actions.map(a => a.id === id ? { ...a, status: 'error', retryCount: a.retryCount + 1, error, rejectionStatus } : a)));
            continue;
          }
          await exclusive(() => persist(actions.map(a => a.id === id ? { ...a, response, status: 'synced', error: undefined } : a)));
        }
        finished = true;
      } finally {
        syncing = false; notify();
        if (finished && online && actions.some(a => a.status === 'pending' && !a.discarded)) {
          setTimeout(() => { void service.syncAll().catch(() => undefined); }, 0);
        }
      }
    },
    async discardRejected(id: string) {
      await load();
      await exclusive(async () => {
        const action = actions.find(a => a.id === id);
        if (!action || action.status !== 'error' || ![400, 422].includes(action.rejectionStatus || 0)) {
          throw new Error('Only definitively rejected actions can be discarded.');
        }
        await persist(actions.map(a => a.id === id ? { ...a, discarded: true } : a));
      });
    },
    async seedDemoActions() {
      await load();
      if (actions.some(a => a.demo)) return;
      for (let i = 0; i < 5; i++) await service.enqueue({ type: 'CREATE_REFERRAL', payload: { label: `Synthetic action ${i + 1}` }, timestamp: Date.now(), demo: true });
    },
  };
  return service;
}

export const syncService = createSyncService(AsyncStorage, process.env.EXPO_PUBLIC_API_URL || '', fetch, isDemoActive);
onDemoModeChange(() => { if (!isDemoActive()) void syncService.syncAll().catch(() => undefined); });
