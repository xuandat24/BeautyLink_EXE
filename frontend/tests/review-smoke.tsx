// Test-only Vite entry. Not part of the production index.html build.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookingsPage } from '../src/components/BookingsPage';
import { FilterExplorePage } from '../src/components/FilterExplorePage';
import { CategoryServicePage } from '../src/components/CategoryServicePage';
import { PartnerDetailPage } from '../src/components/PartnerDetailPage';
import { AccountPage } from '../src/components/AccountPage';
import { AppointmentsModal } from '../src/components/AppointmentsModal';
import { CheckoutPage } from '../src/components/CheckoutPage';
import { beautyApi, apiClient, getAccessToken } from '../src/services/beautyApi';
import { setSessionPhase } from '../src/lib/authSession';
import { serviceReviewSummary, supplierReviewSummary } from '../src/lib/reviewScope';
import type { BackendService, CurrentUser, HotDeal, NewPartner } from '../src/types';
import '../src/index.css';

if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) throw new Error('Local test only');
// Reload/back tests reuse the real session and verify /me instead of consuming
// another password login on every document load (all CI scripts share one IP).
const existingToken = getAccessToken();
const auth = existingToken ? { user: await beautyApi.me() }
  : await beautyApi.login('0900000001', 'BeautyLinkTest123!');
if (auth.user.phone !== '0900000001' || auth.user.role !== 'CUSTOMER') throw new Error('Unexpected smoke fixture identity');
// Same gate as useSessionLifecycle: only a successful real /me for the unchanged
// credential unlocks authenticated reads. Do not reinstall/refresh the token.
if (existingToken && !setSessionPhase('verified', existingToken)) throw new Error('Smoke session changed during verification');
const bookings = await beautyApi.myBookings();
const fixture = bookings.find(b => b.bookingCode === 'SMOKE-PAST-DEPOSIT');
if (!fixture) throw new Error('Use BookingReviewSmokeServer, never a production backend');
const user: CurrentUser = { ...auth.user, name: auth.user.fullName ?? auth.user.name };
const initial = (await apiClient.get<BackendService>(`/v1/services/${fixture.serviceId}`)).data;
const pending = bookings.find(b => b.bookingCode === 'SMOKE-PENDING-LINK');
if (!pending) throw new Error('Use the updated local smoke server');
const checkoutDate = pending.appointmentDate;

function Harness() {
  const [view, setView] = useState('Bookings');
  const [service, setService] = useState(initial);
  const [selectedPartner, setSelectedPartner] = useState<NewPartner | null>(null);
  const deal: HotDeal = { id: `display-service-${service.id}`, serviceId: service.id, supplierId: service.supplierId,
    title: service.name, brandName: service.supplierName, brandLogo: '', image: service.imageUrl,
    originalPrice: service.price, salePrice: service.price, discountPercent: 0, duration: '60 phút', category: 'spa', highlightText: '', ...serviceReviewSummary(service) };
  const partner: NewPartner = { id: `new-supplier-${service.supplierId}`, serviceId: service.id, supplierId: service.supplierId,
    name: service.supplierName, subTitle: '', address: service.supplierAddress, image: service.imageUrl, logo: '', specialty: service.name, promoNotice: '', ...supplierReviewSummary(service) };
  return <><nav>{['Bookings', 'Account', 'Appointments', 'Checkout', 'Explore', 'Service', 'Partner'].map(name => <button key={name} type="button" onClick={async () => {
    setService((await apiClient.get<BackendService>(`/v1/services/${fixture!.serviceId}`)).data); setView(name);
  }}>{name}</button>)}</nav>
    {view === 'Bookings' && <BookingsPage onBack={() => {}} onBookNew={() => {}} />}
    {view === 'Account' && <AccountPage currentUser={user} onBackToHome={() => {}} onNavigateLogin={() => {}} />}
    {view === 'Appointments' && <AppointmentsModal isOpen appointments={[]} onClose={() => setView('Bookings')} onBookNew={() => {}} />}
    {view === 'Checkout' && <CheckoutPage currentUser={user} directService={service} preselectedDate={checkoutDate} preselectedTime="13:00" onBack={() => setView('Bookings')} onViewBookings={() => setView('Bookings')} onNeedLogin={() => {}} />}
    {view === 'Explore' && <FilterExplorePage onBack={() => {}} onBookDeal={() => {}} onAddToCart={() => {}} deals={[deal]} salons={[]} partners={[partner]} />}
    {view === 'Service' && <CategoryServicePage category={{ id: 1, slug: service.categorySlug, name: 'Smoke services', description: '', imageUrl: '' }} currentUser={user} locationId={null} locationLabel="Smoke" onBack={() => {}} onNeedLogin={() => {}} onBookingCreated={() => {}} onSelectPartner={(nextPartner) => { setSelectedPartner(nextPartner); setView('Partner'); }} />}
    {view === 'Partner' && <PartnerDetailPage partner={selectedPartner || partner} currentUser={user} onBack={() => {}} onNeedLogin={() => {}} onBookService={() => {}} />}
  </>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
