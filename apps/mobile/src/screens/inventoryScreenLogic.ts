export function parseStockQuantity(value: string, allowZero = false): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const quantity = Number(value.trim());
  return Number.isSafeInteger(quantity) && quantity >= (allowZero ? 0 : 1) ? quantity : null;
}

export function inventoryUsage(logs: { timestamp: number; quantity: unknown }[], now: number) {
  const start = now - 7 * 24 * 60 * 60 * 1000;
  const total = logs.reduce((sum, log) => log.timestamp > start && log.timestamp <= now &&
    typeof log.quantity === 'number' && Number.isSafeInteger(log.quantity) && log.quantity > 0 ? sum + log.quantity : sum, 0);
  return { total, dailyAverage: total / 7 };
}
