import { SyncAction, SyncActionType } from './syncService';

const STORAGE_KEY = 'medisync_offline_actions';
const MAX_RETRY = 3;
const SYNC_INTERVAL = 5000;

let isOnline = true;
let syncInProgress = false;
let listeners: Array<() => void> = [];

function getStoredActions(): SyncAction[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveActions(actions: SyncAction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch (e) {
    console.error('Failed to save offline actions:', e);
  }
}

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export const syncService = {
  init() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        isOnline = true;
        notifyListeners();
        this.syncAll();
      });
      window.addEventListener('offline', () => {
        isOnline = false;
        notifyListeners();
      });
      // Start periodic sync
      setInterval(() => {
        if (isOnline && !syncInProgress) this.syncAll();
      }, SYNC_INTERVAL);
    }
  },

  isOnline(): boolean {
    return isOnline;
  },

  getPendingCount(): number {
    return getStoredActions().filter(a => a.status === 'pending' || a.status === 'error').length;
  },

  getActions(): SyncAction[] {
    return getStoredActions();
  },

  subscribe(fn: () => void): () => void {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  },

  async enqueue(action: Omit<SyncAction, 'id' | 'retryCount' | 'status'>): Promise<void> {
    const actions = getStoredActions();
    const newAction: SyncAction = {
      ...action,
      id: `action-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      retryCount: 0,
      status: 'pending',
    };
    actions.push(newAction);
    saveActions(actions);
    notifyListeners();

    // Try immediate sync if online
    if (isOnline) {
      setTimeout(() => this.syncAll(), 100);
    }
  },

  async syncAll(): Promise<void> {
    if (syncInProgress || !isOnline) return;

    const actions = getStoredActions().filter(
      a => a.status === 'pending' || (a.status === 'error' && a.retryCount < MAX_RETRY)
    );

    if (actions.length === 0) return;

    syncInProgress = true;
    notifyListeners();

    // Mark as syncing
    const allActions = getStoredActions();
    const syncingActions = allActions.map(a =>
      actions.some(sa => sa.id === a.id) ? { ...a, status: 'syncing' as const } : a
    );
    saveActions(syncingActions);
    notifyListeners();

    for (const action of actions) {
      try {
        await this.processAction(action);
        // Mark synced
        const updated = getStoredActions().map(a =>
          a.id === action.id ? { ...a, status: 'synced' as const } : a
        );
        saveActions(updated);
      } catch (error: any) {
        // Mark error, increment retry
        const updated = getStoredActions().map(a =>
          a.id === action.id
            ? { ...a, status: 'error' as const, retryCount: a.retryCount + 1, error: error.message }
            : a
        );
        saveActions(updated);
      }
    }

    // Clean up old synced actions (keep last 50)
    const remaining = getStoredActions()
      .filter(a => a.status !== 'synced')
      .concat(
        getStoredActions()
          .filter(a => a.status === 'synced')
          .slice(-50)
      );
    saveActions(remaining);
    syncInProgress = false;
    notifyListeners();
  },

  async processAction(action: SyncAction): Promise<void> {
    // Simulate API call - in real app, call actual endpoints
    const { type, payload } = action;

    // For demo, simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    switch (type) {
      case 'CREATE_DIAGNOSTIC_ORDER':
      case 'CREATE_REFERRAL':
      case 'CREATE_ASHA_VISIT':
      case 'UPDATE_INVENTORY':
      case 'DISPENSE_MEDICINE':
      case 'CREATE_INVENTORY_ORDER':
      case 'ADD_DIAGNOSTIC_RESULT':
      case 'UPDATE_DIAGNOSTIC_STATUS':
        // In real implementation, call actual API
        // For now, just succeed
        console.log(`Synced ${type}:`, payload);
        break;
      default:
        console.warn('Unknown action type:', type);
    }
  },

  seedDemoActions() {
    const actions = getStoredActions();
    if (actions.length > 0) return; // Only seed once

    const demoActions: SyncAction[] = [
      {
        id: 'demo-1',
        type: 'CREATE_REFERRAL',
        payload: {
          patientId: 'patient-3',
          fromFacilityId: 'f1',
          toFacilityId: 'f2',
          severity: 'YELLOW',
          reason: 'High fever, needs specialist',
        },
        timestamp: Date.now() - 3600000,
        retryCount: 0,
        status: 'pending',
      },
      {
        id: 'demo-2',
        type: 'CREATE_DIAGNOSTIC_ORDER',
        payload: {
          patientId: 'patient-5',
          facilityId: 'f2',
          tests: ['blood_sugar', 'cbc'],
          priority: 'ROUTINE',
          orderedBy: 'ASHA-Worker-3',
        },
        timestamp: Date.now() - 1800000,
        retryCount: 0,
        status: 'pending',
      },
      {
        id: 'demo-3',
        type: 'CREATE_ASHA_VISIT',
        payload: {
          patientId: 'patient-8',
          ashaId: 'ASHA-Worker-1',
          trimester: 2,
          checklist: { bp: '120/80', weight: '62', hb: '11.5', fundalHeight: '22' },
        },
        timestamp: Date.now() - 600000,
        retryCount: 0,
        status: 'pending',
      },
      {
        id: 'demo-4',
        type: 'DISPENSE_MEDICINE',
        payload: {
          medicineId: 'paracetamol',
          facilityId: 'f1',
          quantity: 10,
          patientId: 'patient-2',
        },
        timestamp: Date.now() - 300000,
        retryCount: 0,
        status: 'pending',
      },
      {
        id: 'demo-5',
        type: 'UPDATE_INVENTORY',
        payload: {
          medicineId: 'ors',
          facilityId: 'f5',
          newStock: 15,
        },
        timestamp: Date.now() - 60000,
        retryCount: 0,
        status: 'pending',
      },
    ];

    saveActions(demoActions);
    notifyListeners();
  },

  // For demo mode - clear all
  clearAll() {
    saveActions([]);
    notifyListeners();
  },
};

// Auto-initialize
if (typeof window !== 'undefined') {
  syncService.init();
}