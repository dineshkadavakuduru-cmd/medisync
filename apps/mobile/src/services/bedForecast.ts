/** Experimental total/general-bed occupancy only; never an ICU or allocation tool. */
export const BED_HORIZONS = [6, 12, 24, 48] as const;
const HOUR = 3_600_000;
const DISCLAIMER = 'Synthetic/demo forecasting method, not clinically validated. Do not use for clinical decisions or automatic bed allocation.';

export interface BedHistoryRequest {
  facility_id: string;
  capacity: number;
  history: { timestamp: string; occupied_beds: number }[];
}

export interface BedPrediction {
  horizon_hours: typeof BED_HORIZONS[number];
  timestamp: string;
  occupied_beds: number;
  available_beds: number;
  occupancy_rate: number;
}

export type ModelFallbackReason = 'insufficient_history' | 'model_not_found' | 'model_unavailable';
export type LocalFallbackReason = 'not_configured' | 'invalid_url' | 'timeout' | 'request_failed' | 'invalid_response';
export interface BedForecastResponse {
  facility_id: string;
  capacity: number;
  model_used: 'synthetic_lstm' | 'synthetic_moving_average_trend_fallback';
  fallback_reason: ModelFallbackReason | null;
  synthetic: true;
  clinically_validated: false;
  disclaimer: string;
  forecasts: BedPrediction[];
}
export interface BedForecastResult {
  prediction: BedForecastResponse;
  source: 'ml' | 'local';
  localReason: LocalFallbackReason | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function timestampMs(value: unknown): number {
  if (typeof value !== 'string') return NaN;
  const match = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:[Zz]|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return NaN;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const offsetHour = Number(match[7] ?? 0);
  const offsetMinute = Number(match[8] ?? 0);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return NaN;
  const time = Date.parse(value);
  return time >= Date.parse('0001-01-01T00:00:00Z') && time <= Date.parse('9999-12-31T23:59:59.999Z') ? time : NaN;
}

/** Reject snapshots, gaps, reordered points, timezone-less dates and impossible counts. */
export function validateBedHistory(value: unknown): BedHistoryRequest {
  if (!record(value) || typeof value.facility_id !== 'string' || !value.facility_id.trim() || value.facility_id.trim().length > 128 || !Number.isInteger(value.capacity) || Number(value.capacity) < 1 || Number(value.capacity) > 1_000_000 || !Array.isArray(value.history) || value.history.length < 2 || value.history.length > 2160) {
    throw new Error('Invalid bed occupancy history');
  }
  const capacity = value.capacity as number;
  let previous: number | undefined;
  const history = value.history.map((point: unknown) => {
    if (!record(point)) throw new Error('Invalid bed observation');
    const time = timestampMs(point.timestamp);
    if (!Number.isFinite(time) || !Number.isInteger(point.occupied_beds) || Number(point.occupied_beds) < 0 || Number(point.occupied_beds) > capacity || (previous !== undefined && time - previous !== HOUR)) {
      throw new Error('History must contain bounded occupied counts at exactly hourly intervals');
    }
    previous = time;
    return { timestamp: new Date(time).toISOString(), occupied_beds: point.occupied_beds as number };
  });
  if (previous! + 48 * HOUR > Date.parse('9999-12-31T23:59:59.999Z')) throw new Error('History is too late to forecast');
  return { facility_id: value.facility_id.trim(), capacity, history };
}

/** Fixed dates and capacity make this reproducible and independent of live facility data. */
export function buildSyntheticBedHistory(): BedHistoryRequest {
  return {
    facility_id: 'synthetic-demo-total-beds',
    capacity: 100,
    history: Array.from({ length: 24 }, (_, hour) => ({
      timestamp: new Date(Date.UTC(2025, 0, 1, hour)).toISOString(),
      occupied_beds: Math.round(58 + 8 * Math.sin(hour * Math.PI / 12) + hour * 0.4),
    })),
  };
}

/** Same last-24-point moving-average/least-squares trend as ml/api/beds.py. */
export function heuristicBedForecast(input: BedHistoryRequest): BedForecastResponse {
  const request = validateBedHistory(input);
  const values = request.history.slice(-24).map(point => point.occupied_beds);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const center = (values.length - 1) / 2;
  const slope = values.reduce((sum, value, i) => sum + (i - center) * (value - mean), 0)
    / values.reduce((sum, _, i) => sum + (i - center) ** 2, 0);
  const origin = Date.parse(request.history[request.history.length - 1].timestamp);
  return {
    facility_id: request.facility_id,
    capacity: request.capacity,
    model_used: 'synthetic_moving_average_trend_fallback',
    fallback_reason: request.history.length < 24 ? 'insufficient_history' : 'model_unavailable',
    synthetic: true,
    clinically_validated: false,
    disclaimer: DISCLAIMER,
    forecasts: BED_HORIZONS.map(horizon => {
      const value = Math.min(request.capacity, Math.max(0, mean + slope * (horizon + center)));
      // Python round uses ties-to-even, unlike Math.round.
      const floor = Math.floor(value);
      const occupied = value - floor === 0.5 ? floor + floor % 2 : Math.round(value);
      return {
        horizon_hours: horizon,
        timestamp: new Date(origin + horizon * HOUR).toISOString(),
        occupied_beds: occupied,
        available_beds: request.capacity - occupied,
        occupancy_rate: occupied / request.capacity,
      };
    }),
  };
}

function validateResponse(value: unknown, request: BedHistoryRequest): BedForecastResponse {
  if (!record(value) || value.facility_id !== request.facility_id || value.capacity !== request.capacity || value.synthetic !== true || value.clinically_validated !== false || typeof value.disclaimer !== 'string' || !value.disclaimer.trim() || !Array.isArray(value.forecasts) || value.forecasts.length !== 4) throw new Error('Invalid response');
  if (value.model_used === 'synthetic_lstm') {
    if (value.fallback_reason !== null || request.history.length < 24) throw new Error('Invalid LSTM response');
  } else if (value.model_used !== 'synthetic_moving_average_trend_fallback' || !['insufficient_history', 'model_not_found', 'model_unavailable'].includes(String(value.fallback_reason))) {
    throw new Error('Invalid forecast method');
  }
  const origin = Date.parse(request.history[request.history.length - 1].timestamp);
  for (const [i, point] of value.forecasts.entries()) {
    if (!record(point) || point.horizon_hours !== BED_HORIZONS[i] || timestampMs(point.timestamp) !== origin + BED_HORIZONS[i] * HOUR || !Number.isInteger(point.occupied_beds) || Number(point.occupied_beds) < 0 || Number(point.occupied_beds) > request.capacity || point.available_beds !== request.capacity - Number(point.occupied_beds) || typeof point.occupancy_rate !== 'number' || !Number.isFinite(point.occupancy_rate) || point.occupancy_rate < 0 || point.occupancy_rate > 1 || Math.abs(point.occupancy_rate - Number(point.occupied_beds) / request.capacity) > 1e-9) throw new Error('Invalid forecast point');
  }
  return value as unknown as BedForecastResponse;
}

export async function fetchBedForecast(input: BedHistoryRequest, options: {
  origin?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetcher?: typeof fetch;
} = {}): Promise<BedForecastResult> {
  const request = validateBedHistory(input);
  const fallback = (localReason: LocalFallbackReason): BedForecastResult => ({ prediction: heuristicBedForecast(request), source: 'local', localReason });
  if (options.signal?.aborted) throw new Error('Forecast cancelled');
  const configured = (options.origin ?? process.env.EXPO_PUBLIC_ML_URL ?? '').trim();
  if (!configured) return fallback('not_configured');
  let origin: string;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !url.hostname.includes('.') || /(^|\.)(localhost|example\.(com|org|net))$|\.(invalid|test|example|localhost)$/.test(url.hostname)) throw new Error('Expected a real HTTPS origin');
    origin = url.origin;
  } catch {
    return fallback('invalid_url');
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  let reason: LocalFallbackReason = 'request_failed';
  try {
    // Bound both fetch and body parsing, even if a transport ignores AbortSignal.
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { reason = 'timeout'; reject(new Error('Forecast timed out')); controller.abort(); }, options.timeoutMs ?? 8000);
      cancel = () => { reject(new Error('Forecast cancelled')); controller.abort(); };
      options.signal?.addEventListener('abort', cancel);
    });
    const remote = async () => {
      const response = await (options.fetcher ?? fetch)(`${origin}/predict/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
      });
      if (!response.ok) throw new Error('ML request failed');
      reason = 'invalid_response';
      return validateResponse(await response.json(), request);
    };
    const prediction = await Promise.race([remote(), deadline]);
    return { prediction, source: 'ml', localReason: null };
  } catch {
    if (options.signal?.aborted) throw new Error('Forecast cancelled');
    return fallback(reason);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
