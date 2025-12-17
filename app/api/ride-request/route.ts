import { NextResponse } from 'next/server';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: "https://urbanride4244-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pickup, dropoff, pickupLat, pickupLng, phone, date, time } = body;

    if (!pickup || !dropoff) return NextResponse.json({ success: false }, { status: 400 });

    const rideId = `ride_${Date.now()}`;
    const price = "$25.00"; // Fixed price

    // 1. Generate Link
    // If coords exist (from AddressSearch), use them. Else use text.
    let mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup)}`;
    if (pickupLat && pickupLng) {
        mapLink = `https://www.google.com/maps/search/?api=1&query=${pickupLat},${pickupLng}`;
    }

    // 2. Save
    await set(ref(db, 'rides/' + rideId), {
      rideId, pickup, dropoff, phone, date, time, price, status: 'PENDING',
      pickupLat, pickupLng, createdAt: Date.now()
    });

    // 3. Alert
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        text: `🚖 *NEW RIDE*\n📍 ${pickup}\n🏁 ${dropoff}\n💰 ${price}`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: "🧭 Open Map", url: mapLink }], [{ text: "✅ ACCEPT", callback_data: `accept_${rideId}` }]] }
      })
    });

    return NextResponse.json({ success: true, rideId });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}