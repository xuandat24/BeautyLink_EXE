import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CredentialResponse, googleClientId, loadGoogleIdentityServices } from '../lib/googleIdentity';

interface Props {
  onCredential: (credential: string) => void;
  busy?: boolean;
  onUnavailable: (message: string) => void;
}

export const googleButtonOptions = {
  // The official GIS icon button cannot show a previously used name/email.
  type: 'icon', theme: 'outline', size: 'large', shape: 'circle', locale: 'vi',
} as const;

export const GoogleSignInButton: React.FC<Props> = ({ onCredential, busy = false, onUnavailable }) => {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const unavailable = useRef(onUnavailable);
  unavailable.current = onUnavailable;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const clientId = googleClientId();
    if (!clientId) {
      setLoading(false);
      return;
    }
    loadGoogleIdentityServices().then(() => {
      if (!active || !host.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: CredentialResponse) => {
          if (!active) return;
          if (response.credential) callback.current(response.credential);
          else unavailable.current('Google không trả về thông tin đăng nhập. Vui lòng thử lại.');
        },
        auto_select: false,
        button_auto_select: false,
        cancel_on_tap_outside: true,
      });
      host.current.replaceChildren();
      window.google.accounts.id.renderButton(host.current, googleButtonOptions);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
      unavailable.current('Không thể tải đăng nhập Google. Vui lòng kiểm tra mạng hoặc dùng đăng nhập hiện có.');
    });
    return () => { active = false; };
  }, []);

  if (!googleClientId()) return (
    <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] font-semibold text-amber-800">
      Đăng nhập Google chưa được cấu hình cho môi trường này.
    </p>
  );

  return (
    <div className="relative mx-auto flex min-h-12 w-full max-w-56 items-center justify-center gap-2 rounded-xl" role="group" aria-label="Đăng nhập bằng Google">
      <div ref={host} className={busy ? 'pointer-events-none shrink-0 opacity-50' : 'shrink-0'} />
      <span className="text-xs font-semibold text-slate-600">Đăng nhập với Google</span>
      {(loading || busy) && (
        <div className="absolute inset-0 grid place-items-center rounded-xl bg-white/90 text-xs font-bold text-slate-600">
          <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{busy ? 'Đang xác thực…' : 'Đang tải Google…'}</span>
        </div>
      )}
    </div>
  );
};
