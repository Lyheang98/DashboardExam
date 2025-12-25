import Image from "next/image";
import { IMAGE_PATHS } from "@/lib/images";

interface LoadingProps {
  title?: string;
  description?: string;
  showSkeleton?: boolean;
  language?: 'en' | 'km';
}

export function Loading({ 
  title = "Loading...", 
  description = "Please wait while we fetch the data",
  showSkeleton = false,
  language = 'en'
}: LoadingProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-8 shadow-sm">
      <div className="flex flex-col items-center justify-center py-12">
        {/* Logo with Faster Pulse Animation */}
        <div className="mb-4 relative w-16 h-16 sm:w-20 sm:h-20">
          <Image
            src={IMAGE_PATHS.logos.partner}
            alt="Logo"
            fill
            className="object-contain animate-pulse-fast"
            priority
          />
        </div>
        <p className={`text-lg font-semibold text-gray-900 dark:text-white mb-2 ${language === 'km' ? 'font-khmer' : ''}`}>
          {title}
        </p>
        <p className={`text-sm text-gray-500 dark:text-gray-400 ${language === 'km' ? 'font-khmer' : ''}`}>
          {description}
        </p>
      </div>

      {showSkeleton && (
        <div className="space-y-3 mt-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-12 bg-gray-100 dark:bg-slate-800 rounded animate-pulse"
            ></div>
          ))}
        </div>
      )}
    </div>
  );
}

