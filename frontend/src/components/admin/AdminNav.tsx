import React from 'react';
import { BarChart3, CalendarDays, CreditCard, FileText, Home, LogOut, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AdminSection = 'overview' | 'bookings' | 'customers' | 'payments' | 'reports';

interface AdminNavProps {
  active: AdminSection;
  adminName: string;
  onNavigate: (section: AdminSection) => void;
  onHome: () => void;
  onLogout: () => void;
}

const items: Array<{ id: AdminSection; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
  { id: 'bookings', label: 'Lịch hẹn', icon: CalendarDays },
  { id: 'customers', label: 'Khách hàng', icon: Users },
  { id: 'payments', label: 'Thanh toán', icon: CreditCard },
  { id: 'reports', label: 'Phản hồi', icon: FileText },
];

export const AdminNav: React.FC<AdminNavProps> = ({ active, adminName, onNavigate, onHome, onLogout }) => (
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <button type="button" onClick={onHome} className="inline-flex items-center gap-2 text-lg font-black tracking-tight">
          <span>Beauty<span className="text-pink-600">Link</span> Admin</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-bold text-slate-500 sm:inline">{adminName}</span>
          <button type="button" onClick={onHome} aria-label="Về trang chủ" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:text-pink-700">
            <Home className="h-4 w-4" />
          </button>
          <button type="button" onClick={onLogout} aria-label="Đăng xuất" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:text-rose-700">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      <nav aria-label="Điều hướng quản trị" className="flex gap-1 overflow-x-auto pb-3">
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => onNavigate(id)} aria-current={active === id ? 'page' : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${active === id ? 'bg-pink-600 text-white' : 'text-slate-600 hover:bg-pink-50 hover:text-pink-700'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>
    </div>
  </header>
);
