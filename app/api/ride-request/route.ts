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
    const { pickup, dropoff, phone, date, time, price } = body;

    // --- SPRINT 1 SAFETY CHECK ---
    // If any required field is missing, stop immediately.
    if (!pickup || !dropoff || !phone || !date || !time) {
        return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const rideId = `ride_${Date.now()}`;

    // 1. Save to Firebase
    await set(ref(db, 'rides/' + rideId), {
      rideId,
      pickup,
      dropoff,
      phone,
      date,
      time,
      price,
      status: 'PENDING',
      createdAt: Date.now()
    });

    // 2. Send Telegram Card
    // (Notice we use callback_data="accept_..." to link the ID)
    const telegramMsg = `🚖 *NEW RIDE REQUEST*\n\n📍 *From:* ${pickup}\n🏁 *To:* ${dropoff}\n🕒 *Time:* ${time} (${date})\n💰 *Est. Price:* ${price}\n\n_Driver required!_`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        text: telegramMsg,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ ACCEPT RIDE", callback_data: `accept_${rideId}` }]
          ]
        }
      })
    });

    return NextResponse.json({ success: true, rideId });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}