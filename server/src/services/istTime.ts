// All clinic scheduling is expressed in India Standard Time (UTC+05:30, no DST).
// Slot dates arrive as naive `YYYY-MM-DD` and slot times as `HH:mm`.
const IST_OFFSET_MINUTES = 330;

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function parseDateParts(date: string): DateParts | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return undefined;
  return { year, month, day };
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function istDayOfWeek(date: string): number | undefined {
  const parts = parseDateParts(date);
  if (!parts) return undefined;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function istDateTimeToEpoch(date: string, time: string): number | undefined {
  const parts = parseDateParts(date);
  if (!parts || !isValidTime(time)) return undefined;
  const [hour, minute] = time.split(':').map(Number);
  return Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute) - IST_OFFSET_MINUTES * 60_000;
}

export function nowIstDate(now = new Date()): string {
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

export function isPastSlot(date: string, time: string, now = new Date()): boolean {
  const epoch = istDateTimeToEpoch(date, time);
  return epoch === undefined || epoch <= now.getTime();
}

// Accepts either a naive `YYYY-MM-DDTHH:mm(:ss)` (interpreted as IST) or an
// ISO timestamp with an explicit offset. Returns epoch milliseconds.
export function parseScheduledTime(value: string): number | undefined {
  const naive = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (naive) return istDateTimeToEpoch(naive[1], naive[2]);
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : undefined;
}

// Normalises a scheduled time to the IST calendar date and 24h clock used for
// slot matching, regardless of whether the client sent a naive or zoned value.
export function scheduledSlot(value: string): { date: string; time: string } | undefined {
  const naive = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (naive && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    return parseDateParts(naive[1]) && isValidTime(naive[2]) ? { date: naive[1], time: naive[2] } : undefined;
  }
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return undefined;
  const shifted = new Date(epoch + IST_OFFSET_MINUTES * 60_000);
  return {
    date: `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`,
    time: `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`,
  };
}
