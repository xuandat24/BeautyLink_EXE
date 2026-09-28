import type { PushNotification } from '../types';
import { cache } from '../lib/cache';
import { playNotificationSound } from '../utils/audioNotification';

const NOTIFICATIONS_CACHE_KEY = 'user_notifications_v1';
const SOUND_SETTING_KEY = 'user_sound_enabled';
const MAX_STORED_NOTIFICATIONS = 50;

export const notificationService = {
  /**
   * Remove previously cached promotional simulations and keep only genuine
   * system notifications. This migration runs once for every existing browser.
   */
  getStoredNotifications(): PushNotification[] {
    const cached = cache.get<PushNotification[]>(NOTIFICATIONS_CACHE_KEY);
    const systemNotifications = Array.isArray(cached)
      ? cached.filter((notification) => notification.type === 'system').slice(0, MAX_STORED_NOTIFICATIONS)
      : [];
    cache.set(NOTIFICATIONS_CACHE_KEY, systemNotifications);
    return systemNotifications;
  },

  /**
   * Save notifications to cache (only writes if changed)
   */
  saveNotifications(notifs: PushNotification[]): void {
    cache.set(NOTIFICATIONS_CACHE_KEY, notifs.slice(0, MAX_STORED_NOTIFICATIONS));
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
   * Play sound safely
   */
  playChime(): void {
    if (this.isSoundEnabled()) {
      playNotificationSound();
    }
  },

};
