export interface VisitChecklist {
  bp?: string;
  weight?: string;
  hb?: string;
  urineAlbumin?: string;
  hivSyphilis?: string;
  tt1?: boolean;
  fundalHeight?: string;
  tt2?: boolean;
  ifa?: boolean;
  presentation?: string;
  ttBooster?: boolean;
}

type TextField = { key: 'bp' | 'weight' | 'hb' | 'urineAlbumin' | 'hivSyphilis' | 'fundalHeight' | 'presentation'; kind: 'text' };
type BooleanField = { key: 'tt1' | 'tt2' | 'ifa' | 'ttBooster'; kind: 'boolean' };
export const TRIMESTER_CHECKLISTS: Record<1 | 2 | 3, (TextField | BooleanField)[]> = {
  1: [{ key: 'bp', kind: 'text' }, { key: 'weight', kind: 'text' }, { key: 'hb', kind: 'text' }, { key: 'urineAlbumin', kind: 'text' }, { key: 'hivSyphilis', kind: 'text' }, { key: 'tt1', kind: 'boolean' }],
  2: [{ key: 'bp', kind: 'text' }, { key: 'weight', kind: 'text' }, { key: 'fundalHeight', kind: 'text' }, { key: 'hb', kind: 'text' }, { key: 'tt2', kind: 'boolean' }, { key: 'ifa', kind: 'boolean' }],
  3: [{ key: 'bp', kind: 'text' }, { key: 'weight', kind: 'text' }, { key: 'fundalHeight', kind: 'text' }, { key: 'presentation', kind: 'text' }, { key: 'ttBooster', kind: 'boolean' }],
};

export interface AncPatient {
  id: string;
  name: string;
  trimester: 1 | 2 | 3;
  village?: string;
  phone?: string;
  lastVisit?: string;
  nextVisitDate?: string;
}

export function parseAncPatients(rows: unknown[]): AncPatient[] {
  return rows.flatMap(row => {
    if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string' ||
        !('name' in row) || typeof row.name !== 'string' || !('trimester' in row) ||
        (row.trimester !== 1 && row.trimester !== 2 && row.trimester !== 3)) return [];
    return [{
      id: row.id, name: row.name, trimester: row.trimester,
      village: 'village' in row && typeof row.village === 'string' ? row.village : undefined,
      phone: 'phone' in row && typeof row.phone === 'string' ? row.phone : undefined,
      lastVisit: 'lastVisit' in row && typeof row.lastVisit === 'string' ? row.lastVisit : undefined,
      nextVisitDate: 'nextVisitDate' in row && typeof row.nextVisitDate === 'string' ? row.nextVisitDate : undefined,
    }];
  });
}

export function visitDueState(date: string | undefined, now: Date): 'due' | 'upcoming' | 'unknown' {
  if (!date) return 'unknown';
  const day = date.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return 'unknown';
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return day <= today ? 'due' : 'upcoming';
}

export function visitChecklistError(checklist: VisitChecklist): boolean {
  if (checklist.bp?.trim()) {
    if (!/^\d{2,3}\s*\/\s*\d{2,3}$/.test(checklist.bp.trim())) return true;
    const [s, d] = checklist.bp.split('/').map(Number);
    if (s < 50 || s > 300 || d < 30 || d > 200 || s <= d) return true;
  }
  if ((['urineAlbumin', 'hivSyphilis', 'presentation'] as const).some(key => (checklist[key]?.trim().length || 0) > 200)) return true;
  const max = { weight: 500, hb: 25, fundalHeight: 60 };
  return (['weight', 'hb', 'fundalHeight'] as const).some(key => {
    const value = checklist[key]?.trim();
    return !!value && (!/^\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > max[key]);
  });
}

// Review prompts only, not a diagnosis or a clinically validated scoring system.
export function visitReviewFlags(checklist: VisitChecklist): string[] {
  const flags: string[] = [];
  const hb = Number(checklist.hb);
  if (checklist.hb?.trim() && Number.isFinite(hb) && hb > 0 && hb < 11) flags.push('hbReview');
  if (checklist.bp && /^\d{2,3}\s*\/\s*\d{2,3}$/.test(checklist.bp.trim())) {
    const [systolic, diastolic] = checklist.bp.split('/').map(Number);
    if (systolic >= 140 || diastolic >= 90) flags.push('bpReview');
  }
  // Preserve presentation as an observation. Breech alone does not imply preterm labour.
  if (checklist.presentation?.trim()) flags.push('presentationReview');
  return flags;
}
