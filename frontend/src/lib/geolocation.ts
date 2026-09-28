export interface BrowserCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: 'device' | 'network';
  label?: string;
}

export type LocationFailureCode = 'UNSUPPORTED' | 'INSECURE_CONTEXT' | 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN';

export class LocationFailure extends Error {
  constructor(public readonly code: LocationFailureCode) {
    super(code);
    this.name = 'LocationFailure';
  }
}

const requestPosition = (options: PositionOptions) => new Promise<GeolocationPosition>((resolve, reject) => {
  navigator.geolocation.getCurrentPosition(resolve, reject, options);
});

const mapPositionError = (error: GeolocationPositionError) => {
  if (error.code === error.PERMISSION_DENIED) return new LocationFailure('PERMISSION_DENIED');
  if (error.code === error.POSITION_UNAVAILABLE) return new LocationFailure('UNAVAILABLE');
  if (error.code === error.TIMEOUT) return new LocationFailure('TIMEOUT');
  return new LocationFailure('UNKNOWN');
};

interface NetworkLocationResponse {
  success: boolean;
  message?: string;
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

const getNetworkCoordinates = async (): Promise<BrowserCoordinates> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetch(
      'https://ipwho.is/?fields=success,message,city,region,country,latitude,longitude',
      { signal: controller.signal, cache: 'no-store' },
    );
    if (!response.ok) throw new Error(`Network location failed with HTTP ${response.status}`);

    const data = await response.json() as NetworkLocationResponse;
    if (!data.success || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
      throw new Error(data.message || 'Network location is unavailable');
    }

    return {
      latitude: Number(data.latitude!.toFixed(7)),
      longitude: Number(data.longitude!.toFixed(7)),
      accuracy: null,
      source: 'network',
      label: [data.city, data.region, data.country].filter(Boolean).join(', '),
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export async function getBrowserCoordinates(): Promise<BrowserCoordinates> {
  if (!navigator.geolocation) {
    try {
      return await getNetworkCoordinates();
    } catch {
      throw new LocationFailure('UNSUPPORTED');
    }
  }
  if (!window.isSecureContext) {
    try {
      return await getNetworkCoordinates();
    } catch {
      throw new LocationFailure('INSECURE_CONTEXT');
    }
  }

  try {
    if (navigator.permissions?.query) {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state === 'denied') throw new LocationFailure('PERMISSION_DENIED');
    }
  } catch (error) {
    if (error instanceof LocationFailure) throw error;
    // Some browsers do not expose geolocation through the Permissions API.
  }

  let position: GeolocationPosition;
  try {
    // Wi-Fi/network positioning is normally faster and more reliable on laptops.
    // A cached browser position is acceptable here and avoids making the user wait.
    position = await requestPosition({ enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 });
  } catch (positionError) {
    const mapped = mapPositionError(positionError as GeolocationPositionError);
    if (mapped.code === 'PERMISSION_DENIED') throw mapped;
    try {
      return await getNetworkCoordinates();
    } catch {
      throw mapped;
    }
  }

  return {
    latitude: Number(position.coords.latitude.toFixed(7)),
    longitude: Number(position.coords.longitude.toFixed(7)),
    accuracy: Math.round(position.coords.accuracy),
    source: 'device',
  };
}

export function getLocationFailureMessage(error: unknown, language: 'vi' | 'en' = 'vi') {
  const code = error instanceof LocationFailure ? error.code : 'UNKNOWN';
  const messages = {
    vi: {
      UNSUPPORTED: 'Trình duyệt này không hỗ trợ định vị. Hãy nhập tọa độ thủ công.',
      INSECURE_CONTEXT: 'GPS chỉ hoạt động trên HTTPS hoặc localhost. Hãy mở đúng http://localhost:5173 thay vì địa chỉ IP trong mạng.',
      PERMISSION_DENIED: 'Quyền vị trí đang bị chặn. Bấm biểu tượng ổ khóa cạnh thanh địa chỉ, chọn Vị trí → Cho phép, rồi thử lại.',
      UNAVAILABLE: 'Thiết bị chưa xác định được vị trí. Hãy bật Location Services/Wi‑Fi hoặc nhập tọa độ từ Google Maps.',
      TIMEOUT: 'Định vị mất quá nhiều thời gian. Hãy bật Wi‑Fi hoặc Location Services rồi thử lại.',
      UNKNOWN: 'Không thể lấy vị trí. Hãy kiểm tra quyền vị trí hoặc nhập tọa độ thủ công.',
    },
    en: {
      UNSUPPORTED: 'This browser does not support location services. Enter the coordinates manually.',
      INSECURE_CONTEXT: 'GPS requires HTTPS or localhost. Open http://localhost:5173 instead of a local network IP address.',
      PERMISSION_DENIED: 'Location access is blocked. Click the lock icon beside the address bar, set Location to Allow, and retry.',
      UNAVAILABLE: 'Your device could not determine its location. Enable Location Services/Wi-Fi or enter coordinates from Google Maps.',
      TIMEOUT: 'Location detection timed out. Enable Wi-Fi or Location Services and retry.',
      UNKNOWN: 'Unable to get your location. Check location permission or enter the coordinates manually.',
    },
  } as const;
  return messages[language][code];
}
