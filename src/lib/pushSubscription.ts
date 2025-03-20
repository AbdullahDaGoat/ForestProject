// src/lib/pushSubscriptions.ts
import * as webpush from 'web-push';

// In-memory array of push subscriptions
const subscriptions: webpush.PushSubscription[] = [];

// Provide functions to access or modify this array
export function getSubscriptions(): webpush.PushSubscription[] {
  return subscriptions;
}

export function addSubscription(sub: webpush.PushSubscription) {
  subscriptions.push(sub);
}
