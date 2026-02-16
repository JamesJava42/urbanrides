import { NextResponse } from 'next/server';
import { initializeApp } from 'firebase/app';
import { getDatabase, get, ref, update } from 'firebase/database';
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

export async function POST(request: Request) {
  try {
    const { rideId } = await request.json();
    if (!rideId) {
      return NextResponse.json({ success: false, error: 'Ride ID is required.' }, { status: 400 });
    }

    const rideRef = ref(db, `rides/${rideId}`);
    const snapshot = await get(rideRef);
    if (!snapshot.exists()) {
      return NextResponse.json({ success: false, error: 'Ride not found.' }, { status: 404 });
    }

    const ride = snapshot.val();
    const previousUpdates = Array.isArray(ride.updates) ? ride.updates : [];

    await update(rideRef, {
      status: 'CANCELLED',
      updatedAt: Date.now(),
      updates: [
        ...previousUpdates,
        {
          status: 'CANCELLED',
          note: 'Passenger cancelled ride',
          at: Date.now(),
        },
      ],
    });

    await postSlackMessage(
      [
        '❌ *Ride Cancelled*',
        `• Ride ID: ${rideId}`,
        `• Route: ${ride.pickup} -> ${ride.dropoff}`,
        `• Phone: ${ride.phone}`,
      ].join('\n'),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel ride error:', error);
    return NextResponse.json({ success: false, error: 'Unable to cancel ride.' }, { status: 500 });
  }
}
