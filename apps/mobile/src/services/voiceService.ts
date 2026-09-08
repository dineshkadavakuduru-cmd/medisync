export interface SymptomLabel {
  id: string;
  label: string;
  labelHi?: string;
  labelMr?: string;
}

export interface VoiceResult {
  transcript: string;
  recognizedIds: string[];
  source: 'web-speech' | 'manual';
}

export const speechLocales: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

export async function speak(text: string, language = 'en') {
  const Speech = await import('expo-speech');
  Speech.speak(text, { language: speechLocales[language] || 'en-IN', rate: 0.9, pitch: 1 });
}

export async function stopSpeaking() {
  const Speech = await import('expo-speech');
  await Speech.stop();
}

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

// Conservative label matching, not clinical NLP. Longer labels win over overlapping
// shorter labels; negated/uncertain clauses are left for manual review.
export function mapTranscriptToSymptoms(transcript: string, catalogue: readonly SymptomLabel[]): string[] {
  const matches: { id: string; start: number; end: number }[] = [];
  let base = 0;
  for (const clause of transcript.split(/[.!?;।,]|\b(?:but|and)\b|लेकिन|और|पण|आणि/iu)) {
    const text = normalize(clause);
    if (!/(?:^|\s)(?:no|not|without|denies|never|maybe|नहीं|नही|नाही|नको|शायद|कदाचित)(?:\s|$)/u.test(text)) {
      for (const symptom of catalogue) {
        for (const label of [symptom.label, symptom.labelHi, symptom.labelMr]) {
          const term = label && normalize(label);
          if (!term) continue;
          let from = 0;
          while (from < text.length) {
            const start = text.indexOf(term, from);
            if (start < 0) break;
            const end = start + term.length;
            if ((start === 0 || text[start - 1] === ' ') && (end === text.length || text[end] === ' ')) {
              matches.push({ id: symptom.id, start: base + start, end: base + end });
            }
            from = end;
          }
        }
      }
    }
    base += text.length + 1;
  }
  const accepted: typeof matches = [];
  for (const match of matches.sort((a, b) => (b.end - b.start) - (a.end - a.start))) {
    if (!accepted.some(other => match.start < other.end && match.end > other.start)) accepted.push(match);
  }
  return [...new Set(accepted.sort((a, b) => a.start - b.start).map(match => match.id))];
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechHost = {
  isSecureContext?: boolean;
  window?: unknown;
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export type VoiceFailure = 'unsupported' | 'insecure' | 'permission' | 'network' | 'no-speech' | 'language' | 'failed';

export function getVoiceSupport(host: SpeechHost = globalThis as SpeechHost): VoiceFailure | null {
  if (!host.window) return 'unsupported';
  if (!host.isSecureContext) return 'insecure';
  return host.SpeechRecognition || host.webkitSpeechRecognition ? null : 'unsupported';
}

// Call directly from a user gesture. Browser service may send audio to its vendor;
// setting lang requests a locale, it cannot guarantee vendor language availability.
export function startVoiceRecognition(language: string, callbacks: {
  onTranscript: (transcript: string, final: boolean) => void;
  onError: (error: VoiceFailure) => void;
  onEnd: () => void;
}, host: SpeechHost = globalThis as SpeechHost): { stop: () => void; cancel: () => void } {
  const support = getVoiceSupport(host);
  if (support) throw new Error(support);
  const Constructor = host.SpeechRecognition || host.webkitSpeechRecognition!;
  const recognition = new Constructor();
  recognition.lang = speechLocales[language] || 'en-IN';
  recognition.continuous = false;
  recognition.interimResults = true;
  let active = true;
  let finalText = '';
  let timer: ReturnType<typeof setTimeout>;
  const detach = () => {
    active = false;
    clearTimeout(timer);
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
  };
  recognition.onresult = event => {
    if (!active) return;
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) finalText += `${result[0].transcript} `;
      else interim += result[0].transcript;
    }
    callbacks.onTranscript((finalText + interim).trim(), !interim);
  };
  recognition.onerror = event => {
    if (!active) return;
    const code: VoiceFailure = ['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error) ? 'permission'
      : event.error === 'network' ? 'network' : event.error === 'no-speech' ? 'no-speech'
        : event.error === 'language-not-supported' ? 'language' : 'failed';
    detach();
    recognition.abort();
    callbacks.onError(code);
    callbacks.onEnd();
  };
  recognition.onend = () => {
    if (!active) return;
    detach();
    if (!finalText.trim()) callbacks.onError('no-speech');
    callbacks.onEnd();
  };
  timer = setTimeout(() => {
    if (!active) return;
    detach();
    recognition.abort();
    callbacks.onError('failed');
    callbacks.onEnd();
  }, 30000);
  try { recognition.start(); } catch (error) { detach(); throw error; }
  return {
    stop: () => { if (active) recognition.stop(); },
    cancel: () => { if (active) { detach(); recognition.abort(); } },
  };
}
