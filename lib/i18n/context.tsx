'use client';

/**
 * Language Context Provider
 * 
 * Provides language state management and translations throughout the application.
 * Handles:
 * - Language preference persistence (sessionStorage)
 * - DOM manipulation for font and language attributes
 * - Translation access via context
 * 
 * @example
 * ```tsx
 * <LanguageProvider>
 *   <App />
 * </LanguageProvider>
 * ```
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Language, translations } from './translations';
import { DEFAULT_LANGUAGE } from './constants';
import { getSavedLanguage, saveLanguage, applyLanguageToDOM } from './utils';

/**
 * Language context value type
 */
interface LanguageContextType {
  /** Current active language */
  language: Language;
  /** Function to change the language */
  setLanguage: (lang: Language) => void;
  /** Translation object for the current language */
  t: typeof translations.en;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Language Provider Component
 * 
 * Manages language state and provides translations to child components.
 * Automatically loads saved language preference and applies font classes.
 * 
 * @param children - React children to wrap with language context
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [mounted, setMounted] = useState(false);

  // Initialize: Load saved language preference on mount
  useEffect(() => {
    setMounted(true);
    const savedLanguage = getSavedLanguage();
    if (savedLanguage) {
      setLanguageState(savedLanguage);
    }
  }, []);

  // Apply language-specific DOM changes (font, lang attribute)
  useEffect(() => {
    if (mounted) {
      applyLanguageToDOM(language);
    }
  }, [language, mounted]);

  /**
   * Updates the current language and persists it to sessionStorage
   * @param lang - The language code to switch to
   */
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    saveLanguage(lang);
  }, []);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations[language],
  };

  // Always provide context (defaults to English during SSR)
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access language context
 * 
 * @returns Language context with current language, setter, and translations
 * @throws Error if used outside LanguageProvider
 * 
 * @example
 * ```tsx
 * const { language, setLanguage, t } = useLanguage();
 * <h1>{t.header.title}</h1>
 * ```
 */
export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  
  if (context === undefined) {
    throw new Error(
      'useLanguage must be used within a LanguageProvider. ' +
      'Wrap your component tree with <LanguageProvider>.'
    );
  }
  
  return context;
}

