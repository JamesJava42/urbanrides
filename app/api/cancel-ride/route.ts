import { NextResponse } from 'next/server';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, update, get } from "firebase/database";

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
        const { rideId } = await request.json();
        
        const rideRef = ref(db, `rides/${rideId}`);
        const snapshot = await get(rideRef);
        const ride = snapshot.val();

        // 1. Update DB
        await update(rideRef, { status: 'CANCELLED' });

        // 2. Notify Driver (if assigned)
        if (ride.driverId) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    chat_id: ride.driverId,
                    text: `❌ *RIDE CANCELLED*\n\nThe passenger cancelled the ride.`
                })
            });
        } else {
            // 3. If no driver yet, notify Group to stop searching
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    chat_id: GROUP_ID,
                    text: `❌ *CANCELLED REQUEST*\n\nRide from ${ride.pickup} was cancelled.`
                })
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false });
    }
}