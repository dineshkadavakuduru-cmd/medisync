import { mockFacilities } from '../database/facilities.js';
import { getInventory, updateStock, generateFacilityInventory, setInventory } from './inventoryService.js';
import { getStaff, setStaff, generateFacilityStaff, toggleDuty } from './staffService.js';
import { broadcast } from '../websocket/realtime.js';

export function startSimulator() {
  if (process.env.ENABLE_SIMULATOR !== 'true') {
    console.log('Simulator disabled (set ENABLE_SIMULATOR=true to enable)');
    return;
  }

  console.log('Real-time simulator started (30s intervals)');

  if (getInventory(mockFacilities[0].id).length === 0) {
    mockFacilities.forEach((f) => {
      setInventory(f.id, generateFacilityInventory(f.id, f.type));
      setStaff(f.id, generateFacilityStaff(f.id, f.type));
    });
  }

  setInterval(() => {
    const facility = mockFacilities[Math.floor(Math.random() * mockFacilities.length)];
    const roll = Math.random();

    if (roll < 0.4) {
      const delta = Math.random() > 0.5 ? 1 : -1;
      const newAvailable = Math.max(0, Math.min(facility.beds.total, facility.beds.available + delta));
      facility.beds.available = newAvailable;
      facility.beds.occupied = facility.beds.total - newAvailable;

      broadcast({
        type: 'BED_UPDATE',
        facilityId: facility.id,
        data: { total: facility.beds.total, available: facility.beds.available, occupied: facility.beds.occupied },
        timestamp: new Date().toISOString(),
      });
    } else if (roll < 0.8) {
      const items = getInventory(facility.id);
      if (items.length > 0) {
        const item = items[Math.floor(Math.random() * items.length)];
        const consumption = Math.floor(Math.random() * 5) + 1;
        const newStock = Math.max(0, item.currentStock - consumption);
        updateStock(facility.id, item.id, newStock);
      }
    } else {
      const staff = getStaff(facility.id);
      if (staff.length > 0) {
        const member = staff[Math.floor(Math.random() * staff.length)];
        toggleDuty(facility.id, member.id);
      }
    }
  }, 30000);
}
