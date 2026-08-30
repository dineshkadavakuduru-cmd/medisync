import * as Speech from 'expo-speech';

export async function speak(text: string, language: string = 'en') {
  const langMap: Record<string, string> = {
    'en': 'en-IN',
    'hi': 'hi-IN',
    'mr': 'mr-IN',
  };

  await Speech.speak(text, {
    language: langMap[language] || 'en-IN',
    rate: 0.9,
    pitch: 1.0,
  });
}

export function stopSpeaking() {
  Speech.stop();
}

export interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  error: string | null;
}

export function simulateVoiceInput(language: string): Promise<string> {
  const phrases: Record<string, string[]> = {
    'en': ['fever and headache', 'chest pain and difficulty breathing', 'stomach pain and vomiting', 'snake bite on the leg'],
    'hi': ['बुखार और सिरदर्द', 'छाती में दर्द और सांस लेने में कठिनाई', 'पेट दर्द और उल्टी', 'पैर में सांप ने काटा'],
    'mr': ['ताप आणि डोकेदुखी', 'छातीत दुखणे आणि श्वास घेण्यास त्रास', 'पोटदुखी आणि उलटी', 'पायावर सापाने चावले'],
  };
  const options = phrases[language] || phrases['en'];
  return new Promise(resolve => {
    setTimeout(() => resolve(options[Math.floor(Math.random() * options.length)]), 2000);
  });
}