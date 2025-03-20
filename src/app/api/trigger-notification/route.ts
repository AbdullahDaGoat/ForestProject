// src/app/api/trigger-notification/route.ts
import { NextResponse } from 'next/server';
import * as webpush from 'web-push';
import { getAllSubscriptions } from '../save-subscription/route';

export async function POST(request: Request) {
  try {
    // Pull out whatever the client sends: { title, body, data }
    const { title, body, data } = await request.json();
    const payload = JSON.stringify({ title, body, data });

    // Grab the same subscription list from /save-subscription
    const subscriptions = getAllSubscriptions();

    // Send notifications to each subscriber
    const sendPromises = subscriptions.map(sub =>
      webpush.sendNotification(sub, payload).catch(err => {
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
