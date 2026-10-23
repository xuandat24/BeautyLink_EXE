import { useEffect, useState } from 'react';
import { beautyApi, getAccessToken } from '../services/beautyApi';
import { useBeautyStore } from '../store/beautyStore';
import { mapBackendUser } from '../lib/authUser';
import { initializeSession, peekAccessToken, receiveSessionStorage, recordUserActivity, sessionSnapshot, setSessionPhase, subscribeSession } from '../lib/authSession';

export function useSessionLifecycle() {
  const { setCurrentUser, logout } = useBeautyStore();
  // Child effects run before parent effects: mark restoration as checking on the first render.
  const [state, setState] = useState(() => peekAccessToken() ? { ...sessionSnapshot(), phase: 'checking' as const } : sessionSnapshot());
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeSession(() => {
      const next = sessionSnapshot(); setState(next);
      if (next.phase === 'anonymous') logout();
    });
    initializeSession(); setState(sessionSnapshot());
    return unsubscribe;
  }, [logout]);
  useEffect(() => {
    let stopped = false, verifying = false, lastHeartbeat = 0;
    const verify = async () => {
      const token = getAccessToken();
      if (!token || verifying) return;
      verifying = true; setSessionPhase('checking', token);
      try {
        const user = await beautyApi.me();
        if (!stopped && token === getAccessToken()) { setCurrentUser(mapBackendUser(user)); setSessionPhase('verified', token); }
      } catch {
        // Definitive 401 is handled centrally. Network, 403 and 5xx never prove revocation.
        if (!stopped && token === getAccessToken()) setSessionPhase('locked', token);
      } finally { verifying = false; }
    };
    if (getAccessToken() && sessionSnapshot().phase !== 'verified') void verify();
    const activity = (event: Event) => {
      if (!event.isTrusted) return;
      const token = getAccessToken(); // Check deadline before renewing it, including after sleep.
      if (!token) return;
      if (sessionSnapshot().phase !== 'verified') { void verify(); return; }
      if (!recordUserActivity()) return;
      const now = Date.now();
      if (now - lastHeartbeat < 15_000) return;
      lastHeartbeat = now;
      void beautyApi.sessionActivity().catch(() => {
        if (!stopped && token === getAccessToken()) setSessionPhase('locked', token);
      });
    };
    const resume = () => { if (document.visibilityState === 'visible' && getAccessToken()) void verify(); };
    const storage = (event: StorageEvent) => { receiveSessionStorage(event); };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(name => document.addEventListener(name, activity, { capture: true, passive: true }));
    window.addEventListener('storage', storage); window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    // Timers are merely UI assistance: every request and resume also checks wall-clock expiry.
    const timer = window.setInterval(() => { getAccessToken(); }, 1000);
    return () => {
      stopped = true; window.clearInterval(timer);
      events.forEach(name => document.removeEventListener(name, activity, true));
      window.removeEventListener('storage', storage); window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [retry, setCurrentUser]);
  return { ...state, retry: () => setRetry(value => value + 1), logout };
}
