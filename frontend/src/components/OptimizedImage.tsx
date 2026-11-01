import React, { useCallback, useState } from 'react';
import { getOptimizedImageUrl, generateResponsiveSrcSet, type ImagePreset, type ImageOptimizationOptions } from '../utils/imageOptimizer';

export interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  preset?: ImagePreset;
  customOptions?: ImageOptimizationOptions;
  priority?: boolean;
  fallbackSrc?: string;
  containerClassName?: string;
  vignette?: boolean;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src, alt, preset = 'deal-card', customOptions, priority = false,
  fallbackSrc = '/android-chrome-192x192.png', className = '', containerClassName = '',
  vignette = false, onLoad, onError, loading, ...rest
}) => {
  const [loaded, setLoaded] = useState('');
  const [failed, setFailed] = useState('');
  const source = src || fallbackSrc;
  const options = customOptions || preset;
  const raw = failed === source ? fallbackSrc : source;
  const optimized = getOptimizedImageUrl(raw, options);
  const srcSet = generateResponsiveSrcSet(raw, options);
  const attach = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(optimized);
  }, [optimized]);

  return <div className={`relative overflow-hidden ${containerClassName}`}>
    {loaded !== optimized && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-gradient-to-r from-pink-50 via-pink-100/60 to-pink-50" />}
    <img {...rest} ref={attach} key={optimized} src={optimized} srcSet={srcSet || undefined} alt={alt}
      loading={priority ? 'eager' : loading ?? 'lazy'} fetchPriority={priority ? 'high' : rest.fetchPriority ?? 'auto'}
      decoding="async" referrerPolicy="no-referrer" className={className}
      onLoad={event => { setLoaded(optimized); onLoad?.(event); }}
      onError={event => {
        if (raw !== fallbackSrc) setFailed(source); else setLoaded(optimized);
        onError?.(event);
      }} />
    {vignette && <div aria-hidden="true" className="pointer-events-none absolute inset-0 shadow-[inset_0_0_48px_rgba(15,23,42,0.38)]" />}
  </div>;
};
