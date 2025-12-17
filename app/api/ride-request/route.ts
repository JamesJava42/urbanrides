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
const GROUP_ID = process.env.TELEGRAM_GROUP_ID; // Make sure this is set in Vercel!

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pickup, dropoff, pickupLat, pickupLng, phone, date, time } = body;

    // Validation
    if (!pickup || !dropoff) return NextResponse.json({ success: false }, { status: 400 });

    const rideId = `ride_${Date.now()}`;
    const price = "$25.00"; 

    // 1. GENERATE CORRECT MAP LINK (Fixed)
    // We use the standard universal Google Maps URL
    let mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup)}`;
    
    // If we have coordinates, use them for precision
    if (pickupLat && pickupLng) {
        mapLink = `https://www.google.com/maps/search/?api=1&query=${pickupLat},${pickupLng}`;
    }

    // 2. SAVE TO FIREBASE
    await set(ref(db, 'rides/' + rideId), {
      rideId, pickup, dropoff, phone, date, time, price, status: 'PENDING',
      pickupLat: pickupLat || null, // Ensure no undefined values
      pickupLng: pickupLng || null,
      createdAt: Date.now()
    });

    // 3. SEND ALERT TO TELEGRAM
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        text: `🚖 *NEW RIDE REQUEST*\n\n📍 *From:* ${pickup}\n🏁 *To:* ${dropoff}\n\n💰 *Price:* ${price}\n📞 *Phone:* \`${phone}\``,
        parse_mode: 'Markdown',
        reply_markup: { 
            inline_keyboard: [
                [{ text: "🧭 Open Map", url: mapLink }], 
                [{ text: "✅ ACCEPT RIDE", callback_data: `accept_${rideId}` }]
            ] 
        }
      })
    });

    if (!res.ok) {
        console.error("Telegram Error:", await res.text());
    }

    return NextResponse.json({ success: true, rideId });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}