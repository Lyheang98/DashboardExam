'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/lib/i18n/context';

export default function StudentPage() {
  const { t, language } = useLanguage();
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold tracking-tight ${language === 'km' ? 'font-khmer' : ''}`}>
          Student
        </h1>
        <p className={`text-muted-foreground mt-2 ${language === 'km' ? 'font-khmer' : ''}`}>
          Manage and view student-related information
        </p>
      </div>

      {/* Student Management */}
      <Card>
        <CardHeader>
          <CardTitle className={language === 'km' ? 'font-khmer' : ''}>
            Student Management
          </CardTitle>
          <CardDescription className={language === 'km' ? 'font-khmer' : ''}>
            Access student data and filters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="student-search" className={language === 'km' ? 'font-khmer' : ''}>
              Search Students
            </Label>
            <Input
              id="student-search"
              placeholder="Search by name, ID, or other criteria"
              className={language === 'km' ? 'font-khmer' : ''}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

