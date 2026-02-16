import { NextResponse } from 'next/server';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import {
  DISTANCE_TOLERANCE_MILES,
  MAX_TRIP_MILES,
  calculateFare,
  getRegionName,
  isInsideServiceArea,
  milesBetweenPoints,
  toPriceLabel,
} from '@/lib/rideRules';
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
    const body = await request.json();
    const { pickup, dropoff, pickupLat, pickupLng, dropoffLat, dropoffLng, phone, email, date, time, riderMiles } = body;

    if (!pickup || !dropoff || !phone || !email || !date || !time || riderMiles === undefined) {
      return NextResponse.json({ success: false, error: 'Please complete all fields.' }, { status: 400 });
    }

    const milesValue = Number(riderMiles);
    if (Number.isNaN(milesValue) || milesValue <= 0) {
      return NextResponse.json({ success: false, error: 'Please enter a valid one-way miles value.' }, { status: 400 });
    }

    if (milesValue > MAX_TRIP_MILES) {
      return NextResponse.json(
        { success: false, error: `Maximum allowed trip is ${MAX_TRIP_MILES} miles.` },
        { status: 400 },
      );
    }

    if (
      pickupLat === null ||
      pickupLng === null ||
      dropoffLat === null ||
      dropoffLng === null ||
      Number.isNaN(Number(pickupLat)) ||
      Number.isNaN(Number(pickupLng)) ||
      Number.isNaN(Number(dropoffLat)) ||
      Number.isNaN(Number(dropoffLng))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please choose pickup and dropoff from the suggestions so we can verify service area.',
        },
        { status: 400 },
      );
    }

    const pickupLatNum = Number(pickupLat);
    const pickupLngNum = Number(pickupLng);
    const dropoffLatNum = Number(dropoffLat);
    const dropoffLngNum = Number(dropoffLng);

    if (!isInsideServiceArea(pickupLatNum, pickupLngNum) || !isInsideServiceArea(dropoffLatNum, dropoffLngNum)) {
      return NextResponse.json(
        {
          success: false,
          error: `This service currently supports only ${getRegionName()} area rides.`,
        },
        { status: 400 },
      );
    }

    const systemMiles = milesBetweenPoints(pickupLatNum, pickupLngNum, dropoffLatNum, dropoffLngNum);
    if (Math.abs(systemMiles - milesValue) > DISTANCE_TOLERANCE_MILES) {
      return NextResponse.json(
        {
          success: false,
          error: `Entered miles differs from estimated miles (${systemMiles.toFixed(1)}). Please review your input.`,
        },
        { status: 400 },
      );
    }

    const fareAmount = calculateFare(milesValue);
    const price = toPriceLabel(fareAmount);
    const rideId = `ride_${Date.now()}`;

    await set(ref(db, `rides/${rideId}`), {
      rideId,
      pickup,
      dropoff,
      pickupLat: pickupLatNum,
      pickupLng: pickupLngNum,
      dropoffLat: dropoffLatNum,
      dropoffLng: dropoffLngNum,
      phone,
      email,
      date,
      time,
      riderMiles: Number(milesValue.toFixed(1)),
      estimatedMiles: Number(systemMiles.toFixed(1)),
      price,
      fareAmount,
      region: getRegionName(),
      status: 'PENDING',
      createdAt: Date.now(),
      updates: [
        {
          status: 'PENDING',
          note: 'Ride requested by passenger',
          at: Date.now(),
        },
      ],
    });

    await postSlackMessage(
      [
        '🚕 *New Ride Request*',
        `• Ride ID: ${rideId}`,
        `• Region: ${getRegionName()}`,
        `• From: ${pickup}`,
        `• To: ${dropoff}`,
        `• Miles (rider): ${milesValue.toFixed(1)}`,
        `• Miles (system): ${systemMiles.toFixed(1)}`,
        `• Fare: ${price}`,
        `• Date/Time: ${date} ${time}`,
        `• Phone: ${phone}`,
        `• Email: ${email}`,
      ].join('\n'),
    );

    return NextResponse.json({ success: true, rideId, price, estimatedMiles: Number(systemMiles.toFixed(1)) });
  } catch (error) {
    console.error('Ride request error:', error);
    return NextResponse.json({ success: false, error: 'Server error while creating ride.' }, { status: 500 });
  }
}
