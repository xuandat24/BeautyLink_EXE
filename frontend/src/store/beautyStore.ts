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
import { clearAccessToken } from '../services/beautyApi';

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

const CART_STORAGE_KEY = 'beautypink_cart_items_v2';
const SESSION_USER_KEY = 'beautylink_session_user';
const LEGACY_PROFILE_KEY = 'beautypink_user_profile_data_v2';

const loadSessionUser = (): CurrentUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const loadCartFromStorage = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    const cached = cache.get<CartItem[]>(STORAGE_KEYS.CART);
    if (Array.isArray(cached) && cached.length > 0) return cached;
  } catch (err) {
    console.error('Failed to load cart from localStorage:', err);
  }
  return [];
};

const persistCartToStorage = (items: CartItem[]) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
    cache.set(STORAGE_KEYS.CART, items);
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
  cartItems: CartItem[];
  appointments: BookingDetails[];
  currentUser: CurrentUser | null;
  favorites: string[];
  notifications: PushNotification[];
  soundEnabled: boolean;
}

let memoryState: MemoryState = {
  selectedCity: cache.get<string>(STORAGE_KEYS.CITY) || 'Chọn khu vực',
  selectedLocationId: cache.get<number | null>(STORAGE_KEYS.LOCATION_ID) ?? null,
  locationConfirmed: cache.get<boolean>(STORAGE_KEYS.LOCATION_CONFIRMED) ?? false,
  selectedIntentCategory: cache.get<string | null>(STORAGE_KEYS.INTENT_CATEGORY) ?? null,
  onboardingCompleted: cache.get<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETED) ?? false,
  cartItems: loadCartFromStorage(),
  appointments: [],
  currentUser: loadSessionUser(),
  favorites: cache.get<string[]>(STORAGE_KEYS.FAVORITES) || [],
  notifications: notificationService.getStoredNotifications(),
  soundEnabled: notificationService.isSoundEnabled(),
};

type StateListener = () => void;
const listeners = new Set<StateListener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function useBeautyStore() {
  const [state, setState] = useState(memoryState);

  useEffect(() => {
    const listener = () => setState({ ...memoryState });
    listeners.add(listener);

    // Sync cart across browser tabs and on storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY && e.newValue) {
        try {
          const synced = JSON.parse(e.newValue);
          if (Array.isArray(synced)) {
            memoryState.cartItems = synced;
            notify();
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 1. City & Location actions
  const setSelectedCity = useCallback((city: string) => {
    memoryState.selectedCity = city;
    cache.set(STORAGE_KEYS.CITY, city);
    notify();
  }, []);

  const setSelectedLocation = useCallback((id: number, name: string) => {
    memoryState.selectedLocationId = id;
    memoryState.selectedCity = name;
    memoryState.locationConfirmed = true;
    cache.set(STORAGE_KEYS.LOCATION_ID, id);
    cache.set(STORAGE_KEYS.CITY, name);
    cache.set(STORAGE_KEYS.LOCATION_CONFIRMED, true);
    notify();
  }, []);

  const completeOnboarding = useCallback((id: number, name: string, categorySlug: string = 'all') => {
    memoryState.selectedLocationId = id;
    memoryState.selectedCity = name;
    memoryState.locationConfirmed = true;
    memoryState.selectedIntentCategory = categorySlug;
    memoryState.onboardingCompleted = true;
    cache.set(STORAGE_KEYS.LOCATION_ID, id);
    cache.set(STORAGE_KEYS.CITY, name);
    cache.set(STORAGE_KEYS.LOCATION_CONFIRMED, true);
    cache.set(STORAGE_KEYS.INTENT_CATEGORY, categorySlug);
    cache.set(STORAGE_KEYS.ONBOARDING_COMPLETED, true);
    notify();
  }, []);

  const setSelectedIntentCategory = useCallback((categorySlug: string) => {
    memoryState.selectedIntentCategory = categorySlug;
    cache.set(STORAGE_KEYS.INTENT_CATEGORY, categorySlug);
    notify();
  }, []);

  const resetOnboarding = useCallback(() => {
    memoryState.onboardingCompleted = false;
    cache.set(STORAGE_KEYS.ONBOARDING_COMPLETED, false);
    notify();
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
    memoryState.currentUser = user;
    cache.delete(STORAGE_KEYS.USER);
    if (typeof window !== 'undefined') {
      if (user) sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
      else sessionStorage.removeItem(SESSION_USER_KEY);
    }
    notify();
  }, []);

  const logout = useCallback(() => {
    memoryState.currentUser = null;
    memoryState.appointments = [];
    memoryState.notifications = [];
    cache.delete(STORAGE_KEYS.USER);
    cache.delete(STORAGE_KEYS.APPOINTMENTS);
    notificationService.clearUserData();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_USER_KEY);
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
