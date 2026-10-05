import React, { useState } from 'react';
import {
  getOptimizedImageUrl,
  generateResponsiveSrcSet,
  ImagePreset,
  ImageOptimizationOptions,
} from '../utils/imageOptimizer';

export interface OptimizedImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  preset?: ImagePreset;
  customOptions?: ImageOptimizationOptions;
  priority?: boolean;
  fallbackSrc?: string;
  containerClassName?: string;
}

const DEFAULT_FALLBACK =
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=300&q=75&fm=webp';

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  preset = 'deal-card',
  customOptions,
  priority = false,
  fallbackSrc = DEFAULT_FALLBACK,
  className = '',
  containerClassName = '',
  ...restProps
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Compute optimized URL and retina srcSet
  const targetOptions = customOptions || preset;
  const rawUrl = hasError ? fallbackSrc : (src || fallbackSrc);
  const optimizedSrc = getOptimizedImageUrl(rawUrl, targetOptions, 1);
  const responsiveSrcSet = generateResponsiveSrcSet(rawUrl, targetOptions);

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* Skeleton placeholder while image loads */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-r from-pink-50 via-pink-100/60 to-pink-50 animate-pulse" />
      )}

      <img
        src={optimizedSrc}
        srcSet={responsiveSrcSet || undefined}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (!hasError) {
            setHasError(true);
          }
        }}
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...restProps}
      />
    </div>
  );
};
