// Local Vite fixture only; not imported by the production application or build entry point.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { Header } from '../src/components/Header';
import { CartDrawer } from '../src/components/CartDrawer';
import type { HotDeal } from '../src/types';

const deal: HotDeal = { id: 'migration-fixture', title: 'Test 1', brandName: 'Nail nhà Chuối', brandLogo: '',
  image: '/assets/beauty-placeholder.svg', originalPrice: 11000, salePrice: 11000, discountPercent: 0,
  rating: 0, reviewsCount: 0, duration: '30 phút', category: 'spa', highlightText: '' };
// Set up only this local origin once. Reload then exercises actual new-cart persistence.
if (!sessionStorage.getItem('cart-migration-fixture-initialized')) {
  localStorage.setItem('beautylink_cart_items_v2', JSON.stringify([{ deal, quantity: 1 }]));
  localStorage.removeItem('beautylink_cart_items_v3');
  sessionStorage.setItem('cart-migration-fixture-initialized', 'true');
}
const { useBeautyStore } = await import('../src/store/beautyStore');
function Smoke() {
  const store = useBeautyStore();
  return <>
    <Header cartCount={store.cartItems.length} onOpenCart={() => {}} onOpenPartnerModal={() => {}}
      onOpenAuthModal={() => {}} onSearch={() => {}} />
    <main><h1>Kiểm tra giỏ cũ: không tự khôi phục</h1><button onClick={() => store.addToCart({ ...deal, id: 'new-choice', title: 'Dịch vụ chủ động chọn' })}>Thêm lựa chọn mới</button></main>
    <CartDrawer isOpen items={store.cartItems} onClose={() => {}} onRemoveItem={store.removeFromCart}
      onClearCart={store.clearCart} onCheckout={() => { throw new Error('No checkout allowed in migration smoke'); }}
      legacyCartCount={store.legacyCartItems.length} onRestoreLegacyCart={store.restoreLegacyCart} />
  </>;
}
createRoot(document.getElementById('root')!).render(<Smoke />);
