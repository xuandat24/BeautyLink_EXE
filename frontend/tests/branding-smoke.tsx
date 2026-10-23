// Local browser QA only; does not call APIs or alter authentication/storage.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { Header } from '../src/components/Header';

function Frame() {
  const [action, setAction] = useState('Chưa thao tác');
  useEffect(() => {
    let active = true;
    const report = () => {
      if (!active) return;
      const image = document.querySelector('header img') as HTMLImageElement | null;
      window.parent.postMessage({ type: 'branding-qa', name: window.frameElement?.getAttribute('title'),
        width: window.innerWidth, content: document.documentElement.scrollWidth, action,
        logoLoaded: image?.naturalWidth, headerHeight: document.querySelector('header')?.getBoundingClientRect().height }, location.origin);
    };
    const observer = new ResizeObserver(report);
    observer.observe(document.body);
    void document.fonts.ready.then(report);
    const image = document.querySelector('header img');
    image?.addEventListener('load', report);
    return () => { active = false; observer.disconnect(); image?.removeEventListener('load', report); };
  }, [action]);
  return <><Header cartCount={2} notifications={[]} selectedCity="Hà Nội"
    currentUser={location.search.includes('signed') ? { id: 1, name: 'Khách hàng kiểm thử', role: 'CUSTOMER' } : null}
    onOpenCart={() => setAction('Giỏ hàng')} onOpenLocationModal={() => setAction('Khu vực')}
    onOpenAuthModal={() => setAction('Đăng nhập')} onOpenPartnerModal={() => setAction('Đối tác')}
    onSearch={() => setAction('Tìm kiếm')} /><output>{action}</output></>;
}
function Review() {
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin === location.origin && event.data?.type === 'branding-qa') {
        setMetrics(previous => ({ ...previous, [event.data.name]: JSON.stringify(event.data) }));
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  return <main><h1>Kiểm tra Header chính thức — local</h1><pre>{Object.values(metrics).join('\n')}</pre>{[320, 375, 430, 768, 1024, 1920].map(width =>
    <section key={width}><h2>{width}px</h2><iframe title={`Header ${width}`} width={width} height={220}
      src="/tests/branding-smoke.html?frame" className="border border-slate-300" /></section>)}
    <h2>320px đã đăng nhập</h2><iframe title="Header signed 320" width={320} height={250} src="/tests/branding-smoke.html?frame&signed" /></main>;
}
createRoot(document.getElementById('root')!).render(location.search.includes('frame') ? <Frame /> : <Review />);
