import { useState, useEffect, useCallback } from 'react';
import {
  CartItem,
  BookingDetails,
  CurrentUser,
  HotDeal,
  PushNotification,
} from '../types';
import { cache } from '../lib/cache';
import { notificationService } from '../services/notificationService';
import { beautyApi, clearAccessToken, getAccessToken } from '../services/beautyApi';
import { ONBOARDING_KEY, ONBOARDING_TTL, readOnboarding, type OnboardingSelection } from '../lib/onboarding';

const STORAGE_KEYS = {
  CART: 'user_cart_items',
  APPOINTMENTS: 'user_appointments',
  USER: 'user_session',
  CITY: 'user_selected_city',
  LOCATION_ID: 'user_selected_location_id',
  LOCATION_CONFIRMED: 'user_location_confirmed',
  INTENT_CATEGORY: 'user_selected_intent_category',
  ONBOARDING_COMPLETED: 'user_onboarding_completed',
  FAVORITES: 'user_favorites',
};

const CART_STORAGE_PREFIX = 'beautylink_cart_items_v4:';
const cartOwnerId = (user: CurrentUser | null): string | null => {
  const id = user?.id;
  return (typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
    || (typeof id === 'string' && /^[1-9]\d*$/.test(id)) ? String(id) : null;
};
const SESSION_USER_KEY = 'beautylink_session_user';
const LEGACY_PROFILE_KEY = 'beautylink_user_profile_data_v2';

const loadSessionUser = (): CurrentUser | null => {
  // Profiles are not credentials. Only a current backend response may populate currentUser.
  return null;
};

const parseCartItems = (value: unknown): CartItem[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((value: unknown): value is CartItem => {
    if (!value || typeof value !== 'object') return false;
    const { deal, quantity } = value as Partial<CartItem>;
    return Number.isSafeInteger(quantity) && (quantity ?? 0) > 0
      && Boolean(deal && typeof deal === 'object' && typeof deal.id === 'string' && deal.id.trim()
        && typeof deal.title === 'string' && deal.title.trim()
        && Number.isFinite(deal.salePrice) && deal.salePrice >= 0
        && Number.isFinite(deal.originalPrice) && deal.originalPrice >= 0);
  });
};

const parseStoredCart = (raw: string | null, ownerId: string): CartItem[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 4
      || !('ownerId' in parsed) || parsed.ownerId !== ownerId
      || !('source' in parsed) || parsed.source !== 'user-action' || !('items' in parsed)) return [];
    return parseCartItems(parsed.items);
  } catch {
    return [];
  }
};

export const loadCartFromStorage = (user: CurrentUser | null = loadSessionUser()): CartItem[] => {
  const ownerId = cartOwnerId(user);
  if (typeof window === 'undefined' || !ownerId) return [];
  try {
    // Unscoped legacy carts have no reliable owner and must never be imported.
    return parseStoredCart(localStorage.getItem(CART_STORAGE_PREFIX + ownerId), ownerId);
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
  return [];
};

const persistCartToStorage = (items: CartItem[]) => {
  const ownerId = cartOwnerId(memoryState.currentUser);
  if (!ownerId) return; // Guest selections live only in this page's memory.
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CART_STORAGE_PREFIX + ownerId, JSON.stringify({ version: 4, ownerId, source: 'user-action', items }));
    }
    cache.delete(STORAGE_KEYS.CART);
  } catch (err) {
    console.error('Failed to persist cart to localStorage:', err);
  }
};

interface MemoryState {
  selectedCity: string;
  selectedLocationId: number | null;
  locationConfirmed: boolean;
  selectedIntentCategory: string | null;
  onboardingCompleted: boolean;
  onboardingReady: boolean;
  cartItems: CartItem[];
  appointments: BookingDetails[];
  currentUser: CurrentUser | null;
  favorites: string[];
  notifications: PushNotification[];
  soundEnabled: boolean;
}

let memoryState: MemoryState = {
  selectedCity: 'Chọn khu vực',
  selectedLocationId: null,
  locationConfirmed: false,
  selectedIntentCategory: null,
  onboardingCompleted: false,
  onboardingReady: false,
  cartItems: loadCartFromStorage(),
  appointments: [],
  currentUser: loadSessionUser(),
  favorites: cache.get<string[]>(STORAGE_KEYS.FAVORITES) || [],
  notifications: [], // Legacy unscoped notification cache is not an authenticated account response.
  soundEnabled: notificationService.isSoundEnabled(),
};

type StateListener = () => void;
const listeners = new Set<StateListener>();

function notify() {
  listeners.forEach((listener) => listener());
}

let onboardingOptions: { locations: Array<{ id: number; name: string }>; categories: string[] } | null = null;
let onboardingDeadline: number | undefined;
const scheduleOnboardingExpiry = (selection: OnboardingSelection | null) => {
  if (onboardingDeadline !== undefined) window.clearTimeout(onboardingDeadline);
  onboardingDeadline = selection ? window.setTimeout(syncOnboarding, Math.max(1, selection.completedAt + ONBOARDING_TTL - Date.now())) : undefined;
};
const applyOnboarding = (selection: OnboardingSelection | null) => {
  memoryState = { ...memoryState, selectedCity: selection?.city ?? 'Chọn khu vực',
    selectedLocationId: selection?.locationId ?? null, selectedIntentCategory: selection?.category ?? null,
    locationConfirmed: Boolean(selection), onboardingCompleted: Boolean(selection) };
};
const syncOnboarding = () => {
  if (!onboardingOptions) return;
  let selection: OnboardingSelection | null = null;
  try { selection = readOnboarding(localStorage.getItem(ONBOARDING_KEY)); } catch { /* Empty in restricted storage. */ }
  const location = selection && onboardingOptions.locations.find(option => option.id === selection?.locationId);
  if (!location || (selection?.category !== 'all' && !onboardingOptions.categories.includes(selection?.category ?? ''))) selection = null;
  if (selection && location) selection = { ...selection, city: location.name };
  if (!selection) { try { localStorage.removeItem(ONBOARDING_KEY); } catch { /* storage unavailable */ } }
  scheduleOnboardingExpiry(selection);
  if (memoryState.onboardingReady && memoryState.selectedLocationId === (selection?.locationId ?? null)
    && memoryState.selectedCity === (selection?.city ?? 'Chọn khu vực')
    && memoryState.selectedIntentCategory === (selection?.category ?? null) && memoryState.onboardingCompleted === Boolean(selection)) return;
  applyOnboarding(selection); memoryState.onboardingReady = true; notify();
};

export function useBeautyStore() {
  const [state, setState] = useState(memoryState);

  useEffect(() => {
    const listener = () => setState({ ...memoryState });
    listeners.add(listener);

    // Sync cart across browser tabs and on storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.storageArea && e.storageArea !== localStorage) return;
      const ownerId = cartOwnerId(memoryState.currentUser);
      if (ownerId && (e.key === CART_STORAGE_PREFIX + ownerId || e.key === null)) {
        memoryState.cartItems = parseStoredCart(e.newValue, ownerId);
        notify();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const onboardingChanged = (event: StorageEvent) => { if (event.key === ONBOARDING_KEY || event.key === null) syncOnboarding(); };
    const resume = () => syncOnboarding();
    window.addEventListener('storage', onboardingChanged);
    window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume);

    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storage', onboardingChanged); window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
      if (!listeners.size && onboardingDeadline !== undefined) { window.clearTimeout(onboardingDeadline); onboardingDeadline = undefined; }
    };
  }, []);

  // 1. City & Location actions
  const setSelectedCity = useCallback((city: string) => {
    try { localStorage.removeItem(ONBOARDING_KEY); } catch { /* memory only */ }
    applyOnboarding(null);
    memoryState.selectedCity = city;
    notify();
  }, []);

  const setSelectedLocation = useCallback((id: number, name: string) => {
    try { localStorage.removeItem(ONBOARDING_KEY); } catch { /* memory only */ }
    applyOnboarding(null);
    memoryState.selectedLocationId = id;
    memoryState.selectedCity = name;
    notify();
  }, []);

  const completeOnboarding = useCallback((id: number, name: string, categorySlug: string = 'all') => {
    const location = onboardingOptions?.locations.find(location => location.id === id);
    if (!location
      || (categorySlug !== 'all' && !onboardingOptions?.categories.includes(categorySlug))) return;
    void name; // Retain callback compatibility; canonical display name comes from current API options.
    const selection: OnboardingSelection = { version: 1, completedAt: Date.now(), locationId: id, city: location.name, category: categorySlug };
    try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(selection)); } catch { /* Memory-only preference when storage is unavailable. */ }
    applyOnboarding(selection); scheduleOnboardingExpiry(selection); notify();
  }, []);

  const setSelectedIntentCategory = useCallback((categorySlug: string) => {
    let selection: OnboardingSelection | null = null;
    try { selection = readOnboarding(localStorage.getItem(ONBOARDING_KEY)); } catch { /* Restricted storage: do not restore an unverified preference. */ }
    if (selection && (categorySlug === 'all' || onboardingOptions?.categories.includes(categorySlug))) {
      const updated = { ...selection, category: categorySlug };
      try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(updated)); } catch { /* Memory only. */ }
      applyOnboarding(updated);
    }
    notify();
  }, []);

  const resetOnboarding = useCallback(() => {
    try { localStorage.removeItem(ONBOARDING_KEY); } catch { /* no persisted record */ }
    applyOnboarding(null); scheduleOnboardingExpiry(null);
    notify();
  }, []);
  const validateOnboardingOptions = useCallback((locations: Array<{ id: number; name: string }>, categories: string[]) => {
    onboardingOptions = { locations, categories };
    // Old permanent records have no trustworthy completion timestamp: clear only those five keys.
    [STORAGE_KEYS.CITY, STORAGE_KEYS.LOCATION_ID, STORAGE_KEYS.LOCATION_CONFIRMED, STORAGE_KEYS.INTENT_CATEGORY, STORAGE_KEYS.ONBOARDING_COMPLETED].forEach(key => cache.delete(key));
    syncOnboarding();
  }, []);

  // 2. Cart actions
  const addToCart = useCallback((deal: HotDeal) => {
    const existing = memoryState.cartItems.find((item) => item.deal.id === deal.id);
    let updated: CartItem[];
    if (existing) {
      updated = memoryState.cartItems.map((item) =>
        item.deal.id === deal.id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      updated = [...memoryState.cartItems, { deal, quantity: 1 }];
    }
    memoryState.cartItems = updated;
    persistCartToStorage(updated);
    notify();
  }, []);

  const updateCartQuantity = useCallback((dealId: string, quantity: number) => {
    const updated =
      quantity <= 0
        ? memoryState.cartItems.filter((i) => i.deal.id !== dealId)
        : memoryState.cartItems.map((i) =>
            i.deal.id === dealId ? { ...i, quantity } : i
          );
    memoryState.cartItems = updated;
    persistCartToStorage(updated);
    notify();
  }, []);

  const removeFromCart = useCallback((dealId: string) => {
    const updated = memoryState.cartItems.filter((i) => i.deal.id !== dealId);
    memoryState.cartItems = updated;
    persistCartToStorage(updated);
    notify();
  }, []);

  const clearCart = useCallback(() => {
    memoryState.cartItems = [];
    persistCartToStorage([]);
    notify();
  }, []);

  // 3. Appointments
  const addAppointment = useCallback((appointment: BookingDetails) => {
    const updated = [appointment, ...memoryState.appointments];
    memoryState.appointments = updated;
    notify();
  }, []);

  const cancelAppointment = useCallback((index: number) => {
    const updated = memoryState.appointments.filter((_, idx) => idx !== index);
    memoryState.appointments = updated;
    notify();
  }, []);

  // 4. User authentication
  const setCurrentUser = useCallback((user: CurrentUser | null) => {
    const previousUser = memoryState.currentUser;
    const ownerId = cartOwnerId(user);
    const sameAccount = ownerId !== null && ownerId === cartOwnerId(previousUser);
    if (!sameAccount) {
      const guestItems = previousUser === null && ownerId ? memoryState.cartItems : [];
      const savedItems = loadCartFromStorage(user);
      memoryState.cartItems = [...savedItems];
      for (const item of guestItems) {
        const saved = memoryState.cartItems.find((entry) => entry.deal.id === item.deal.id);
        if (!saved) memoryState.cartItems.push(item);
        else if (Number.isSafeInteger(saved.quantity + item.quantity)) saved.quantity += item.quantity;
      }
    }
    if (!sameAccount) {
      memoryState.appointments = [];
      memoryState.notifications = [];
      notificationService.clearUserData();
    }
    memoryState.currentUser = user;
    if (!sameAccount && ownerId) persistCartToStorage(memoryState.cartItems);
    cache.delete(STORAGE_KEYS.USER);
    if (typeof window !== 'undefined') { sessionStorage.removeItem(SESSION_USER_KEY); localStorage.removeItem(SESSION_USER_KEY); }
    notify();
  }, []);

  const logout = useCallback(() => {
    const token = getAccessToken();
    if (token) void beautyApi.logoutSession(token).catch(() => { /* Local logout is immediate; server also enforces idle/absolute expiry. */ });
    memoryState.currentUser = null;
    memoryState.cartItems = [];
    memoryState.appointments = [];
    memoryState.notifications = [];
    cache.delete(STORAGE_KEYS.USER);
    cache.delete(STORAGE_KEYS.APPOINTMENTS);
    notificationService.clearUserData();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_USER_KEY);
      localStorage.removeItem(SESSION_USER_KEY);
      localStorage.removeItem(LEGACY_PROFILE_KEY);
    }
    clearAccessToken();
    notify();
  }, []);

  // 5. Notifications
  const setNotifications = useCallback((notifs: PushNotification[]) => {
    memoryState.notifications = notifs;
    notificationService.saveNotifications(notifs);
    notify();
  }, []);

  const addNotification = useCallback((notif: PushNotification) => {
    const updated = [notif, ...memoryState.notifications].slice(0, 50);
    memoryState.notifications = updated;
    notificationService.saveNotifications(updated);
    notify();
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    const updated = memoryState.notifications.map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    memoryState.notifications = updated;
    notificationService.saveNotifications(updated);
    notify();
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    const updated = memoryState.notifications.map((n) => ({ ...n, isRead: true }));
    memoryState.notifications = updated;
    notificationService.saveNotifications(updated);
    notify();
  }, []);

  const clearAllNotifications = useCallback(() => {
    memoryState.notifications = [];
    notificationService.saveNotifications([]);
    notify();
  }, []);

  // 6. Sound
  const setSoundEnabled = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(memoryState.soundEnabled) : value;
    memoryState.soundEnabled = next;
    notificationService.setSoundEnabled(next);
    notify();
  }, []);

  // 7. Favorites
  const toggleFavorite = useCallback((id: string) => {
    const exists = memoryState.favorites.includes(id);
    const updated = exists
      ? memoryState.favorites.filter((f) => f !== id)
      : [...memoryState.favorites, id];
    memoryState.favorites = updated;
    cache.set(STORAGE_KEYS.FAVORITES, updated);
    notify();
    return !exists; // true = added, false = removed
  }, []);

  const isFavorite = useCallback((id: string) => {
    return memoryState.favorites.includes(id);
  }, []);

  return {
    ...state,
    setSelectedCity,
    setSelectedLocation,
    completeOnboarding,
    setSelectedIntentCategory,
    resetOnboarding,
    validateOnboardingOptions,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    addAppointment,
    cancelAppointment,
    setCurrentUser,
    logout,
    setNotifications,
    addNotification,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
    setSoundEnabled,
    toggleFavorite,
    isFavorite,
  };
}
