# Global Page Design Pattern

This document defines the standard design pattern for all dashboard pages to ensure consistency across the application.

## Page Structure

### 1. Top Header (Above Filters)
```tsx
<div className="mt-6">
  <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
    {language === 'km' ? 'តម្រងខេត្ត' : 'Filter Province'}
  </h1>
  <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
    {language === 'km' ? 'Description in Khmer' : 'Description in English'}
  </p>
</div>
```

**Specifications:**
- **Title Size**: `text-xl` (smaller than before)
- **Title Color**: `text-primary` (blue)
- **Title Font**: `font-khmer` when `language === 'km'`
- **Top Spacing**: `mt-6`
- **Subtitle Size**: `text-sm`
- **Subtitle Color**: `text-muted-foreground`

### 2. Filter Card
- No title inside the filter card
- Direct filter inputs/labels
- Card wrapper with `CardContent`

### 3. Title Above Table
```tsx
<div className="flex justify-between items-center">
  <div>
    <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
      {language === 'km' ? 'ខេត្ត' : 'Province'}
    </h1>
    <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
      {language === 'km' ? 'Subtitle in Khmer' : 'Subtitle in English'}
    </p>
  </div>
</div>
```

**Specifications:**
- **Title Size**: `text-xl` (matches top header)
- **Title Color**: `text-primary` (blue)
- **Title Font**: `font-khmer` when `language === 'km'`
- **Subtitle Size**: `text-sm`
- **Subtitle Color**: `text-muted-foreground`

### 4. Table Card
```tsx
<Card>
  <CardContent>
    {/* DataTable and Pagination */}
  </CardContent>
</Card>
```

**Specifications:**
- Wrapped in `Card` component
- No `CardHeader` or `CardTitle` inside
- Direct `CardContent` with table and pagination
- Pagination has `pt-4 border-t` for top border

## Typography Scale

- **Page Title (Top)**: `text-xl font-bold text-primary`
- **Page Title (Above Table)**: `text-xl font-bold text-primary`
- **Subtitle**: `text-sm text-muted-foreground`
- **Filter Labels**: `text-sm font-medium text-primary`

## Color Scheme

- **Primary Text (Titles)**: `text-primary` (blue)
- **Secondary Text (Subtitles)**: `text-muted-foreground`
- **Khmer Font**: Applied via `font-khmer` class when `language === 'km'`

## Spacing

- **Top Header**: `mt-6` from page top
- **Filter Card**: Directly after header (no extra spacing)
- **Title Above Table**: Standard spacing from filter card
- **Table Card**: Standard spacing from title

## Examples

### Schools Page
- Top: "Filter School" / "តម្រងសាលា"
- Above Table: "Schools" / "សាលា"

### Province Page
- Top: "Filter Province" / "តម្រងខេត្ត"
- Above Table: "Province" / "ខេត្ត"

## Implementation Checklist

When creating a new page, ensure:
- [ ] Top header uses `text-xl font-bold text-primary`
- [ ] Top header has `mt-6` spacing
- [ ] Subtitle uses `text-sm text-muted-foreground`
- [ ] Khmer font applied when `language === 'km'`
- [ ] Filter card has no internal title
- [ ] Title above table matches top header size (`text-xl`)
- [ ] Table wrapped in `Card` component
- [ ] Pagination has `pt-4 border-t` styling

