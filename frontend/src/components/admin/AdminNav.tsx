import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, CalendarDays, CreditCard, FileText, Home, LogOut, Users, Store, Star, Tag, Settings, Menu, X, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
export type AdminSection = 'overview' | 'customers' | 'salons' | 'bookings' | 'payments' | 'reviews' | 'promotions' | 'reports' | 'settings';
export interface AdminNavProps { active: AdminSection; adminName: string; onNavigate: (section: AdminSection, query?: string) => void; onHome: () => void; onLogout: () => void; controls?: React.ReactNode }
export const adminItems: Array<{ id: AdminSection; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Tổng quan', icon: BarChart3 }, { id: 'customers', label: 'Người dùng', icon: Users },
  { id: 'salons', label: 'Đối tác/Salon', icon: Store }, { id: 'bookings', label: 'Lịch đặt', icon: CalendarDays },
  { id: 'payments', label: 'Thanh toán', icon: CreditCard }, { id: 'reviews', label: 'Đánh giá', icon: Star },
  { id: 'promotions', label: 'Khuyến mãi', icon: Tag }, { id: 'reports', label: 'Báo cáo', icon: FileText }, { id: 'settings', label: 'Cài đặt', icon: Settings },
];
export const AdminNav: React.FC<AdminNavProps> = ({ active, adminName, onNavigate, onHome, onLogout, controls }) => {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const toggle = useRef<HTMLButtonElement>(null); const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!open) return; close.current?.focus(); const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggle.current?.focus(); } }; document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, [open]);
  const closeMenu = () => { setOpen(false); toggle.current?.focus(); };
  const navigate = (section: AdminSection, value?: string) => { setOpen(false); onNavigate(section, value); };
  return <>
    {open && <button type="button" aria-label="Đóng menu quản trị" className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={closeMenu} />}
    <aside id="admin-sidebar" aria-label="Thanh quản trị" className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-50 w-60 flex-col border-r border-slate-200 bg-white px-4 py-5 shadow-xl lg:flex lg:shadow-none`}>
      <div className="mb-8 flex items-center justify-between px-3"><button type="button" aria-label="BeautyLink — về trang chủ" onClick={onHome} className="text-2xl font-black tracking-tight">Beauty<span className="text-pink-600">Link</span><span className="mt-1 block text-left text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Quản trị hệ thống</span></button><button ref={close} type="button" aria-label="Đóng menu" onClick={closeMenu} className="rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-600 lg:hidden"><X className="h-5 w-5" /></button></div>
      <nav aria-label="Điều hướng quản trị" className="min-h-0 flex-1 space-y-1 overflow-y-auto">{adminItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => navigate(id)} aria-current={active === id ? 'page' : undefined} className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-600 focus-visible:ring-inset ${active === id ? 'bg-pink-600 text-white shadow-sm shadow-pink-200' : 'text-slate-600 hover:bg-pink-50 hover:text-slate-900'}`}><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}</button>)}</nav>
      <button type="button" onClick={onHome} className="mt-5 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50"><Home className="h-4 w-4" />Về website</button>
    </aside>
    <header className="sticky top-0 z-30 flex min-h-16 min-w-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur lg:ml-60 lg:px-6">
      <button ref={toggle} type="button" aria-label="Mở menu quản trị" aria-expanded={open} aria-controls="admin-sidebar" onClick={() => setOpen(true)} className="rounded-xl border border-slate-200 p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-600 lg:hidden"><Menu className="h-5 w-5" /></button>
      <div className="mr-auto"><p className="text-xs text-slate-400">BeautyLink / Quản trị</p><p className="font-bold text-slate-800">{adminItems.find(i => i.id === active)?.label}</p></div>
      <form onSubmit={e => { e.preventDefault(); navigate('bookings', query.trim()); }} className="relative order-last w-full md:order-none md:w-60"><label className="sr-only" htmlFor="admin-global-search">Tìm lịch đặt</label><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input id="admin-global-search" value={query} onChange={e => setQuery(e.target.value)} maxLength={120} placeholder="Tìm mã lịch, khách, salon…" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100" /></form>
      <div className="flex min-w-0 items-center gap-2 border-l border-slate-200 pl-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink-100 font-bold text-pink-700">{adminName.charAt(0)}</span><span className="max-w-28 truncate text-sm font-semibold">{adminName}</span><button type="button" onClick={onLogout} aria-label="Đăng xuất" className="rounded-xl p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-600"><LogOut className="h-4 w-4" /></button></div>
      {controls && <div className="order-last w-full">{controls}</div>}
    </header>
  </>;
};
