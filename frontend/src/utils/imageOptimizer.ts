/**
 * Image Processing & Optimization Utility
 * Automatically resizes, crops, and compresses backend service images to match exact card display dimensions.
 */
import imageCompression from 'browser-image-compression';

export type ImagePreset =
  | 'deal-card'       // 240x240 (1:1 square for HotDealsSection)
  | 'salon-card'      // 270x169 (16:10 for NearYouSection)
  | 'service-card'    // 320x213 (for CategoryServicePage & ViewAllServicesModal)
  | 'category-thumb'  // 64x64 (circular category icon)
  | 'modal-banner'    // 600x360 (detail modal hero image)
  | 'avatar';         // 48x48 (brand logos & user avatars)

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100, default 78
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  fit?: 'crop' | 'cover' | 'contain';
}

export const PRESET_CONFIGS: Record<ImagePreset, { width: number; height: number; quality: number }> = {
  'deal-card': { width: 240, height: 240, quality: 78 },
  'salon-card': { width: 270, height: 169, quality: 78 },
  'service-card': { width: 320, height: 213, quality: 78 },
  'category-thumb': { width: 64, height: 64, quality: 80 },
  'modal-banner': { width: 600, height: 360, quality: 80 },
  avatar: { width: 48, height: 48, quality: 82 },
};

// In-memory cache for client-side processed images
const processedImageCache = new Map<string, string>();

/**
 * Transforms an image URL to request exact display dimensions and WebP compression from CDN.
 */
export function getOptimizedImageUrl(
  url?: string | null,
  presetOrOptions: ImagePreset | ImageOptimizationOptions = 'deal-card',
  multiplier = 1
): string {
  if (!url) return '';

  const config: ImageOptimizationOptions =
    typeof presetOrOptions === 'string'
      ? PRESET_CONFIGS[presetOrOptions]
      : presetOrOptions;

  const targetWidth = Math.round((config.width || 300) * multiplier);
  const targetHeight = config.height ? Math.round(config.height * multiplier) : undefined;
  const quality = config.quality || 78;

  try {
    // 1. Unsplash Images Optimization
    if (url.includes('images.unsplash.com')) {
      const parsed = new URL(url);
      parsed.searchParams.set('w', targetWidth.toString());
      if (targetHeight) {
        parsed.searchParams.set('h', targetHeight.toString());
        parsed.searchParams.set('fit', config.fit || 'crop');
      } else {
        parsed.searchParams.set('fit', config.fit || 'max');
      }
      parsed.searchParams.set('q', quality.toString());
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fm', config.format === 'jpeg' ? 'jpg' : 'webp');
      parsed.searchParams.set('crop', 'faces,edges');
      return parsed.toString();
    }

    // 2. Cloudinary Images Optimization
    if (url.includes('res.cloudinary.com')) {
      const uploadIdx = url.indexOf('/upload/');
      if (uploadIdx !== -1) {
        const transform = `w_${targetWidth}${targetHeight ? `,h_${targetHeight},c_fill` : ''},q_${quality},f_webp`;
        return (
          url.slice(0, uploadIdx + 8) +
          transform +
          '/' +
          url.slice(uploadIdx + 8)
        );
      }
    }

    // 3. Imgix CDN
    if (url.includes('imgix.net')) {
      const parsed = new URL(url);
      parsed.searchParams.set('w', targetWidth.toString());
      if (targetHeight) parsed.searchParams.set('h', targetHeight.toString());
      parsed.searchParams.set('q', quality.toString());
      parsed.searchParams.set('auto', 'format,compress');
      parsed.searchParams.set('fit', 'crop');
      return parsed.toString();
    }

    // Other URLs returned as-is or data URLs
    return url;
  } catch {
    return url;
  }
}

/**
 * Generates a responsive srcset string with 1x and 2x (Retina) density
 */
export function generateResponsiveSrcSet(
  url?: string | null,
  presetOrOptions: ImagePreset | ImageOptimizationOptions = 'deal-card'
): string {
  if (!url) return '';
  const url1x = getOptimizedImageUrl(url, presetOrOptions, 1);
  const url2x = getOptimizedImageUrl(url, presetOrOptions, 2);
  if (url1x === url2x) return '';
  return `${url1x} 1x, ${url2x} 2x`;
}

/**
 * Client-side dynamic image resizing & compression engine using browser-image-compression
 * Useful for user uploads or raw unoptimized remote image blobs.
 */
export async function compressAndResizeClientImage(
  imageSource: File | Blob | string,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<string> {
  const maxWidth = options.maxWidth || 600;
  const maxHeight = options.maxHeight || 600;
  const quality = (options.quality || 78) / 100;

  // Check cache if source is a string URL
  if (typeof imageSource === 'string') {
    const cacheKey = `${imageSource}_${maxWidth}x${maxHeight}_q${quality}`;
    if (processedImageCache.has(cacheKey)) {
      return processedImageCache.get(cacheKey)!;
    }
  }

  try {
    let fileToCompress: File;

    if (imageSource instanceof File) {
      fileToCompress = imageSource;
    } else if (imageSource instanceof Blob) {
      fileToCompress = new File([imageSource], 'service-image.webp', { type: imageSource.type });
    } else {
      // Remote string URL: fetch as blob and compress
      const res = await fetch(imageSource, { mode: 'cors' });
      const blob = await res.blob();
      fileToCompress = new File([blob], 'service-image.webp', { type: blob.type });
    }

    const compressedBlob = await imageCompression(fileToCompress, {
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      useWebWorker: true,
      maxIteration: 5,
      fileType: 'image/webp',
      initialQuality: quality,
    });

    const objectUrl = URL.createObjectURL(compressedBlob);
    if (typeof imageSource === 'string') {
      const cacheKey = `${imageSource}_${maxWidth}x${maxHeight}_q${quality}`;
      processedImageCache.set(cacheKey, objectUrl);
    }
    return objectUrl;
  } catch (err) {
    console.warn('Client-side image compression fallback to original source:', err);
    return typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
  }
}
