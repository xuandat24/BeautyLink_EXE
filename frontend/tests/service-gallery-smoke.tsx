// Local-only form preview. No authentication, backend writes or real provider requests.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { SupplierServiceModal } from '../src/components/SupplierDashboard';

createRoot(document.getElementById('root')!).render(<SupplierServiceModal service={null}
  categories={[{ id: 1, name: 'Trang điểm', slug: 'makeup', description: '', imageUrl: '' }]}
  onClose={() => {}} onSave={async () => { throw new Error('Local preview only — no save or upload'); }} />);
