"use client";

/**
 * OptimizedImage Component
 * 
 * A wrapper around Next.js Image component with best practices:
 * - Automatic optimization
 * - Proper error handling
 * - Loading states
 * - Responsive sizing
 * - Accessibility support
 */

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getImageProps, isExternalImage } from "@/lib/images";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  priority?: boolean;
  className?: string;
  fill?: boolean;
  sizes?: string;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  onError?: () => void;
  fallbackSrc?: string;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  quality,
  priority = false,
  className,
  fill = false,
  sizes,
  objectFit = "cover",
  onError,
  fallbackSrc = "/images/placeholder.png",
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
      setHasError(true);
    }
    onError?.();
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  // For external images, we need to handle them differently
  const isExternal = isExternalImage(imgSrc);

  const baseProps = {
    src: imgSrc,
    alt,
    className: cn(
      "transition-opacity duration-300",
      isLoading && "opacity-0",
      !isLoading && "opacity-100",
      className
    ),
    onError: handleError,
    onLoad: handleLoad,
    priority,
    quality: quality || 85,
  };

  const imageProps = fill
    ? {
        ...baseProps,
        fill: true,
        sizes: sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
        style: { objectFit },
      }
    : {
        ...baseProps,
        width: width || 100,
        height: height || 100,
      };

  return (
    <div className={cn("relative overflow-hidden", fill ? "w-full h-full" : "", className)}>
      <Image {...imageProps} />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse z-10">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground z-10">
          <span className="text-xs">Image not available</span>
        </div>
      )}
    </div>
  );
}

