import { NextResponse } from 'next/server';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";

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

export async function POST(request: Request) {
    try {
        const { rideId, message } = await request.json();
        
        // Get Driver ID from Ride Data
        const snapshot = await get(ref(db, `rides/${rideId}`));
        if (!snapshot.exists()) return NextResponse.json({ success: false });
        
        const ride = snapshot.val();
        if (!ride.driverId) return NextResponse.json({ success: false, error: "No driver assigned" });

        // Send to Telegram
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: ride.driverId,
                text: `💬 *Message from Passenger:*\n"${message}"`,
                parse_mode: 'Markdown'
            })
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false });
    }
}