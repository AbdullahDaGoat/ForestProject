// src/app/api/save-subscription/route.ts
import { NextResponse } from 'next/server';
import * as webpush from 'web-push';

// -----------------------------------------------------
// 1) Keep all push subscriptions in this module scope
//    so they persist in memory across requests.
// -----------------------------------------------------
const subscriptions: webpush.PushSubscription[] = [];

// -----------------------------------------------------
// 2) VAPID Keys & Setup
//    (Use your actual public/private keys here.)
// -----------------------------------------------------
const VAPID_PUBLIC_KEY = 'BMIlphB5UNplAcbs-4nVB9eHiIyawSQbd65fu8jm52PN4K5D_VYOhbwjcHDoCfXc02zl8xSYB0Rto8_zc6r3Qcs';
const VAPID_PRIVATE_KEY = 'nHsNJydV8QDe8QGAJt3snIsInFYj08sf9saZ5hBCGaA';

webpush.setVapidDetails(
  'mailto:abdullahaviator13@gmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/**
 * Export a helper so other routes can retrieve
 * the same `subscriptions` array
 */
export function getAllSubscriptions() {
  return subscriptions;
}

/**
 * POST /api/save-subscription
 * Save a new push subscription in memory
 */
export async function POST(request: Request) {
  try {
    // Parse the request body as JSON
    const subscription = (await request.json()) as webpush.PushSubscription;

    // Add it to our in-memory list
    subscriptions.push(subscription);
    console.log('Subscription saved:', subscription);

    // Return success
    return NextResponse.json({ message: 'Subscription saved successfully.' }, { status: 201 });
  } catch (error) {
    console.error('Error saving subscription:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}
