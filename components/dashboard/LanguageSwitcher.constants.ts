/**
 * Language Switcher Constants
 * 
 * Centralized configuration for available languages
 */

import { Language } from '@/lib/i18n/translations';

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
}

export const AVAILABLE_LANGUAGES: ReadonlyArray<LanguageOption> = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'km', name: 'Khmer', nativeName: 'ភាសាខ្មែរ' },
] as const;

