import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publicCommunityPost, renderCommunityShare } from '../server/communityShare';
interface Request { method?: string; query: Record<string, string | string[] | undefined> }
interface Response { setHeader: (key: string, value: string) => unknown; status: (status: number) => Response; send: (body: string) => unknown; end: () => unknown }
export default async function communityShare(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method ?? 'GET')) { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).end(); }
  try {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    const result = await publicCommunityPost(id, process.env.COMMUNITY_API_ORIGIN || 'https://api.beautylink.cloud');
    if (!result.post) { res.setHeader('X-Robots-Tag', 'noindex'); if (req.method === 'HEAD') return res.status(result.status).end(); return res.status(result.status).send('<!doctype html><html lang="vi"><meta charset="utf-8"><title>BeautyLink Community</title><h1>Bài viết chưa sẵn sàng</h1><p>Bài viết không còn công khai hoặc Community đang tạm gián đoạn.</p><a href="/community">Về Community</a></html>'); }
    const template = await readFile(join(process.cwd(), 'dist', 'index.html'), 'utf8');
    const html = renderCommunityShare(template, result.post);
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch {
    res.setHeader('X-Robots-Tag', 'noindex');
    if (req.method === 'HEAD') return res.status(503).end();
    return res.status(503).send('<!doctype html><html lang="vi"><meta charset="utf-8"><title>BeautyLink Community</title><h1>Community đang tạm gián đoạn</h1><a href="/community">Thử lại từ bảng tin</a></html>');
  }
}
