// Kept separate from the shared translation bundles while workflows are integrated.
const en = {
  orders: 'Purchase orders', advance: 'Queue next step', history: 'Confirmed audit history',
  usage: 'Confirmed daily average (7 / 30 days)', source: 'Server-confirmed stock and audit history. Pending actions are not stock or usage.',
  demo: 'Isolated synthetic demo inventory', manual: 'Manually imported catalogue',
  reviewed: 'I reviewed these observations and review prompts', nextVisit: 'Next visit date (YYYY-MM-DD, optional)',
  projection: 'Patient schedule update pending integration/retry. No notification or referral has been sent.',
  visits: 'Confirmed visits', visitsUnavailable: 'Visit history unavailable. Close and reopen this visit to retry.',
  discard: 'Discard rejected action and enter a correction', discarded: 'Rejected action retained for audit; not replayed',
  discardFailed: 'Could not persist discard. Original action retained.',
  reviewRequired: 'Review the observations and enter a valid next visit date before saving.',
};
export function fieldText(_language: string, key: keyof typeof en): string { return en[key]; }
