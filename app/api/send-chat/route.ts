import { NextResponse } from 'next/server';
import { initializeApp } from 'firebase/app';
import { getDatabase, get, ref } from 'firebase/database';
import { postSlackMessage } from '@/lib/notifications';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: 'https://urbanride4244-default-rtdb.firebaseio.com/',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function POST(request: Request) {
  try {
    const { rideId, message } = await request.json();

    const snapshot = await get(ref(db, `rides/${rideId}`));
    if (!snapshot.exists()) return NextResponse.json({ success: false, error: 'Ride not found.' }, { status: 404 });

    const ride = snapshot.val();
    if (!ride.driverId) {
      await postSlackMessage(
        [
          '⚠️ *Passenger Message With No Driver Assigned*',
          `• Ride ID: ${rideId}`,
          `• Message: ${message}`,
          `• Suggested action: mark as COMMUNICATION_FAILED or NO_DRIVER_AVAILABLE in /admin`,
        ].join('\n'),
      );
      return NextResponse.json({ success: true, warning: 'No driver assigned yet.' });
    }

    if (BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ride.driverId,
          text: `💬 *Message from Passenger:*\n"${message}"`,
          parse_mode: 'Markdown',
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send chat error:', error);
    return NextResponse.json({ success: false, error: 'Unable to send message.' }, { status: 500 });
  }
}
