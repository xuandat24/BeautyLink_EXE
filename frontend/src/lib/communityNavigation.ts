const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export function communityRoute(path = window.location.pathname): { id?: string; invalid?: boolean } | null {
  if (/^\/community\/?$/.test(path)) return {};
  const match = path.match(new RegExp(`^/community/posts/(${uuid})/?$`, 'i'));
  if (match) return { id: match[1].toLowerCase() };
  return path.startsWith('/community/') ? { invalid: true } : null;
}
export function communityPath(id?: string) { return id ? `/community/posts/${id}` : '/community'; }
export function goCommunity(id?: string, replace = false) {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', communityPath(id));
  window.dispatchEvent(new PopStateEvent('popstate'));
}
