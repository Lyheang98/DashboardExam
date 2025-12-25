'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n/context';

export default function DisabilityPage() {
  const { t, language } = useLanguage();
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold tracking-tight ${language === 'km' ? 'font-khmer' : ''}`}>
          Disability
        </h1>
        <p className={`text-muted-foreground mt-2 ${language === 'km' ? 'font-khmer' : ''}`}>
          Manage and view disability information
        </p>
      </div>

      {/* Filter Card */}
      <Card>
        <CardHeader>
          <CardTitle className={language === 'km' ? 'font-khmer' : ''}>
            Disability Filters
          </CardTitle>
          <CardDescription className={language === 'km' ? 'font-khmer' : ''}>
            Select filters to view disability data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add dropdown menus here as needed */}
        </CardContent>
      </Card>
    </div>
  );
}

