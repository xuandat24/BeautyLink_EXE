// Local Vite fixture only; not imported by the production application or build entry point.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { Header } from '../src/components/Header';
import { CartDrawer } from '../src/components/CartDrawer';
import type { HotDeal } from '../src/types';

const deal: HotDeal = { id: 'migration-fixture', title: 'Test 1', brandName: 'Nail nhà Chuối', brandLogo: '',
  image: '/assets/beauty-placeholder.svg', originalPrice: 11000, salePrice: 11000, discountPercent: 0,
  rating: 0, reviewsCount: 0, duration: '30 phút', category: 'spa', highlightText: '' };
// Set up only this local origin once. Reload then exercises actual new-cart persistence.
if (!sessionStorage.getItem('account-cart-fixture-initialized')) {
  localStorage.setItem('beautylink_cart_items_v2', JSON.stringify([{ deal, quantity: 1 }]));
  sessionStorage.setItem('account-cart-fixture-initialized', 'true');
}
const { useBeautyStore } = await import('../src/store/beautyStore');
function Smoke() {
  const store = useBeautyStore();
  const [open, setOpen] = useState(false);
  return <>
    <Header cartCount={store.cartItems.length} onOpenCart={() => setOpen(true)} onOpenPartnerModal={() => {}}
      onOpenAuthModal={() => {}} onSearch={() => {}} />
    <main><h1>Kiểm tra giỏ theo tài khoản (local only)</h1>
      <p>Người dùng: {store.currentUser?.name ?? 'Khách'} — Giỏ: {store.cartItems.length}</p>
      <button onClick={() => store.setCurrentUser({ id: 900001, name: 'Tài khoản A', role: 'CUSTOMER' })}>Tài khoản A</button>{' | '}
      <button onClick={() => store.setCurrentUser({ id: 900002, name: 'Tài khoản B', role: 'CUSTOMER' })}>Tài khoản B</button>{' | '}
      <button onClick={store.logout}>Đăng xuất</button>{' | '}
      <button onClick={() => store.addToCart({ ...deal, id: 'new-choice', title: 'Dịch vụ chủ động chọn' })}>Thêm lựa chọn mới</button>{' | '}
      <button onClick={() => setOpen(true)}>Mở giỏ</button>
    </main>
    <CartDrawer isOpen={open} items={store.cartItems} onClose={() => setOpen(false)} onRemoveItem={store.removeFromCart}
      onCheckout={() => { throw new Error('No checkout allowed in cart smoke'); }} />
  </>;
}
createRoot(document.getElementById('root')!).render(<Smoke />);
