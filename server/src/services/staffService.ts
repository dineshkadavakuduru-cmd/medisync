import { broadcast } from '../websocket/realtime.js';

export type StaffRole = 'DOCTOR' | 'NURSE' | 'ASHA' | 'ANM' | 'PHARMACIST' | 'LAB_TECH' | 'ADMIN';

export interface StaffMember {
  id: string;
  facilityId: string;
  name: string;
  role: StaffRole;
  specialization?: string;
  phone: string;
  isOnDuty: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  languages: string[];
}

const MARATHI_NAMES = [
  'Anita Deshmukh', 'Rajesh Patil', 'Priya Sharma', 'Amit Kulkarni', 'Sunita Pawar',
  'Vikram Jadhav', 'Kavita More', 'Suresh Bhosale', 'Meera Kadam', 'Dattatray Shinde',
  'Shobha Ghadge', 'Prakash Nikam', 'Lata Sawant', 'Mahesh Chavan', 'Deepa Salunkhe',
  'Nitin Rathod', 'Archana Thorat', 'Santosh Kamble', 'Usha Mane', 'Rahul Gaikwad',
];

function generatePhone(): string {
  const digits = Math.floor(1000000000 + Math.random() * 9000000000);
  return `+91-${digits}`;
}

const SPECIALIZATIONS = ['General', 'Pediatrics', 'Obstetrics', 'Surgery', 'Orthopedic', 'Cardiology', 'Neurology', 'Ayurvedic'];

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMany(arr: string[], count: number): string[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function generateFacilityStaff(facilityId: string, facilityType: string): StaffMember[] {
  const type = facilityType.toUpperCase();
  const staff: StaffMember[] = [];
  let idCounter = 1;

  const add = (role: StaffRole, count: number, specialization?: string) => {
    for (let i = 0; i < count; i++) {
      staff.push({
        id: `${facilityId}-${role.toLowerCase()}-${idCounter++}`,
        facilityId,
        name: pick(MARATHI_NAMES),
        role,
        specialization,
        phone: generatePhone(),
        isOnDuty: Math.random() > 0.3,
        shiftStart: '08:00',
        shiftEnd: '20:00',
        languages: pickMany(['Marathi', 'Hindi', 'English'], 2 + Math.floor(Math.random() * 2)),
      });
    }
  };

  if (type === 'SUB_CENTRE') {
    add('ANM', 1);
    add('ASHA', 1);
  } else if (type === 'PHC') {
    add('DOCTOR', 1, 'General');
    add('NURSE', 2);
    add('PHARMACIST', 1);
    add('ASHA', 2);
  } else if (type === 'CHC') {
    add('DOCTOR', 2, pick(SPECIALIZATIONS));
    add('DOCTOR', 1, pick(SPECIALIZATIONS));
    add('NURSE', 5);
    add('LAB_TECH', 1);
    add('PHARMACIST', 1);
    add('ASHA', 3);
  } else if (type === 'DISTRICT_HOSPITAL') {
    for (let i = 0; i < 8; i++) add('DOCTOR', 1, pick(SPECIALIZATIONS));
    add('NURSE', 15);
    add('LAB_TECH', 3);
    add('PHARMACIST', 2);
    add('ADMIN', 1);
  }

  return staff;
}

const staffStore: Map<string, StaffMember[]> = new Map();

export function getStaff(facilityId: string): StaffMember[] {
  return staffStore.get(facilityId) || [];
}

export function setStaff(facilityId: string, items: StaffMember[]) {
  staffStore.set(facilityId, items);
}

export function toggleDuty(facilityId: string, staffId: string): StaffMember | null {
  const items = staffStore.get(facilityId);
  if (!items) return null;
  const member = items.find((s) => s.id === staffId);
  if (!member) return null;

  member.isOnDuty = !member.isOnDuty;

  broadcast({
    type: 'STAFF_UPDATE',
    facilityId,
    data: { staffId: member.id, name: member.name, role: member.role, isOnDuty: member.isOnDuty },
    timestamp: new Date().toISOString(),
  });

  return member;
}
