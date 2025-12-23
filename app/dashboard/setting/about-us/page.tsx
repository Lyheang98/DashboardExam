'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/lib/i18n/context';

export default function AboutUsPage() {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.settings.aboutUs}</h1>
        <p className="text-muted-foreground mt-2">
          {t.settings.aboutUsSubtitleText}
        </p>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.aboutUsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-foreground leading-relaxed">
              {t.settings.aboutUsParagraph1}
            </p>
            <p className="text-foreground leading-relaxed">
              {t.settings.aboutUsParagraph2}
            </p>
            <p className="text-foreground leading-relaxed">
              {t.settings.aboutUsParagraph3}
            </p>
            <p className="text-foreground leading-relaxed">
              {t.settings.aboutUsParagraph4}
            </p>
          </div>

          <div className="pt-4 border-t space-y-3">
            <p className="text-foreground">
              <strong>{t.settings.aboutUsThankYou}</strong>
            </p>
            <div className="space-y-2">
              <p className="text-foreground">
                <strong>{t.settings.aboutUsInquiries}</strong>
              </p>
              <p className="text-foreground">
                <strong>{t.settings.aboutUsWebsite}:</strong>{' '}
                <a 
                  href="https://geipedtech.fedrupp.org/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://geipedtech.fedrupp.org/
                </a>
              </p>
              <p className="text-muted-foreground text-sm mt-4">
                {t.settings.aboutUsFrom}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

