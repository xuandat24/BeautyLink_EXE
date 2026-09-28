import { useCallback, useEffect, useState } from 'react';
import type { BookingDetails, CartItem, CurrentUser, HotDeal, PushNotification } from '../types';
import { cache } from '../lib/cache';
import { clearAccessToken } from '../lib/api';
import { notificationService } from '../services/notificationService';

const STORAGE_KEYS = {
  CART: 'user_cart_items',
  APPOINTMENTS: 'user_appointments',
  USER: 'user_session',
  CITY: 'user_selected_city',
  LOCATION_ID: 'user_selected_location_id',
  LOCATION_CONFIRMED: 'user_location_confirmed',
  FAVORITES: 'user_favorites',
};

const SESSION_USER_KEY = 'beautylink_session_user';

const getSessionUser = () => {
  try {
    const value = sessionStorage.getItem(SESSION_USER_KEY);
    return value ? JSON.parse(value) as CurrentUser : null;
  } catch {
    return null;
  }
};

interface MemoryState {
  selectedCity: string;
  selectedLocationId: number | null;
  locationConfirmed: boolean;
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
  cartItems: cache.get<CartItem[]>(STORAGE_KEYS.CART) || [],
  appointments: cache.get<BookingDetails[]>(STORAGE_KEYS.APPOINTMENTS) || [],
  currentUser: cache.get<CurrentUser | null>(STORAGE_KEYS.USER) ?? getSessionUser(),
  favorites: cache.get<string[]>(STORAGE_KEYS.FAVORITES) || [],
  notifications: notificationService.getStoredNotifications(),
  soundEnabled: notificationService.isSoundEnabled(),
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function useBeautyStore() {
  const [state, setState] = useState(memoryState);

  useEffect(() => {
    const listener = () => setState({ ...memoryState });
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const setSelectedCity = useCallback((city: string) => {
    memoryState.selectedCity = city;
    cache.set(STORAGE_KEYS.CITY, city);
    notify();
  }, []);

  const setSelectedLocation = useCallback((id: number, label: string) => {
    memoryState.selectedLocationId = id;
    memoryState.selectedCity = label;
    memoryState.locationConfirmed = true;
    cache.set(STORAGE_KEYS.LOCATION_ID, id);
    cache.set(STORAGE_KEYS.CITY, label);
    cache.set(STORAGE_KEYS.LOCATION_CONFIRMED, true);
    notify();
  }, []);

  const addToCart = useCallback((deal: HotDeal) => {
    const existing = memoryState.cartItems.find((item) => item.deal.id === deal.id);
    memoryState.cartItems = existing
      ? memoryState.cartItems.map((item) => item.deal.id === deal.id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...memoryState.cartItems, { deal, quantity: 1 }];
    cache.set(STORAGE_KEYS.CART, memoryState.cartItems);
    notify();
  }, []);

  const updateCartQuantity = useCallback((dealId: string, quantity: number) => {
    memoryState.cartItems = quantity <= 0
      ? memoryState.cartItems.filter((item) => item.deal.id !== dealId)
      : memoryState.cartItems.map((item) => item.deal.id === dealId ? { ...item, quantity } : item);
    cache.set(STORAGE_KEYS.CART, memoryState.cartItems);
    notify();
  }, []);

  const removeFromCart = useCallback((dealId: string) => {
    memoryState.cartItems = memoryState.cartItems.filter((item) => item.deal.id !== dealId);
    cache.set(STORAGE_KEYS.CART, memoryState.cartItems);
    notify();
  }, []);

  const clearCart = useCallback(() => {
    memoryState.cartItems = [];
    cache.set(STORAGE_KEYS.CART, []);
    notify();
  }, []);

  const addAppointment = useCallback((appointment: BookingDetails) => {
    memoryState.appointments = [appointment, ...memoryState.appointments];
    cache.set(STORAGE_KEYS.APPOINTMENTS, memoryState.appointments);
    notify();
  }, []);

  const cancelAppointment = useCallback((index: number) => {
    memoryState.appointments = memoryState.appointments.filter((_, current) => current !== index);
    cache.set(STORAGE_KEYS.APPOINTMENTS, memoryState.appointments);
    notify();
  }, []);

  const setCurrentUser = useCallback((user: CurrentUser | null, rememberSession = true) => {
    memoryState.currentUser = user;
    if (rememberSession) {
      cache.set(STORAGE_KEYS.USER, user);
      sessionStorage.removeItem(SESSION_USER_KEY);
    } else {
      cache.delete(STORAGE_KEYS.USER);
      if (user) sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
      else sessionStorage.removeItem(SESSION_USER_KEY);
    }
    notify();
  }, []);

  const logout = useCallback(() => {
    memoryState.currentUser = null;
    cache.delete(STORAGE_KEYS.USER);
    sessionStorage.removeItem(SESSION_USER_KEY);
    clearAccessToken();
    notify();
  }, []);

  const setNotifications = useCallback((notifications: PushNotification[]) => {
    memoryState.notifications = notifications;
    notificationService.saveNotifications(notifications);
    notify();
  }, []);

  const addNotification = useCallback((notification: PushNotification) => {
    memoryState.notifications = [notification, ...memoryState.notifications].slice(0, 50);
    notificationService.saveNotifications(memoryState.notifications);
    notify();
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    memoryState.notifications = memoryState.notifications.map((item) => item.id === id ? { ...item, isRead: true } : item);
    notificationService.saveNotifications(memoryState.notifications);
    notify();
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    memoryState.notifications = memoryState.notifications.map((item) => ({ ...item, isRead: true }));
    notificationService.saveNotifications(memoryState.notifications);
    notify();
  }, []);

  const clearAllNotifications = useCallback(() => {
    memoryState.notifications = [];
    notificationService.saveNotifications([]);
    notify();
  }, []);

  const setSoundEnabled = useCallback((value: boolean | ((previous: boolean) => boolean)) => {
    memoryState.soundEnabled = typeof value === 'function' ? value(memoryState.soundEnabled) : value;
    notificationService.setSoundEnabled(memoryState.soundEnabled);
    notify();
  }, []);

  return {
    ...state,
    setSelectedCity,
    setSelectedLocation,
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
  };
}
