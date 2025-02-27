/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/notifications.ts
type NotificationType = 'danger-zone' | 'approach-zone' | 'update' | 'info';

interface NotificationOptions {
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

// Check if notifications are supported and permission is granted
export function canNotify(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  );
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  
  return await Notification.requestPermission();
}

// Display a notification
export function showNotification(
  type: NotificationType,
  options: NotificationOptions
): void {
  if (!canNotify()) return;

  // Set default properties based on notification type
  const defaultOptions: Partial<NotificationOptions> = {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    requireInteraction: type === 'danger-zone', // Only danger zone notifications require interaction
  };

  // Set vibration pattern based on notification type
  if (type === 'danger-zone') {
    defaultOptions.vibrate = [100, 50, 100, 50, 100, 50, 200];
    defaultOptions.tag = 'danger-zone';
  } else if (type === 'approach-zone') {
    defaultOptions.vibrate = [100, 50, 100];
    defaultOptions.tag = 'approach-zone';
  }

  // Merge default options with provided options
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Show the notification
  new Notification(mergedOptions.title, mergedOptions);
}

// Helper function to check if user is within a specific distance of a danger zone
export async function checkProximityToDangerZones(
  dangerZones: Array<{ location: { lat: number; lng: number } }>,
  distanceThreshold: number = 2 // Default 2km proximity alert
): Promise<boolean> {
  if (!('geolocation' in navigator)) return false;

  try {
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;

    // Check if any danger zone is within the threshold
    for (const zone of dangerZones) {
      const distance = calculateDistance(
        latitude,
        longitude,
        zone.location.lat,
        zone.location.lng
      );

      // If distance to zone center is less than 5km + threshold, user is approaching the zone
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

// Calculate distance between two points in km using the Haversine formula
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
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Promisify getCurrentPosition
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    });
  });
}