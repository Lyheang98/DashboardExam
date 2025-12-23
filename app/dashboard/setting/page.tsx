'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/lib/i18n/context';

export default function SettingsPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.settings.title}</h1>
        <p className="text-muted-foreground mt-2">
          {t.settings.subtitle}
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.profileSettings}</CardTitle>
          <CardDescription>
            {t.settings.updateProfile}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullname">{t.settings.fullName}</Label>
            <Input
              id="fullname"
              placeholder={t.settings.enterFullName}
              defaultValue="John Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t.common.email}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t.settings.enterEmail}
              defaultValue="john@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t.settings.phone}</Label>
            <Input
              id="phone"
              placeholder={t.settings.enterPhone}
              defaultValue="+1 234 567 8900"
            />
          </div>
          <Button>{t.settings.saveChanges}</Button>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.security}</CardTitle>
          <CardDescription>
            {t.settings.managePassword}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t.settings.currentPassword}</Label>
            <Input
              id="current-password"
              type="password"
              placeholder={t.settings.enterCurrentPassword}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t.settings.newPassword}</Label>
            <Input
              id="new-password"
              type="password"
              placeholder={t.settings.enterNewPassword}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t.settings.confirmPassword}</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder={t.settings.confirmNewPassword}
            />
          </div>
          <Button>{t.settings.updatePassword}</Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.notifications}</CardTitle>
          <CardDescription>
            {t.settings.manageNotifications}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t.settings.emailNotifications}</p>
              <p className="text-sm text-muted-foreground">
                {t.settings.emailNotificationsDesc}
              </p>
            </div>
            <input type="checkbox" defaultChecked className="w-4 h-4" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t.settings.marketingEmails}</p>
              <p className="text-sm text-muted-foreground">
                {t.settings.marketingEmailsDesc}
              </p>
            </div>
            <input type="checkbox" className="w-4 h-4" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t.settings.pushNotifications}</p>
              <p className="text-sm text-muted-foreground">
                {t.settings.pushNotificationsDesc}
              </p>
            </div>
            <input type="checkbox" defaultChecked className="w-4 h-4" />
          </div>
          <Button>{t.settings.savePreferences}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
