import React from 'react';
import { adminStatusGroups, adminStatusPresentation } from './adminStatus';

const tones: Record<string, string> = {
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
  amber: 'border-amber-200 bg-amber-100 text-amber-900',
  blue: 'border-blue-200 bg-blue-100 text-blue-900',
  green: 'border-emerald-200 bg-emerald-100 text-emerald-900',
  rose: 'border-rose-200 bg-rose-100 text-rose-900',
  violet: 'border-violet-200 bg-violet-100 text-violet-900',
  pink: 'border-pink-200 bg-pink-100 text-pink-900',
  teal: 'border-teal-200 bg-teal-100 text-teal-900',
};
export function AdminStatusBadge({ kind, value }: { kind: keyof typeof adminStatusGroups; value: string | null | undefined }) {
  const status = adminStatusPresentation(kind, value);
  return <span data-admin-status={kind} className={`inline-flex max-w-full items-center rounded-full border px-2 py-1 text-xs font-semibold leading-4 ${tones[status.tone] ?? tones.slate}`}>{status.label}</span>;
}
