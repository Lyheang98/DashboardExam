'use client';

/**
 * Language Switcher Component
 * 
 * A dropdown component that allows users to switch between available languages.
 * Prevents hydration mismatches by only rendering the interactive dropdown after mount.
 * 
 * @example
 * ```tsx
 * <LanguageSwitcher />
 * ```
 */

import { useState, useEffect, useMemo } from 'react';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/lib/i18n/context';
import { AVAILABLE_LANGUAGES } from '@/lib/i18n/languages';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Find current language option
  const currentLanguage = useMemo(
    () => AVAILABLE_LANGUAGES.find((lang) => lang.code === language) ?? AVAILABLE_LANGUAGES[0],
    [language]
  );

  // Prevent hydration mismatch - render placeholder until mounted
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative" disabled aria-label="Language switcher">
        <Languages className="h-5 w-5" />
      </Button>
    );
  }

  const handleLanguageChange = (langCode: typeof language) => {
    setLanguage(langCode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative" 
          aria-label={`Current language: ${currentLanguage.name}. Click to change language.`}
        >
          <Languages className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {AVAILABLE_LANGUAGES.map((lang) => {
          const isActive = lang.code === language;
          
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={isActive ? 'bg-accent' : ''}
              aria-selected={isActive}
            >
              <div className="flex flex-col" style={{ fontFamily: lang.code === 'km' ? 'var(--font-kantumruy-pro)' : 'inherit' }}>
                <span 
                  className="font-medium" 
                  style={{ fontFamily: lang.code === 'km' ? 'var(--font-kantumruy-pro)' : 'inherit' }}
                >
                  {lang.nativeName}
                </span>
                <span className="text-xs text-muted-foreground">{lang.name}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

