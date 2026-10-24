type CredentialResponse = { credential?: string; select_by?: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: { client_id: string; callback: (response: CredentialResponse) => void; auto_select?: boolean; button_auto_select?: boolean; cancel_on_tap_outside?: boolean }): void;
          renderButton(element: HTMLElement, options: Record<string, unknown>): void;
          disableAutoSelect(): void;
        };
      };
    };
  }
}

const SCRIPT_ID = 'beautylink-google-identity-services';
let sdkPromise: Promise<void> | null = null;

export const googleClientId = (): string => (import.meta.env?.VITE_GOOGLE_CLIENT_ID || '').trim();

export const loadGoogleIdentityServices = (): Promise<void> => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing || document.createElement('script');
    const timer = window.setTimeout(() => reject(new Error('GOOGLE_SDK_TIMEOUT')), 15_000);
    const done = () => { window.clearTimeout(timer); window.google?.accounts?.id ? resolve() : reject(new Error('GOOGLE_SDK_UNAVAILABLE')); };
    const failed = () => { window.clearTimeout(timer); sdkPromise = null; reject(new Error('GOOGLE_SDK_LOAD_FAILED')); };
    script.addEventListener('load', done, { once: true });
    script.addEventListener('error', failed, { once: true });
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return sdkPromise;
};

export const disableGoogleAutoSelect = () => {
  try { window.google?.accounts?.id.disableAutoSelect(); } catch { /* BeautyLink logout must not sign out Google itself. */ }
};

export type { CredentialResponse };
