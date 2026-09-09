import { fileURLToPath, URL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { FileStore } from '../database/fileStore.js';
import { ApiError } from '../validation.js';
import type { AshaVisit } from './fieldWorkflows.js';

export type MedicineStatus = 'ADEQUATE' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK';
export type MedicineCategory =
  | 'essential'
  | 'antibiotic'
  | 'analgesic'
  | 'antimalaria'
  | 'vitamin'
  | 'ors'
  | 'vaccine'
  | 'other';

export interface MedicineItem {
  id: string;
  facilityId: string;
  name: string;
  category: MedicineCategory;
  currentStock: number;
  minThreshold: number;
  maxCapacity: number;
  unit: string;
  expiryDate?: string;
  lastRestocked: string;
  status: MedicineStatus;
}

const ESSENTIAL_MEDICINES = [
  { name: 'Paracetamol 500mg', category: 'analgesic' as MedicineCategory, unit: 'tablets', minThreshold: 100, maxCapacity: 2000 },
  { name: 'Amoxicillin 250mg', category: 'antibiotic' as MedicineCategory, unit: 'tablets', minThreshold: 50, maxCapacity: 500 },
  { name: 'ORS Sachets', category: 'ors' as MedicineCategory, unit: 'sachets', minThreshold: 200, maxCapacity: 1000 },
  { name: 'Chloroquine Phosphate', category: 'antimalaria' as MedicineCategory, unit: 'tablets', minThreshold: 50, maxCapacity: 300 },
  { name: 'Iron + Folic Acid', category: 'vitamin' as MedicineCategory, unit: 'tablets', minThreshold: 100, maxCapacity: 1000 },
  { name: 'Metformin 500mg', category: 'essential' as MedicineCategory, unit: 'tablets', minThreshold: 50, maxCapacity: 500 },
  { name: 'Amlodipine 5mg', category: 'essential' as MedicineCategory, unit: 'tablets', minThreshold: 30, maxCapacity: 300 },
  { name: 'Tetanus Toxoid Vaccine', category: 'vaccine' as MedicineCategory, unit: 'vials', minThreshold: 10, maxCapacity: 50 },
  { name: 'Povidone Iodine', category: 'other' as MedicineCategory, unit: 'bottles', minThreshold: 5, maxCapacity: 30 },
  { name: 'Diclofenac Sodium', category: 'analgesic' as MedicineCategory, unit: 'tablets', minThreshold: 50, maxCapacity: 500 },
  { name: 'Azithromycin 500mg', category: 'antibiotic' as MedicineCategory, unit: 'tablets', minThreshold: 30, maxCapacity: 200 },
  { name: 'Salbutamol Inhaler', category: 'essential' as MedicineCategory, unit: 'units', minThreshold: 5, maxCapacity: 20 },
  { name: 'Insulin (Regular)', category: 'essential' as MedicineCategory, unit: 'vials', minThreshold: 5, maxCapacity: 30 },
  { name: 'IV Normal Saline 500ml', category: 'essential' as MedicineCategory, unit: 'bottles', minThreshold: 20, maxCapacity: 100 },
  { name: 'Oral Contraceptive Pills', category: 'essential' as MedicineCategory, unit: 'strips', minThreshold: 50, maxCapacity: 300 },
];

export function computeStatus(currentStock: number, minThreshold: number): MedicineStatus {
  if (currentStock === 0) return 'OUT_OF_STOCK';
  if (currentStock <= minThreshold * 0.5) return 'CRITICAL';
  if (currentStock <= minThreshold) return 'LOW';
  return 'ADEQUATE';
}

function generateId(): string {
  return `med-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function generateFacilityInventory(facilityId: string, facilityType: string): MedicineItem[] {
  // Existing startup callers must not silently create synthetic stock in the live store.
  if (process.env.FIELD_WORKFLOWS_DEMO !== 'true') return [];
  const type = facilityType.toUpperCase();
  let medicines = ESSENTIAL_MEDICINES;

  if (type === 'SUB_CENTRE') {
    medicines = medicines.filter((m) => m.category === 'analgesic' || m.category === 'ors' || m.category === 'vitamin' || m.category === 'antibiotic');
  } else if (type === 'PHC') {
    medicines = medicines.filter((m) => m.category !== 'vaccine');
  }

  const now = new Date().toISOString();
  return medicines.map((m) => {
    const stock = Math.floor(Math.random() * m.maxCapacity * 0.8);
    const status = computeStatus(stock, m.minThreshold);
    const expiryDate = new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      id: generateId(),
      facilityId,
      name: m.name,
      category: m.category,
      currentStock: stock,
      minThreshold: m.minThreshold,
      maxCapacity: m.maxCapacity,
      unit: m.unit,
      expiryDate,
      lastRestocked: now,
      status,
    };
  });
}

export const orderStatuses = ['PO', 'APPROVED', 'ORDERED', 'RECEIVED', 'VERIFIED', 'STOCKED'] as const;
export type OrderStatus = typeof orderStatuses[number];
export interface InventoryOrder {
  id: string; facilityId: string; medicineId: string; quantity: number; status: OrderStatus;
  history: { status: OrderStatus; timestamp: string; staffId: string }[];
}
export interface InventoryLog {
  id: string; medicineId: string; kind: 'seed' | 'physical_count' | 'dispense' | 'stock_order';
  quantity: number; before: number; after: number; timestamp: string; recordedAt: string; staffId: string;
  orderId?: string;
}
export interface FieldRecord {
  id: string; stocks: MedicineItem[]; log: InventoryLog[]; orders: InventoryOrder[]; visits: AshaVisit[];
  receipt?: { id: string; type: string; entityId: string };
}
export const emptyFieldRecord = (id: string): FieldRecord => ({ id, stocks: [], log: [], orders: [], visits: [] });
export const fieldStore = new FileStore<FieldRecord>(process.env.FIELD_WORKFLOWS_STORE_PATH ||
  fileURLToPath(new URL(`../../data/field-workflows${process.env.FIELD_WORKFLOWS_DEMO === 'true' ? '-demo' : ''}.json`, import.meta.url)));

export function getInventory(facilityId: string): MedicineItem[] {
  return fieldStore.get(`inventory:${facilityId}`)?.stocks || [];
}

// Explicit manual initial catalogue import. Never replace existing counts or history on restart.
export function setInventory(facilityId: string, items: MedicineItem[], store = fieldStore) {
  if (!items.length) return;
  if (store.get(`inventory:${facilityId}`)) return;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(facilityId) || new Set(items.map(item => item.id)).size !== items.length ||
      items.some(item => item.facilityId !== facilityId || !/^[A-Za-z0-9_-]{1,100}$/.test(item.id) || !item.name ||
        !Number.isSafeInteger(item.currentStock) || item.currentStock < 0 ||
        !Number.isSafeInteger(item.maxCapacity) || item.maxCapacity < item.currentStock ||
        !Number.isSafeInteger(item.minThreshold) || item.minThreshold < 0 || item.minThreshold > item.maxCapacity)) {
    throw new ApiError(400, 'Invalid inventory catalogue');
  }
  const now = new Date().toISOString();
  const record = emptyFieldRecord(`inventory:${facilityId}`);
  record.stocks = items.map(item => ({ ...item, status: computeStatus(item.currentStock, item.minThreshold) }));
  record.log = items.map(item => ({ id: randomUUID(), medicineId: item.id, kind: 'seed', quantity: item.currentStock,
    before: 0, after: item.currentStock, timestamp: now, recordedAt: now, staffId: 'manual-seed' }));
  store.save(record);
}

export function updateStock(facilityId: string, medicineId: string, newStock: number): MedicineItem | null {
  if (process.env.ENABLE_SIMULATOR === 'true' && process.env.FIELD_WORKFLOWS_DEMO !== 'true') {
    return null;
  }
  const record = fieldStore.get(`inventory:${facilityId}`);
  if (!record) return null;
  const item = record.stocks.find((i) => i.id === medicineId);
  if (!item) return null;
  if (!Number.isSafeInteger(newStock) || newStock < 0 || newStock > item.maxCapacity) throw new ApiError(400, 'Stock must be an integer within capacity');
  const before = item.currentStock;
  item.currentStock = newStock;
  item.status = computeStatus(item.currentStock, item.minThreshold);
  const now = new Date().toISOString();
  if (newStock > before) item.lastRestocked = now;
  record.log.push({ id: randomUUID(), medicineId, kind: 'physical_count', quantity: newStock, before,
    after: newStock, timestamp: now, recordedAt: now, staffId: 'legacy-inventory-api' });
  fieldStore.save(record);
  return item;
}

export function calculateFacilityMedicineAvailability(facilityId: string): number {
  const items = getInventory(facilityId);
  if (!items || items.length === 0) return 0;
  const adequate = items.filter((i) => i.status === 'ADEQUATE').length;
  return Math.round((adequate / items.length) * 100);
}
