# Image Management Best Practices

This document outlines the best practices for handling images in this Next.js application.

## 📁 File Structure

```
public/
  images/
    logos/          # Organization logos
    avatars/        # User avatars
    banners/        # Banner images
    thumbnails/     # Thumbnail images
```

## 🎯 Best Practices

### 1. **Use the OptimizedImage Component**

Always use the `OptimizedImage` component instead of the standard HTML `<img>` tag or Next.js `Image` directly:

```tsx
import { OptimizedImage } from "@/components/ui/optimized-image";
import { IMAGE_PATHS, IMAGE_CONFIG } from "@/lib/images";

<OptimizedImage
  src={IMAGE_PATHS.logos.moeys}
  alt="MoEYS Logo"
  width={IMAGE_CONFIG.sizes.logo.width}
  height={IMAGE_CONFIG.sizes.logo.height}
  priority={true} // For above-the-fold images
/>
```

### 2. **Centralize Image Paths**

All image paths should be defined in `lib/images.ts`:

```tsx
import { IMAGE_PATHS } from "@/lib/images";

// Use centralized paths
<OptimizedImage src={IMAGE_PATHS.logos.moeys} alt="Logo" />
```

### 3. **External Images (CDN)**

For external images from CDNs:

1. **Add domain to `next.config.ts`**:
```ts
remotePatterns: [
  {
    protocol: 'https',
    hostname: 'your-cdn-domain.com',
    pathname: '/**',
  },
]
```

2. **Use environment variables**:
```tsx
const imageUrl = process.env.NEXT_PUBLIC_CDN_URL + '/path/to/image.jpg';
```

### 4. **Image Optimization**

- **Format**: Next.js automatically serves WebP/AVIF when supported
- **Sizing**: Always specify width and height to prevent layout shift
- **Priority**: Use `priority={true}` for above-the-fold images
- **Lazy Loading**: Default behavior for below-the-fold images

### 5. **Accessibility**

Always provide meaningful `alt` text:

```tsx
// ✅ Good
<OptimizedImage src={logo} alt="MoEYS Education Logo" />

// ❌ Bad
<OptimizedImage src={logo} alt="logo" />
<OptimizedImage src={logo} alt="" /> // Only if decorative
```

### 6. **Error Handling**

The `OptimizedImage` component automatically handles:
- Loading states
- Error fallbacks
- Missing images

### 7. **Performance Tips**

1. **Use appropriate sizes**: Don't load 2000px images for 100px thumbnails
2. **Lazy load**: Only use `priority` for critical above-the-fold images
3. **Optimize before upload**: Compress images before adding to `/public`
4. **Use CDN**: For production, consider using a CDN for static assets

## 📝 Examples

### Local Image
```tsx
import { OptimizedImage } from "@/components/ui/optimized-image";
import { IMAGE_PATHS } from "@/lib/images";

<OptimizedImage
  src={IMAGE_PATHS.logos.moeys}
  alt="MoEYS Logo"
  width={48}
  height={48}
/>
```

### External Image (CDN)
```tsx
<OptimizedImage
  src="https://cdn.example.com/image.jpg"
  alt="Description"
  width={800}
  height={600}
/>
```

### Responsive Image with Fill
```tsx
<OptimizedImage
  src={IMAGE_PATHS.banners.homepage}
  alt="Homepage Banner"
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  objectFit="cover"
/>
```

## 🔧 Configuration

### Adding New Image Domains

Edit `next.config.ts`:
```ts
remotePatterns: [
  {
    protocol: 'https',
    hostname: 'new-domain.com',
    pathname: '/**',
  },
]
```

### Adding New Image Paths

Edit `lib/images.ts`:
```ts
export const IMAGE_PATHS = {
  logos: { ... },
  banners: {
    homepage: '/images/banners/homepage.jpg',
  },
} as const;
```

## 🚀 Migration Guide

To migrate existing images:

1. Move images to appropriate folders in `/public/images/`
2. Add paths to `IMAGE_PATHS` in `lib/images.ts`
3. Replace `<Image>` or `<img>` with `<OptimizedImage>`
4. Update imports

## 📚 Resources

- [Next.js Image Optimization](https://nextjs.org/docs/pages/api-reference/components/image)
- [Web.dev Image Best Practices](https://web.dev/fast/#optimize-your-images)

