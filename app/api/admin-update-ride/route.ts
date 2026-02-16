import { NextResponse } from 'next/server';
import { initializeApp } from 'firebase/app';
import { getDatabase, get, ref, update } from 'firebase/database';
import { RideLifecycleStatus, STATUS_LABELS } from '@/lib/rideRules';
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

const allowedStatuses = new Set<RideLifecycleStatus>([
  'PENDING',
  'ACCEPTED',
  'ARRIVED',
  'COMPLETED',
  'CANCELLED',
  'FAILED_PICKUP',
  'COMMUNICATION_FAILED',
  'PASSENGER_NO_SHOW',
  'NO_DRIVER_AVAILABLE',
]);

export async function POST(request: Request) {
  try {
    const adminKey = request.headers.get('x-admin-key');
    if (!process.env.ADMIN_DASHBOARD_KEY || adminKey !== process.env.ADMIN_DASHBOARD_KEY) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rideId, status, note, driverName, driverPhone } = body as {
      rideId?: string;
      status?: RideLifecycleStatus;
      note?: string;
      driverName?: string;
      driverPhone?: string;
    };

    if (!rideId || !status || !allowedStatuses.has(status)) {
      return NextResponse.json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
    }

    const rideRef = ref(db, `rides/${rideId}`);
    const snapshot = await get(rideRef);
    if (!snapshot.exists()) {
      return NextResponse.json({ success: false, error: 'Ride not found.' }, { status: 404 });
    }

    const ride = snapshot.val();
    const previousUpdates = Array.isArray(ride.updates) ? ride.updates : [];
    const updateNote = note?.trim() || STATUS_LABELS[status];

    const payload: Record<string, unknown> = {
      status,
      updatedAt: Date.now(),
      updates: [...previousUpdates, { status, note: updateNote, at: Date.now() }],
    };

    if (driverName) payload.driverName = driverName;
    if (driverPhone) payload.driverPhone = driverPhone;

    await update(rideRef, payload);

    await postSlackMessage(
      [
        '📣 *Ride Status Updated*',
        `• Ride ID: ${rideId}`,
        `• New Status: ${STATUS_LABELS[status]}`,
        `• Note: ${updateNote}`,
        `• Passenger: ${ride.phone ?? 'N/A'} / ${ride.email ?? 'N/A'}`,
      ].join('\n'),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin update error:', error);
    return NextResponse.json({ success: false, error: 'Server error while updating ride.' }, { status: 500 });
  }
}
