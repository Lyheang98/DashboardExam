/**
 * Image Configuration and Utilities
 * 
 * Best Practices:
 * 1. Store static images in /public/images/
 * 2. Use Next.js Image component for optimization
 * 3. Configure external domains in next.config.ts
 * 4. Use environment variables for CDN URLs
 * 5. Provide proper alt text for accessibility
 */

// Image paths - centralized location for all image references
// Images are organized in folders: logos/, promotional/, banners/, avatars/, icons/, thumbnails/
export const IMAGE_PATHS = {
  logos: {
    // Organization and partner logos
    // Current location: /public/images/ (will be moved to logos/ folder later)
    moeys: '/images/MoEYS logo.png',
    foed: '/images/FOED logo.png', // Note: file is .png not .PNG
    worldBank: '/images/world bank.png',
    partner: '/images/IMG_5840.PNG',
    // After moving to logos/ folder, update to: '/images/logos/logo-name.png'
  },
  promotional: {
    // Promotional posters and marketing images
    // GEIP EDTECH promotional image
    version2: '/images/GEIP2Frame 79.jpg',
    // Add new promotional images here: '/images/promotional/image-name.jpg'
  },
  banners: {
    // Banner images for headers and hero sections
    // Add banners here: '/images/banners/banner-name.jpg'
  },
  avatars: {
    // User profile pictures and default avatars
    // Add avatars here: '/images/avatars/avatar-name.png'
    default: '/images/avatars/default-avatar.png', // Create this if needed
  },
  icons: {
    // Custom application icons
    // Add icons here: '/images/icons/icon-name.svg'
  },
  thumbnails: {
    // Thumbnail images for previews
    // Add thumbnails here: '/images/thumbnails/thumbnail-name.jpg'
  },
} as const;

// External image domains (for Next.js Image optimization)
export const EXTERNAL_IMAGE_DOMAINS = [
  'scontent.fpnh11-1.fna.fbcdn.net',
  'scontent.fpnh12-1.fna.fbcdn.net',
  // Add more CDN domains as needed
];

// Image configuration
export const IMAGE_CONFIG = {
  // Default sizes for responsive images
  sizes: {
    logo: { width: 48, height: 48 },
    logoSmall: { width: 36, height: 36 },
    avatar: { width: 40, height: 40 },
    thumbnail: { width: 100, height: 100 },
    banner: { width: 1200, height: 400 },
  },
  // Quality settings
  quality: {
    default: 85,
    high: 95,
    low: 75,
  },
  // Placeholder settings
  placeholder: 'blur' as const,
} as const;

/**
 * Get image URL - handles both local and external images
 */
export function getImageUrl(path: string): string {
  // If it's already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // For local images, ensure they start with /
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  
  return path;
}

/**
 * Check if image is external
 */
export function isExternalImage(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://');
}

/**
 * Get optimized image props for Next.js Image component
 */
export function getImageProps(
  src: string,
  alt: string,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    priority?: boolean;
    className?: string;
  }
) {
  const isExternal = isExternalImage(src);
  
  return {
    src: isExternal ? src : getImageUrl(src),
    alt,
    width: options?.width || IMAGE_CONFIG.sizes.logo.width,
    height: options?.height || IMAGE_CONFIG.sizes.logo.height,
    quality: options?.quality || IMAGE_CONFIG.quality.default,
    priority: options?.priority || false,
    className: options?.className,
    // For external images, Next.js needs unoptimized or proper domain config
    ...(isExternal && { unoptimized: false }),
  };
}

