export interface VitalValues {
  heartRate?: number;
  oxygenSaturation?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
}
export interface VitalReading extends VitalValues {
  source: 'measured' | 'demo';
  measuredAt: string;
}
export const VITAL_RANGES = {
  heartRate: [20, 300], oxygenSaturation: [50, 100],
  bloodPressureSystolic: [40, 300], bloodPressureDiastolic: [20, 200],
} as const;

export function validateVitalValues(values: VitalValues): boolean {
  const entries = Object.entries(values);
  return entries.length > 0 && entries.every(([key, value]) => {
    const range = VITAL_RANGES[key as keyof VitalValues];
    return range && typeof value === 'number' && Number.isFinite(value) && value >= range[0] && value <= range[1];
  }) && (values.bloodPressureSystolic === undefined) === (values.bloodPressureDiastolic === undefined)
    && (values.bloodPressureSystolic === undefined || values.bloodPressureSystolic > values.bloodPressureDiastolic!);
}

export function isInTransit(status: string): boolean {
  // Emergency's existing state machine uses this name for the patient in transit.
  return status === 'IN_TRANSIT' || status === 'EN_ROUTE_TO_HOSPITAL';
}

function requireBytes(data: DataView, offset: number, size: number) {
  if (offset < 0 || offset + size > data.byteLength) throw new Error('Truncated Bluetooth measurement');
}

export function decodeSfloat(data: DataView, offset: number): number {
  requireBytes(data, offset, 2);
  const raw = data.getUint16(offset, true);
  let mantissa = raw & 0x0fff;
  // IEEE 11073 reserved mantissas: +/-Infinity, NaN, NRes, Reserved.
  if ([0x07fe, 0x07ff, 0x0800, 0x0801, 0x0802].includes(mantissa)) throw new Error('Unavailable SFLOAT measurement');
  let exponent = raw >> 12;
  if (exponent >= 8) exponent -= 16;
  if (mantissa >= 0x0800) mantissa -= 0x1000;
  return mantissa * 10 ** exponent;
}

export type MeasurementKind = 'heart-rate' | 'blood-pressure' | 'plx-spot' | 'plx-continuous';

export function decodeMeasurement(kind: MeasurementKind, data: DataView): VitalValues {
  requireBytes(data, 0, 1);
  const flags = data.getUint8(0);
  let offset = 1;
  const skip = (size: number) => { requireBytes(data, offset, size); offset += size; };
  const sfloat = () => { const value = decodeSfloat(data, offset); offset += 2; return value; };
  const status = (size: number) => {
    requireBytes(data, offset, size);
    // Fail closed on reported quality/status flags, rather than publish suspect values.
    for (let i = 0; i < size; i++) if (data.getUint8(offset + i)) throw new Error('Device reports measurement quality/status flags');
    offset += size;
  };
  let values: VitalValues;
  if (kind === 'heart-rate') {
    if (flags & 0xe0) throw new Error('Reserved heart-rate flags');
    if ((flags & 0x04) && !(flags & 0x02)) throw new Error('Heart-rate sensor is not in contact');
    requireBytes(data, offset, flags & 1 ? 2 : 1);
    values = { heartRate: flags & 1 ? data.getUint16(offset, true) : data.getUint8(offset) };
    offset += flags & 1 ? 2 : 1;
    if (flags & 8) skip(2); // Energy expended, not heart rate.
    if (flags & 16) {
      if (data.byteLength - offset < 2 || (data.byteLength - offset) % 2) throw new Error('Invalid RR interval bytes');
      offset = data.byteLength;
    }
  } else if (kind === 'blood-pressure') {
    if (flags & 0xe0) throw new Error('Reserved blood-pressure flags');
    const multiplier = flags & 1 ? 7.50061683 : 1; // kPa -> mmHg
    values = { bloodPressureSystolic: sfloat() * multiplier, bloodPressureDiastolic: sfloat() * multiplier };
    sfloat(); // Mean arterial pressure is mandatory in 2A35.
    if (flags & 2) skip(7); // Date Time precedes pulse rate.
    if (flags & 4) values.heartRate = sfloat();
    if (flags & 8) skip(1); // User ID
    if (flags & 16) status(2);
  } else {
    if (flags & 0xe0) throw new Error('Reserved PLX flags');
    values = { oxygenSaturation: sfloat(), heartRate: sfloat() };
    if (kind === 'plx-spot') {
      if (flags & 1) skip(7);
      if (flags & 2) status(2);
      if (flags & 4) status(3);
      if (flags & 8) skip(2); // Pulse amplitude index is not SpO2.
    } else {
      if (flags & 1) skip(4); // Fast SpO2/pulse pair
      if (flags & 2) skip(4); // Slow SpO2/pulse pair
      if (flags & 4) status(2);
      if (flags & 8) status(3);
      if (flags & 16) skip(2);
    }
  }
  if (offset !== data.byteLength) throw new Error('Unexpected Bluetooth measurement bytes');
  if (!validateVitalValues(values)) throw new Error('Measurement outside supported ranges');
  return values;
}

interface Characteristic {
  value?: DataView;
  startNotifications(): Promise<Characteristic>;
  stopNotifications(): Promise<Characteristic>;
  addEventListener(name: string, callback: () => void): void;
  removeEventListener(name: string, callback: () => void): void;
}
interface Device {
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<{ getPrimaryService(uuid: number): Promise<{ getCharacteristic(uuid: number): Promise<Characteristic> }> }>;
    disconnect(): void;
  };
  addEventListener(name: string, callback: () => void): void;
  removeEventListener(name: string, callback: () => void): void;
}
type BluetoothHost = { window?: unknown; isSecureContext?: boolean; navigator?: {
  bluetooth?: { requestDevice(options: { filters: { services: number[] }[]; optionalServices: number[] }): Promise<Device> };
} };

export function bluetoothSupported(host: BluetoothHost = globalThis as BluetoothHost): boolean {
  return Boolean(host.window && host.isSecureContext && host.navigator?.bluetooth);
}

// No native BLE shim: Expo Go cannot provide this API. Call from a button press.
export async function connectWearable(onReading: (reading: VitalReading) => void, onError: (message: string) => void,
  onDisconnect: () => void, signal: AbortSignal, host: BluetoothHost = globalThis as BluetoothHost): Promise<() => void> {
  if (!bluetoothSupported(host)) throw new Error('Web Bluetooth unavailable; use a secure supported browser. Native requires a development build and BLE module.');
  if (signal.aborted) throw new Error('Connection cancelled');
  let device: Device | undefined;
  let closed = false;
  const listeners: { characteristic: Characteristic; callback: () => void }[] = [];
  const close = () => {
    if (closed) return;
    closed = true;
    signal.removeEventListener('abort', close);
    device?.removeEventListener('gattserverdisconnected', disconnected);
    for (const { characteristic, callback } of listeners) {
      characteristic.removeEventListener('characteristicvaluechanged', callback);
      void characteristic.stopNotifications().catch(() => {});
    }
    device?.gatt?.disconnect();
  };
  const disconnected = () => { close(); onDisconnect(); };
  signal.addEventListener('abort', close);
  try {
    device = await host.navigator!.bluetooth!.requestDevice({
      filters: [{ services: [0x180d] }, { services: [0x1810] }, { services: [0x1822] }],
      optionalServices: [0x180d, 0x1810, 0x1822],
    });
    if (closed) { device.gatt?.disconnect(); throw new Error('Connection cancelled'); }
    device.addEventListener('gattserverdisconnected', disconnected);
    if (!device.gatt) throw new Error('No GATT server on selected device');
    const server = await device.gatt.connect();
    if (closed) { device.gatt.disconnect(); throw new Error('Connection cancelled'); }
    const profiles: [number, number, MeasurementKind][] = [
      [0x180d, 0x2a37, 'heart-rate'], [0x1810, 0x2a35, 'blood-pressure'],
      [0x1822, 0x2a5e, 'plx-spot'], [0x1822, 0x2a5f, 'plx-continuous'],
    ];
    for (const [serviceId, characteristicId, kind] of profiles) {
      if (closed) throw new Error('Connection cancelled');
      let characteristic: Characteristic;
      try { characteristic = await (await server.getPrimaryService(serviceId)).getCharacteristic(characteristicId); }
      catch { continue; } // Not all optional profiles exist on a given wearable.
      if (closed) throw new Error('Connection cancelled');
      const callback = () => {
        if (closed || !characteristic.value) return;
        try { onReading({ ...decodeMeasurement(kind, characteristic.value), source: 'measured', measuredAt: new Date().toISOString() }); }
        catch (error) { onError(error instanceof Error ? error.message : 'Invalid measurement'); }
      };
      listeners.push({ characteristic, callback });
      characteristic.addEventListener('characteristicvaluechanged', callback);
      await characteristic.startNotifications();
      if (closed) { void characteristic.stopNotifications().catch(() => {}); throw new Error('Connection cancelled'); }
    }
    if (!listeners.length) throw new Error('No supported notifying Heart Rate, BP or PLX characteristic found');
    return close;
  } catch (error) { close(); throw error; }
}

export function startVitalsSimulator(onReading: (reading: VitalReading) => void): () => void {
  const emit = () => onReading({ source: 'demo', measuredAt: new Date().toISOString(),
    heartRate: 72 + Math.round(Math.random() * 12), oxygenSaturation: 96 + Math.round(Math.random() * 3),
    bloodPressureSystolic: 115 + Math.round(Math.random() * 10), bloodPressureDiastolic: 75 + Math.round(Math.random() * 8) });
  const interval = setInterval(emit, 3000);
  emit();
  return () => clearInterval(interval);
}
