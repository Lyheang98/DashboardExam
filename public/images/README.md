# Images Folder Structure

This folder contains all static images used in the application. Images are organized by category for easy management.

## 📁 Folder Structure

```
images/
├── logos/           # Organization and partner logos
├── promotional/      # Promotional posters and marketing images
├── banners/         # Banner images for headers and hero sections
├── avatars/         # User profile pictures and avatars
├── icons/           # Custom icons and graphics
└── thumbnails/      # Thumbnail images for previews
```

## 📝 Usage Guidelines

### Logos (`/logos/`)
- Organization logos (MoEYS, FOED, World Bank, etc.)
- Partner logos
- Brand assets
- **Recommended format**: PNG with transparent background
- **Recommended size**: 200x200px to 500x500px

### Promotional (`/promotional/`)
- Marketing posters
- Version launch images
- Feature announcements
- **Recommended format**: JPG or PNG
- **Recommended size**: 1200x800px or larger

### Banners (`/banners/`)
- Header banners
- Hero section images
- Background images
- **Recommended format**: JPG or WebP
- **Recommended size**: 1920x600px or larger

### Avatars (`/avatars/`)
- User profile pictures
- Default avatars
- **Recommended format**: PNG or JPG
- **Recommended size**: 200x200px to 400x400px

### Icons (`/icons/`)
- Custom application icons
- Feature icons
- **Recommended format**: SVG or PNG
- **Recommended size**: 24x24px to 128x128px

### Thumbnails (`/thumbnails/`)
- Image previews
- Gallery thumbnails
- **Recommended format**: JPG or WebP
- **Recommended size**: 300x300px to 500x500px

## 🚀 Best Practices

1. **Naming Convention**: Use lowercase with hyphens
   - ✅ `moeys-logo.png`
   - ❌ `MoEYS Logo.PNG`

2. **File Formats**:
   - **PNG**: For logos and images with transparency
   - **JPG**: For photos and complex images
   - **WebP**: For optimized web images (recommended)
   - **SVG**: For icons and simple graphics

3. **Optimization**:
   - Compress images before uploading
   - Use appropriate file sizes (don't upload 5MB images)
   - Consider using WebP format for better compression

4. **Organization**:
   - Keep related images in the same folder
   - Use descriptive filenames
   - Update `lib/images.ts` when adding new images

## 📋 Current Images

### Logos
- `MoEYS logo.png` - Main MoEYS logo
- `FOED logo.PNG` - FOED organization logo
- `world bank.png` - World Bank logo
- `IMG_5840.PNG` - Partner logo
- `MoEys(New) (3).png` - Alternative MoEYS logo

### Promotional
- Add your promotional images here (e.g., `moeys-edtech-v2-poster.jpg`)

## 🔗 Using Images in Code

After adding images, update `lib/images.ts`:

```typescript
export const IMAGE_PATHS = {
  logos: {
    moeys: '/images/logos/moeys-logo.png',
    // ... other logos
  },
  promotional: {
    version2: '/images/promotional/moeys-edtech-v2-poster.jpg',
    // ... other promotional images
  },
};
```

Then use in components:

```tsx
import { OptimizedImage } from '@/components/ui/optimized-image';
import { IMAGE_PATHS } from '@/lib/images';

<OptimizedImage
  src={IMAGE_PATHS.logos.moeys}
  alt="MoEYS Logo"
  width={120}
  height={120}
/>
```

## 📦 Migration

To migrate existing images to the new structure:

1. Move logo files to `logos/` folder
2. Move promotional images to `promotional/` folder
3. Update paths in `lib/images.ts`
4. Update any component references

