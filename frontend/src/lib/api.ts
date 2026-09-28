import axios from 'axios';

export const AUTH_TOKEN_KEY = 'beautylink_access_token';
const SESSION_AUTH_TOKEN_KEY = 'beautylink_session_access_token';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(SESSION_AUTH_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function saveAccessToken(token: string, rememberSession = true) {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_AUTH_TOKEN_KEY);
  (rememberSession ? localStorage : sessionStorage).setItem(
    rememberSession ? AUTH_TOKEN_KEY : SESSION_AUTH_TOKEN_KEY,
    token,
  );
}

export function clearAccessToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_AUTH_TOKEN_KEY);
}

export function getApiErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.') {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
