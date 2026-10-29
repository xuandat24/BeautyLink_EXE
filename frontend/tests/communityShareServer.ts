// Test-only HTTP harness for the actual Vercel handler and a real isolated Spring server.
import { createServer } from 'node:http';
import handler from '../api/community-share';
if (process.env.COMMUNITY_SMOKE !== '1') throw new Error('Explicit isolated smoke opt-in required');
const actualFetch = globalThis.fetch;
globalThis.fetch = ((url, options) => {
  const target = new URL(String(url));
  if (target.origin !== 'https://api.beautylink.cloud' || !/^\/api\/v1\/community\/posts\/[0-9a-f-]{36}$/.test(target.pathname)) throw new Error('Unexpected outbound HTTP request');
  return actualFetch(`http://127.0.0.1:8080${target.pathname}`, options);
}) as typeof fetch;
createServer(async (req, response) => {
  const url = new URL(req.url || '/', 'http://localhost:5174');
  const facade = { setHeader: (key: string, value: string) => response.setHeader(key, value), status: (code: number) => { response.statusCode = code; return facade; }, send: (body: string) => response.end(req.method === 'HEAD' ? undefined : body), end: () => response.end() };
  await handler({ method: req.method, query: { id: url.pathname.split('/').at(-1) } }, facade);
}).listen(5174, '127.0.0.1', () => console.log('COMMUNITY_SHARE_READY: loopback-only HTTP metadata verification'));
