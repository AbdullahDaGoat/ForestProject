// src/app/api/trigger-notification/route.ts
import { NextResponse } from 'next/server';
import * as webpush from 'web-push';
import { getSubscriptions } from '../../../lib/pushSubscription';

// POST /api/trigger-notification
export async function POST(request: Request) {
  try {
    const { title, body, data } = await request.json();
    const payload = JSON.stringify({ title, body, data });

    const subs = getSubscriptions();
    const sendPromises = subs.map((sub) =>
      webpush.sendNotification(sub, payload).catch((err) => {
        console.error('Error sending notification:', err);
      })
    );
    await Promise.all(sendPromises);

    return NextResponse.json({ message: 'Notifications sent.' });
  } catch (error) {
    console.error('Error triggering notification:', error);
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 });
  }
}
