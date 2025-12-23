'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/lib/i18n/context';

export default function TermsConditionsPage() {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.settings.termsConditions}</h1>
        <p className="text-muted-foreground mt-2">
          Terms and conditions for using our platform
        </p>
      </div>

      {/* Terms & Conditions Content */}
      <Card>
        <CardHeader>
          <CardTitle>Terms & Conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Acceptance of Terms</h3>
            <p className="text-muted-foreground">
              By accessing and using this platform, you accept and agree to be bound
              by the terms and provision of this agreement.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Use License</h3>
            <p className="text-muted-foreground">
              Permission is granted to temporarily use the platform for personal,
              non-commercial transitory viewing only. This is the grant of a license,
              not a transfer of title.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">User Account</h3>
            <p className="text-muted-foreground">
              You are responsible for maintaining the confidentiality of your account
              and password. You agree to accept responsibility for all activities that
              occur under your account.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Prohibited Uses</h3>
            <p className="text-muted-foreground">
              You may not use the platform in any way that causes, or may cause, damage
              to the platform or impairment of the availability or accessibility of the platform.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Limitation of Liability</h3>
            <p className="text-muted-foreground">
              In no event shall the platform or its suppliers be liable for any damages
              arising out of the use or inability to use the platform.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Changes to Terms</h3>
            <p className="text-muted-foreground">
              We reserve the right to modify these terms at any time. Your continued
              use of the platform after any changes constitutes your acceptance of the new terms.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

