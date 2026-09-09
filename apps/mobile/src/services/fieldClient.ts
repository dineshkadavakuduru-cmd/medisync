export const inventoryOrderStatuses = ['PO', 'APPROVED', 'ORDERED', 'RECEIVED', 'VERIFIED', 'STOCKED'] as const;
export type InventoryOrderStatus = typeof inventoryOrderStatuses[number];
export interface FieldMedicine {
  id: string; name: string; category: string; unit: string; currentStock: number; minThreshold: number; maxCapacity: number;
}
export interface FieldOrder {
  id: string; facilityId: string; medicineId: string; quantity: number; status: InventoryOrderStatus;
  history: { status: InventoryOrderStatus; timestamp: string; staffId: string }[];
}
export interface FieldInventory {
  stocks: FieldMedicine[];
  log: { id: string; medicineId: string; kind: string; quantity: number; before: number; after: number; timestamp: string; staffId: string }[];
  orders: FieldOrder[];
  usage: { medicineId: string; total7: number; total30: number; dailyAverage7: number; dailyAverage30: number }[];
  mode: 'manual' | 'demo';
}
export interface FieldVisit {
  id: string; patientId: string; timestamp: string; nextVisitDate?: string; highRisk: boolean;
  highRiskFlags: string[]; reviewed: boolean;
}
export interface FieldVisits { visits: FieldVisit[]; patientProjection: 'pending' | 'updated' }

export function createFieldClient(origin: string, send: typeof fetch = fetch) {
  const read = async (path: string) => {
    if (isDemoActive()) throw new Error('Demo mode is local only. Field workflow simulation is unsupported; no server request was sent.');
    if (!origin.trim()) throw new Error('Backend not configured');
    const url = new URL(origin.trim());
    if (!['http:', 'https:'].includes(url.protocol) || !['/', '/api', '/api/'].includes(url.pathname) ||
      url.search || url.hash || url.username || url.password) throw new Error('Invalid backend origin');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await send(`${url.origin}/api/field-workflows/${path}`, { signal: controller.signal });
      const body = await response.json();
      if (isDemoActive()) throw new Error('Demo mode is local only. Live field workflow response discarded.');
      if (!response.ok || body?.success !== true || !body.data || typeof body.data !== 'object') throw new Error('Field workflow data unavailable');
      return body.data;
    } finally { clearTimeout(timer); }
  };
  return {
    async inventory(facilityId: string): Promise<FieldInventory> {
      const data = await read(`inventory?facilityId=${encodeURIComponent(facilityId)}`);
      const integer = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
      if (!Array.isArray(data.stocks) || !Array.isArray(data.log) || !Array.isArray(data.orders) || !Array.isArray(data.usage) ||
          !['manual', 'demo'].includes(data.mode) || data.stocks.some((m: FieldMedicine) => !m || !m.id || !m.name ||
            typeof m.category !== 'string' || typeof m.unit !== 'string' || !integer(m.currentStock) ||
            !integer(m.minThreshold) || !integer(m.maxCapacity) || m.currentStock > m.maxCapacity) ||
          data.log.some((l: FieldInventory['log'][number]) => !l || !l.id || !l.medicineId || !integer(l.quantity) ||
            !integer(l.before) || !integer(l.after) || !Number.isFinite(Date.parse(l.timestamp))) ||
          data.orders.some((o: FieldOrder) => !o || !o.id || !o.medicineId || o.facilityId !== facilityId || !integer(o.quantity) ||
            !inventoryOrderStatuses.includes(o.status) || !Array.isArray(o.history) || o.history.some(h => !h ||
              !inventoryOrderStatuses.includes(h.status) || !Number.isFinite(Date.parse(h.timestamp)) || typeof h.staffId !== 'string')) ||
          data.usage.some((u: FieldInventory['usage'][number]) => !u || !u.medicineId ||
            [u.total7, u.total30, u.dailyAverage7, u.dailyAverage30].some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0))) {
        throw new Error('Invalid inventory response');
      }
      return data;
    },
    async visits(patientId: string): Promise<FieldVisits> {
      const data = await read(`visits?patientId=${encodeURIComponent(patientId)}`);
      if (!Array.isArray(data.visits) || !['pending', 'updated'].includes(data.patientProjection) ||
          data.visits.some((v: FieldVisit) => !v || !v.id || v.patientId !== patientId || !Number.isFinite(Date.parse(v.timestamp)) ||
            typeof v.highRisk !== 'boolean' || !Array.isArray(v.highRiskFlags) || v.reviewed !== true)) throw new Error('Invalid visit response');
      return data;
    },
  };
}
export const fieldClient = createFieldClient(process.env.EXPO_PUBLIC_API_URL || '');
import { isDemoActive } from './demoMode';
