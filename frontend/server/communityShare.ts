import type { CommunityPost } from '../src/types/community';
const origin = 'https://beautylink.cloud';
export const communityPublicId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const escapeCommunityHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function image(post: CommunityPost): string {
  const candidate = post.media[0]?.url ?? post.service?.image;
  if (candidate) try { const url = new URL(candidate); if (url.protocol === 'https:' && !url.username && !url.password && !url.port && ['res.cloudinary.com', 'images.unsplash.com', 'beautylink.cloud'].includes(url.hostname)) return candidate; } catch { /* Use the official icon. */ }
  return `${origin}/android-chrome-512x512.png`;
}
/** Produces final meta tags in the HTTP HTML response, without requiring browser JS. */
export function renderCommunityShare(template: string, post: CommunityPost): string {
  if (!communityPublicId.test(post.id) || post.visibility !== 'PUBLISHED') throw new Error('Post is not public');
  const url = `${origin}/community/posts/${post.id.toLowerCase()}`;
  const title = `${post.author.name} · BeautyLink Community`; const description = post.content.trim().slice(0, 180); const preview = image(post);
  const head = `<title>${escapeCommunityHtml(title)}</title>\n<meta name="description" content="${escapeCommunityHtml(description)}">\n<link rel="canonical" href="${url}">\n<meta property="og:type" content="article">\n<meta property="og:site_name" content="BeautyLink">\n<meta property="og:title" content="${escapeCommunityHtml(title)}">\n<meta property="og:description" content="${escapeCommunityHtml(description)}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${escapeCommunityHtml(preview)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${escapeCommunityHtml(title)}">\n<meta name="twitter:description" content="${escapeCommunityHtml(description)}">\n<meta name="twitter:image" content="${escapeCommunityHtml(preview)}">`;
  const clean = template.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '').replace(/<meta\b[^>]*(?:name=["'](?:description|twitter:[^"']+)["']|property=["']og:[^"']+["'])[^>]*>/gi, '').replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '');
  return clean.replace('</head>', `${head}\n</head>`);
}
export async function publicCommunityPost(id: string, apiOrigin = 'https://api.beautylink.cloud', fetcher: typeof fetch = fetch): Promise<{ status: number; post?: CommunityPost }> {
  if (!communityPublicId.test(id)) return { status: 404 };
  const base = new URL(apiOrigin); // Only trusted server configuration; never request query/headers.
  if (base.username || base.password || base.search || base.hash || base.protocol !== 'https:') throw new Error('Community API origin must be HTTPS');
  const response = await fetcher(`${base.origin}/api/v1/community/posts/${id.toLowerCase()}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000), redirect: 'error', cache: 'no-store' });
  if (response.status === 404) return { status: 404 }; if (!response.ok) return { status: 503 };
  const body = await response.text(); if (body.length > 100_000) return { status: 503 };
  const post = JSON.parse(body) as CommunityPost;
  if (post.id !== id.toLowerCase() || post.visibility !== 'PUBLISHED' || !post.author || typeof post.author.name !== 'string' || typeof post.content !== 'string' || !Array.isArray(post.media)) return { status: 404 };
  return { status: 200, post };
}
