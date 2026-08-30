import { FastifyPluginAsync } from 'fastify';
import { Facility, FacilityType, ApiResponse, MedicineItem, StaffMember, FacilitySummary } from '../types/index.js';
import { getInventory, setInventory, generateFacilityInventory, updateStock, calculateFacilityMedicineAvailability } from '../services/inventoryService.js';
import { getStaff, setStaff, generateFacilityStaff, toggleDuty } from '../services/staffService.js';
import { broadcast } from '../websocket/realtime.js';

const facilitiesRoutes: FastifyPluginAsync = async (fastify) => {
  const mockFacilities: Facility[] = [
    {
      id: 'facility-1',
      name: 'Junnar Sub-Centre',
      type: FacilityType.SUB_CENTRE,
      latitude: 18.78,
      longitude: 73.87,
      district: 'Pune',
      taluka: 'Junnar',
      beds: { total: 6, available: 4, occupied: 2 },
      medicineAvailability: 85,
      specialists: ['General Practitioner'],
      contactPhone: '020-24441111',
      isActive: true,
    },
    {
      id: 'facility-2',
      name: 'Mulshi PHC',
      type: FacilityType.PHC,
      latitude: 18.45,
      longitude: 73.78,
      district: 'Pune',
      taluka: 'Mulshi',
      beds: { total: 12, available: 8, occupied: 4 },
      medicineAvailability: 92,
      specialists: ['General Practitioner', 'Pediatrician'],
      contactPhone: '020-24442222',
      isActive: true,
    },
    {
      id: 'facility-3',
      name: 'Velhe PHC',
      type: FacilityType.PHC,
      latitude: 18.42,
      longitude: 73.65,
      district: 'Pune',
      taluka: 'Velhe',
      beds: { total: 15, available: 10, occupied: 5 },
      medicineAvailability: 78,
      specialists: ['General Practitioner', 'Gynecologist'],
      contactPhone: '020-24443333',
      isActive: true,
    },
    {
      id: 'facility-4',
      name: 'Ambegaon PHC',
      type: FacilityType.PHC,
      latitude: 18.95,
      longitude: 73.85,
      district: 'Pune',
      taluka: 'Ambegaon',
      beds: { total: 10, available: 7, occupied: 3 },
      medicineAvailability: 88,
      specialists: ['General Practitioner'],
      contactPhone: '020-24444444',
      isActive: true,
    },
    {
      id: 'facility-5',
      name: 'Bhor PHC',
      type: FacilityType.PHC,
      latitude: 18.15,
      longitude: 73.95,
      district: 'Pune',
      taluka: 'Bhor',
      beds: { total: 12, available: 9, occupied: 3 },
      medicineAvailability: 90,
      specialists: ['General Practitioner', 'Ayurvedic'],
      contactPhone: '020-24445555',
      isActive: true,
    },
    {
      id: 'facility-6',
      name: 'Khed CHC',
      type: FacilityType.CHC,
      latitude: 18.35,
      longitude: 73.85,
      district: 'Pune',
      taluka: 'Khed',
      beds: { total: 30, available: 22, occupied: 8 },
      medicineAvailability: 95,
      specialists: ['General Practitioner', 'Surgeon', 'Physician', 'Gynecologist'],
      contactPhone: '020-24446666',
      isActive: true,
    },
    {
      id: 'facility-7',
      name: 'Shirur CHC',
      type: FacilityType.CHC,
      latitude: 18.65,
      longitude: 74.00,
      district: 'Pune',
      taluka: 'Shirur',
      beds: { total: 25, available: 18, occupied: 7 },
      medicineAvailability: 91,
      specialists: ['General Practitioner', 'Surgeon', 'Pediatrician'],
      contactPhone: '020-24447777',
      isActive: true,
    },
    {
      id: 'facility-8',
      name: 'Sassoon District Hospital Pune',
      type: FacilityType.DISTRICT_HOSPITAL,
      latitude: 18.52,
      longitude: 73.87,
      district: 'Pune',
      taluka: 'Pune City',
      beds: { total: 500, available: 350, occupied: 150 },
      medicineAvailability: 98,
      specialists: [
        'Cardiologist',
        'Neurologist',
        'Surgeon',
        'Physician',
        'Gynecologist',
        'Pediatrician',
        'Orthopedic',
        'ENT',
      ],
      contactPhone: '020-24440000',
      isActive: true,
    },
    {
      id: 'facility-9',
      name: 'Alandi Sub-Centre',
      type: FacilityType.SUB_CENTRE,
      latitude: 18.68,
      longitude: 73.92,
      district: 'Pune',
      taluka: 'Pune',
      beds: { total: 4, available: 3, occupied: 1 },
      medicineAvailability: 80,
      specialists: ['General Practitioner'],
      contactPhone: '020-24448888',
      isActive: true,
    },
    {
      id: 'facility-10',
      name: 'Maval Sub-Centre',
      type: FacilityType.SUB_CENTRE,
      latitude: 18.55,
      longitude: 73.72,
      district: 'Pune',
      taluka: 'Maval',
      beds: { total: 6, available: 5, occupied: 1 },
      medicineAvailability: 75,
      specialists: ['General Practitioner', 'AYUSH'],
      contactPhone: '020-24449999',
      isActive: true,
    },
  ];

  mockFacilities.forEach((f) => {
    if (getInventory(f.id).length === 0) {
      setInventory(f.id, generateFacilityInventory(f.id, f.type));
    }
    if (getStaff(f.id).length === 0) {
      setStaff(f.id, generateFacilityStaff(f.id, f.type));
    }
  });

  fastify.get<{ Reply: ApiResponse<Facility[]> }>('/api/facilities', async () => {
    return { success: true, data: mockFacilities };
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<Facility>;
  }>('/api/facilities/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const facility = mockFacilities.find((f) => f.id === id);
    if (!facility) {
      return reply.status(404).send({ success: false, error: 'Facility not found' });
    }
    return { success: true, data: facility };
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<MedicineItem[]>;
  }>('/api/facilities/:id/inventory', async (request) => {
    const { id } = request.params as { id: string };
    return { success: true, data: getInventory(id) };
  });

  fastify.patch<{
    Params: { id: string; medicineId: string };
    Body: { currentStock: number };
    Reply: ApiResponse<MedicineItem>;
  }>('/api/facilities/:id/inventory/:medicineId', async (request, reply) => {
    const { id, medicineId } = request.params as { id: string; medicineId: string };
    const { currentStock } = request.body as { currentStock: number };
    const item = updateStock(id, medicineId, currentStock);
    if (!item) {
      return reply.status(404).send({ success: false, error: 'Medicine item not found' });
    }
    return { success: true, data: item };
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<StaffMember[]>;
  }>('/api/facilities/:id/staff', async (request) => {
    const { id } = request.params as { id: string };
    return { success: true, data: getStaff(id) };
  });

  fastify.patch<{
    Params: { id: string; staffId: string };
    Body: { isOnDuty: boolean };
    Reply: ApiResponse<StaffMember>;
  }>('/api/facilities/:id/staff/:staffId/duty', async (request, reply) => {
    const { id, staffId } = request.params as { id: string; staffId: string };
    const { isOnDuty } = request.body as { isOnDuty: boolean };
    const items = getStaff(id);
    const member = items.find((s) => s.id === staffId);
    if (!member) {
      return reply.status(404).send({ success: false, error: 'Staff member not found' });
    }
    member.isOnDuty = isOnDuty;
    broadcast({
      type: 'STAFF_UPDATE',
      facilityId: id,
      data: { staffId: member.id, name: member.name, role: member.role, isOnDuty: member.isOnDuty },
      timestamp: new Date().toISOString(),
    });
    return { success: true, data: member };
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<FacilitySummary>;
  }>('/api/facilities/:id/summary', async (request, reply) => {
    const { id } = request.params as { id: string };
    const facility = mockFacilities.find((f) => f.id === id);
    if (!facility) {
      return reply.status(404).send({ success: false, error: 'Facility not found', data: null as unknown as FacilitySummary });
    }

    const inventory = getInventory(id);
    const staff = getStaff(id);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const recentReferralsIn = Math.floor(Math.random() * 5);
    const recentReferralsOut = Math.floor(Math.random() * 3);

    const criticalItems = inventory.filter((i) => i.status === 'CRITICAL' || i.status === 'OUT_OF_STOCK').map((i) => ({
      name: i.name,
      currentStock: i.currentStock,
      minThreshold: i.minThreshold,
    }));

    const doctors = staff.filter((s) => s.role === 'DOCTOR');
    const doctorsOnDuty = doctors.filter((s) => s.isOnDuty);
    const specialists = [...new Set(doctors.map((d) => d.specialization).filter(Boolean) as string[])];
    const specialistsOnDuty = [...new Set(doctorsOnDuty.map((d) => d.specialization).filter(Boolean) as string[])];

    const summary: FacilitySummary = {
      facility,
      beds: {
        total: facility.beds.total,
        available: facility.beds.available,
        occupied: facility.beds.occupied,
        occupancyRate: Math.round((facility.beds.occupied / facility.beds.total) * 100),
      },
      medicine: {
        overallAvailability: calculateFacilityMedicineAvailability(id),
        totalItems: inventory.length,
        adequate: inventory.filter((i) => i.status === 'ADEQUATE').length,
        low: inventory.filter((i) => i.status === 'LOW').length,
        critical: inventory.filter((i) => i.status === 'CRITICAL').length,
        outOfStock: inventory.filter((i) => i.status === 'OUT_OF_STOCK').length,
        criticalItems,
      },
      staff: {
        total: staff.length,
        onDuty: staff.filter((s) => s.isOnDuty).length,
        doctors: doctors.length,
        doctorsOnDuty: doctorsOnDuty.length,
        specialists,
        specialistsOnDuty,
      },
      recentReferralsIn,
      recentReferralsOut,
      activeAlerts: 0,
    };

    return { success: true, data: summary };
  });

  fastify.patch<{
    Params: { id: string };
    Body: { available: number };
    Reply: ApiResponse<Facility>;
  }>('/api/facilities/:id/beds', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { available } = request.body as { available: number };
    const facility = mockFacilities.find((f) => f.id === id);
    if (!facility) {
      return reply.status(404).send({ success: false, error: 'Facility not found' });
    }
    facility.beds.available = Math.min(available, facility.beds.total);
    facility.beds.occupied = facility.beds.total - facility.beds.available;

    broadcast({
      type: 'BED_UPDATE',
      facilityId: id,
      data: { total: facility.beds.total, available: facility.beds.available, occupied: facility.beds.occupied },
      timestamp: new Date().toISOString(),
    });

    return { success: true, data: facility };
  });

  fastify.patch<{
    Params: { id: string };
    Body: { availability: number };
    Reply: ApiResponse<Facility>;
  }>('/api/facilities/:id/medicine', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { availability } = request.body as { availability: number };
    const facility = mockFacilities.find((f) => f.id === id);
    if (!facility) {
      return reply.status(404).send({ success: false, error: 'Facility not found' });
    }
    facility.medicineAvailability = Math.max(0, Math.min(100, availability));
    return { success: true, data: facility };
  });
};

export default facilitiesRoutes;
