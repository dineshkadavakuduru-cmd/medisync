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

export function t(path: string, fallback = path): string {
  const keys = path.split('.');
  const lookup = (dictionary: TranslationKeys) => {
    let value: unknown = dictionary;
    for (const key of keys) {
      value = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key)
        ? (value as Record<string, unknown>)[key]
        : undefined;
    }
    return typeof value === 'string' && value.trim() ? value : undefined;
  };
  return lookup(translations[currentLanguage]) ?? lookup(translations.en) ?? fallback;
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
