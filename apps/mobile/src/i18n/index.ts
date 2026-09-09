import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './translations/en.json';
import hi from './translations/hi.json';
import mr from './translations/mr.json';
import React from 'react';

type Language = 'en' | 'hi' | 'mr';
type TranslationKeys = typeof en;

const translations: Record<Language, TranslationKeys> = { en, hi, mr };

let currentLanguage: Language = 'en';
const listeners: (() => void)[] = [];

export function t(path: string): string {
  const keys = path.split('.');
  let result: any = translations[currentLanguage];
  for (const key of keys) {
    result = result?.[key];
    if (result === undefined) {
      result = translations['en'];
      for (const k of keys) result = result?.[k];
      return result || path;
    }
  }
  return result;
}

export function getCurrentLanguage(): Language {
  return currentLanguage;
}

export async function setLanguage(lang: Language) {
  await AsyncStorage.setItem('app_language', lang);
  currentLanguage = lang;
  listeners.forEach(fn => fn());
}

export async function loadSavedLanguage() {
  try {
    const saved = await AsyncStorage.getItem('app_language');
    if (saved && ['en', 'hi', 'mr'].includes(saved)) {
      currentLanguage = saved as Language;
    }
  } catch {
    currentLanguage = 'en';
  }
  listeners.forEach(fn => fn());
}

export function onLanguageChange(fn: () => void) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

export function useTranslation() {
  const language = React.useSyncExternalStore(onLanguageChange, getCurrentLanguage, getCurrentLanguage);
  return { t, language, setLanguage };
}
