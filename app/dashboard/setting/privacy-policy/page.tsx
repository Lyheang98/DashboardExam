'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/lib/i18n/context';

export default function PrivacyPolicyPage() {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.settings.privacyPolicy}</h1>
        <p className="text-muted-foreground mt-2">
          Our commitment to protecting your privacy
        </p>
      </div>

      {/* Privacy Policy Content */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Information We Collect</h3>
            <p className="text-muted-foreground">
              We collect information that you provide directly to us, including
              when you create an account, use our services, or contact us for support.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">How We Use Your Information</h3>
            <p className="text-muted-foreground">
              We use the information we collect to provide, maintain, and improve
              our services, process transactions, and communicate with you.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Data Security</h3>
            <p className="text-muted-foreground">
              We implement appropriate technical and organizational measures to protect
              your personal information against unauthorized access, alteration, disclosure,
              or destruction.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Your Rights</h3>
            <p className="text-muted-foreground">
              You have the right to access, update, or delete your personal information
              at any time. You can also opt-out of certain communications from us.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Contact Us</h3>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy, please contact us
              through the Contact Us page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

