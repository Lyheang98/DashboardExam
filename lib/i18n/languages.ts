/**
 * Language Options Configuration
 * 
 * Centralized configuration for available languages with display names
 */

import { Language } from '@/lib/i18n/translations';

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
}

export const AVAILABLE_LANGUAGES: ReadonlyArray<LanguageOption> = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'km', name: 'Kantumruy', nativeName: 'ភាសាខ្មែរ' },
] as const;

