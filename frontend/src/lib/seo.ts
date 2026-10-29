export interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
}

export const DEFAULT_SEO: SEOConfig = {
  title: 'BeautyLink - Săn Deal Làm Đẹp, Spa & Thẩm Mỹ Viện Giảm Tới 90%',
  description:
    'Nền tảng đặt lịch làm đẹp thông minh số 1 Việt Nam. Hơn 5.000+ Spa, Clinic, Nail và Thẩm mỹ viện uy tín cùng hàng ngàn deal giờ vàng giá sốc.',
  image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
  url: 'https://beautylink.cloud',
  type: 'website',
};

export function updateMetaTags(config: SEOConfig = {}) {
  if (typeof document === 'undefined') return;

  const merged = { ...DEFAULT_SEO, ...config };

  // Title
  document.title = merged.title!;

  // Meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', merged.description!);
  }

  const canonical = document.querySelector('link[rel="canonical"]') ?? document.head.appendChild(document.createElement('link'));
  canonical.setAttribute('rel', 'canonical'); canonical.setAttribute('href', merged.url!);
  for (const [property, value] of [['og:url', merged.url!], ['og:type', merged.type!]]) {
    const tag = document.querySelector(`meta[property="${property}"]`) ?? document.head.appendChild(document.createElement('meta'));
    tag.setAttribute('property', property); tag.setAttribute('content', value);
  }

  // OG tags
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', merged.title!);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', merged.description!);

  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.setAttribute('content', merged.image!);
}
