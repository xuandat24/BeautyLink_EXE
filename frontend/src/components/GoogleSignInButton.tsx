import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CredentialResponse, googleClientId, loadGoogleIdentityServices } from '../lib/googleIdentity';

interface Props {
  onCredential: (credential: string) => void;
  busy?: boolean;
  onUnavailable: (message: string) => void;
}

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
          if (response.credential) callback.current(response.credential);
          else unavailable.current('Google không trả về thông tin đăng nhập. Vui lòng thử lại.');
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      host.current.replaceChildren();
      window.google.accounts.id.renderButton(host.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
        shape: 'rectangular', logo_alignment: 'left', width: Math.min(420, host.current.clientWidth || 420),
        locale: 'vi',
      });
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
    <div className="relative min-h-11 w-full overflow-hidden rounded-xl">
      <div ref={host} className={busy ? 'pointer-events-none opacity-50' : ''} />
      {(loading || busy) && (
        <div className="absolute inset-0 grid place-items-center bg-white/85 text-xs font-bold text-slate-600">
          <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{busy ? 'Đang xác thực…' : 'Đang tải Google…'}</span>
        </div>
      )}
    </div>
  );
};
