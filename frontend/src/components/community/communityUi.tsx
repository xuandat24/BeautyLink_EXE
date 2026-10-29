import React, { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { getAccessToken, getApiErrorMessage } from '../../services/beautyApi';
import { sessionCredentialEpoch } from '../../lib/authSession';
export const communityError = (e: unknown) => getApiErrorMessage(e, 'Chưa thể xử lý. Vui lòng thử lại sau.');
export const communityDate = (date: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));
export function useCommunityGuard() {
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return useCallback(() => { const token = getAccessToken(), epoch = sessionCredentialEpoch(); return () => mounted.current && token === getAccessToken() && epoch === sessionCredentialEpoch(); }, []);
}
export function CommunityDialog({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: React.ReactNode; busy?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null); const prior = useRef<Element | null>(null);
  useBodyScrollLock(true);
  useEffect(() => { prior.current = document.activeElement; dialog.current?.focus(); return () => { (prior.current as HTMLElement)?.focus?.(); }; }, []);
  return <div data-community-dialog className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onKeyDown={e => {
    if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); }
    if (e.key === 'Tab') { const items = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)') ?? [])]; const first = items[0], last = items.at(-1); if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
  }}><div ref={dialog} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl outline-none"><header className="flex items-center justify-between gap-3 border-b border-pink-100 px-5 py-4"><h2 className="text-lg font-extrabold text-slate-900">{title}</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Đóng" className="rounded-xl p-2 hover:bg-pink-50 disabled:opacity-40"><X className="h-5 w-5" /></button></header><div className="min-h-0 overflow-y-auto p-5">{children}</div></div></div>;
}
