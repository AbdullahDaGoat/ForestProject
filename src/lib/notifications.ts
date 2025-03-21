/* eslint-disable @typescript-eslint/no-explicit-any */

type NotificationType = 'danger-zone' | 'approach-zone' | 'update' | 'info';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  vibrate?: number[];
  requireInteraction?: boolean;
}

/**
 * Check if notifications are supported and permission is granted.
 */
export function canNotify(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  );
}

/**
 * Request notification permission.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return await Notification.requestPermission();
}

/**
 * Display a notification.
 * This function exclusively uses the service worker's showNotification method
 * to avoid the "Illegal constructor" issue on mobile.
 *
 * @param {NotificationType} type - The type of notification.
 * @param {NotificationOptions} options - Options for the notification.
 */
export async function showNotification(
  type: NotificationType,
  options: NotificationOptions
): Promise<void> {
  // If we can’t notify (e.g. permission not granted or no Notification support), exit.
  if (!canNotify()) return;

  // Set default options based on notification type.
  const defaultOptions: Partial<NotificationOptions> = {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    requireInteraction: type === 'danger-zone',
  };

  // Add sensible vibrations/tags for certain notification types.
  if (type === 'danger-zone') {
    defaultOptions.vibrate = [100, 50, 100, 50, 100, 50, 200];
    defaultOptions.tag = 'danger-zone';
  } else if (type === 'approach-zone') {
    defaultOptions.vibrate = [100, 50, 100];
    defaultOptions.tag = 'approach-zone';
  }

  // Merge default options with the provided ones.
  const mergedOptions = { ...defaultOptions, ...options };

  // Always use the service worker approach — never call "new Notification(...)" directly.
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(mergedOptions.title, mergedOptions);
    } catch (err) {
      console.error('Error showing notification via service worker:', err);
    }
  }
}

/**
 * Helper function to check if user is within a specific distance of a danger zone.
 * Returns true if any danger zone is within (5km + distanceThreshold) of the user.
 */
export async function checkProximityToDangerZones(
  dangerZones: Array<{ location: { lat: number; lng: number } }>,
  distanceThreshold: number = 2
): Promise<boolean> {
  if (!('geolocation' in navigator)) return false;

  try {
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;

    for (const zone of dangerZones) {
      const distance = calculateDistance(
        latitude,
        longitude,
        zone.location.lat,
        zone.location.lng
      );

      // If distance to zone center is less than 5km + threshold:
      if (distance < 5 + distanceThreshold) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error getting user location:', error);
    return false;
  }
}

/**
 * Calculate distance between two points in km using the Haversine formula.
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians.
 */
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Promisify getCurrentPosition.
 */
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    });
  });
}
