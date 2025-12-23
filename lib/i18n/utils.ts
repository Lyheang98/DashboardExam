/**
 * Internationalization Utilities
 * 
 * Helper functions for language and translation management
 */

import { Language } from './translations';
import { SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from './constants';

/**
 * Validates if a string is a supported language code
 * @param lang - Language code to validate
 * @returns True if the language is supported
 */
export function isValidLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGUAGES.includes(lang as Language);
}

/**
 * Gets the saved language preference from session storage
 * @returns The saved language or null if not found/invalid
 */
export function getSavedLanguage(): Language | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const saved = sessionStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && isValidLanguage(saved)) {
      return saved;
    }
  } catch (error) {
    console.warn('Failed to read language from sessionStorage:', error);
  }
  
  return null;
}

/**
 * Saves the language preference to session storage
 * @param lang - Language code to save
 */
export function saveLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (error) {
    console.warn('Failed to save language to sessionStorage:', error);
  }
}

/**
 * Applies language-specific classes and attributes to the DOM
 * @param language - The language to apply
 */
export function applyLanguageToDOM(language: Language): void {
  if (typeof document === 'undefined') return;
  
  const html = document.documentElement;
  const body = document.body;
  
  if (language === 'km') {
    html.classList.add('lang-khmer');
    html.setAttribute('lang', 'km');
    body.classList.add('font-khmer');
  } else {
    html.classList.remove('lang-khmer');
    html.setAttribute('lang', 'en');
    body.classList.remove('font-khmer');
  }
}

