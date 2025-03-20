// src/app/api/save-subscription/route.ts
import { NextResponse } from 'next/server';
import * as webpush from 'web-push';
import { addSubscription } from '../../../lib/pushSubscription';

// -----------------------------------------------------
// 1) Keep all push subscriptions in this module scope
//    so they persist in memory across requests.
// -----------------------------------------------------
// -----------------------------------------------------
// 2) VAPID Keys & Setup
//    (Use your actual public/private keys here.)
// -----------------------------------------------------
const VAPID_PUBLIC_KEY = 'BMIlphB5UNplAcbs-4nVB9eHiIyawSQbd65fu8jm52PN4K5D_VYOhbwjcHDoCfXc02zl8xSYB0Rto8_zc6r3Qcs';
const VAPID_PRIVATE_KEY = 'nHsNJydV8QDe8QGAJt3snIsInFYj08sf9saZ5hBCGaA';

webpush.setVapidDetails(
    'mailto:test@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  
  // POST /api/save-subscription
  export async function POST(request: Request) {
    try {
      const sub = (await request.json()) as webpush.PushSubscription;
      addSubscription(sub);
      console.log('Subscription saved:', sub);
      return NextResponse.json({ message: 'Subscription saved successfully.' }, { status: 201 });
    } catch (err) {
      console.error('Failed to save subscription:', err);
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }
  }