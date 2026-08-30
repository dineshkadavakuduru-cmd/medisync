import { broadcast } from '../websocket/realtime.js';

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

function computeStatus(currentStock: number, minThreshold: number): MedicineStatus {
  if (currentStock === 0) return 'OUT_OF_STOCK';
  if (currentStock <= minThreshold * 0.5) return 'CRITICAL';
  if (currentStock <= minThreshold) return 'LOW';
  return 'ADEQUATE';
}

function generateId(): string {
  return `med-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function generateFacilityInventory(facilityId: string, facilityType: string): MedicineItem[] {
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

const inventoryStore: Map<string, MedicineItem[]> = new Map();

export function getInventory(facilityId: string): MedicineItem[] {
  return inventoryStore.get(facilityId) || [];
}

export function setInventory(facilityId: string, items: MedicineItem[]) {
  inventoryStore.set(facilityId, items);
}

export function updateStock(facilityId: string, medicineId: string, newStock: number): MedicineItem | null {
  const items = inventoryStore.get(facilityId);
  if (!items) return null;
  const item = items.find((i) => i.id === medicineId);
  if (!item) return null;

  const prevStatus = item.status;
  item.currentStock = Math.max(0, Math.min(newStock, item.maxCapacity));
  item.status = computeStatus(item.currentStock, item.minThreshold);
  item.lastRestocked = new Date().toISOString();

  if (item.status === 'CRITICAL' || item.status === 'OUT_OF_STOCK') {
    broadcast({
      type: 'MEDICINE_UPDATE',
      facilityId,
      data: { medicineId: item.id, name: item.name, status: item.status, currentStock: item.currentStock, minThreshold: item.minThreshold },
      timestamp: new Date().toISOString(),
    });
  }

  return item;
}

export function calculateFacilityMedicineAvailability(facilityId: string): number {
  const items = inventoryStore.get(facilityId);
  if (!items || items.length === 0) return 0;
  const adequate = items.filter((i) => i.status === 'ADEQUATE').length;
  return Math.round((adequate / items.length) * 100);
}
