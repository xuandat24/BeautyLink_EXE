import { PushNotification } from '../types';
import { cache } from '../lib/cache';
import {
  INITIAL_NOTIFICATIONS,
  SIMULATED_NOTIFICATION_POOL,
} from '../data/notificationsData';
import { playNotificationSound } from '../utils/audioNotification';

const NOTIFICATIONS_CACHE_KEY = 'user_notifications_v1';
const SOUND_SETTING_KEY = 'user_sound_enabled';
const SIM_SETTING_KEY = 'user_sim_enabled';

export const notificationService = {
  /**
   * Load notifications from cache or initial data
   */
  getStoredNotifications(): PushNotification[] {
    const cached = cache.get<PushNotification[]>(NOTIFICATIONS_CACHE_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
    cache.set(NOTIFICATIONS_CACHE_KEY, INITIAL_NOTIFICATIONS);
    return INITIAL_NOTIFICATIONS;
  },

  /**
   * Save notifications to cache (only writes if changed)
   */
  saveNotifications(notifs: PushNotification[]): void {
    cache.set(NOTIFICATIONS_CACHE_KEY, notifs);
  },

  /**
   * Sound preferences
   */
  isSoundEnabled(): boolean {
    const stored = cache.get<boolean>(SOUND_SETTING_KEY);
    return stored !== null ? stored : true;
  },

  setSoundEnabled(enabled: boolean): void {
    cache.set(SOUND_SETTING_KEY, enabled);
  },

  /**
   * Simulation toggle preferences
   */
  isAutoSimEnabled(): boolean {
    const stored = cache.get<boolean>(SIM_SETTING_KEY);
    return stored !== null ? stored : true;
  },

  setAutoSimEnabled(enabled: boolean): void {
    cache.set(SIM_SETTING_KEY, enabled);
  },

  /**
   * Play sound safely
   */
  playChime(): void {
    if (this.isSoundEnabled()) {
      playNotificationSound();
    }
  },

  /**
   * Generate next simulated push notification from pool
   */
  generateSimulated(index: number): PushNotification {
    const item = SIMULATED_NOTIFICATION_POOL[index % SIMULATED_NOTIFICATION_POOL.length];
    return {
      id: `notif-${Date.now()}`,
      type: item.type,
      title: item.title,
      message: item.message,
      timestamp: 'Vừa xong',
      createdAt: Date.now(),
      dealId: item.dealId,
      dealTitle: item.dealTitle,
      dealPrice: item.dealPrice,
      dealOriginalPrice: item.dealOriginalPrice,
      salonName: item.salonName,
      image: item.image,
      discountBadge: item.discountBadge,
      expiresIn: item.expiresIn,
      isRead: false,
    };
  },
};
