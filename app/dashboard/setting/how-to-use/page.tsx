'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/lib/i18n/context';

export default function HowToUsePage() {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.header.howToUse}</h1>
        <p className="text-muted-foreground mt-2">
          Learn how to navigate and use the dashboard effectively
        </p>
      </div>

      {/* Getting Started */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">1. Dashboard Overview</h3>
            <p className="text-muted-foreground">
              The dashboard provides an overview of key metrics and statistics.
              Navigate through different sections using the sidebar menu.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">2. User Management</h3>
            <p className="text-muted-foreground">
              Manage users, roles, and permissions from the Users section.
              You can add, edit, and remove users as needed.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">3. Settings</h3>
            <p className="text-muted-foreground">
              Configure your account settings, security preferences, and
              notification settings from the Settings page.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tips & Tricks */}
      <Card>
        <CardHeader>
          <CardTitle>Tips & Tricks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Use the search functionality to quickly find users or students</li>
            <li>Filter data by status, province, district, or school for better insights</li>
            <li>Export data for reporting and analysis</li>
            <li>Customize your dashboard view based on your preferences</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

