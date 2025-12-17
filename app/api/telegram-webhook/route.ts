import { NextResponse } from 'next/server';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, update, get, push, query, orderByChild, equalTo } from "firebase/database";

// --- FIREBASE CONFIG ---
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
const ADMIN_ID = "8500104449"; 

export async function POST(request: Request) {
  try {
    const updateData = await request.json();
    console.log("Webhook received:", JSON.stringify(updateData)); // Debug Log

    // ============================================================
    // PART A: BUTTON CLICKS (Accept, Arrived, Complete, Cancel)
    // ============================================================
    if (updateData.callback_query) {
      const callback = updateData.callback_query;
      const data = callback.data; // e.g., "accept_ride_123"
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const driverName = callback.from.first_name;
      const driverUsername = callback.from.username || "NoUsername";

      // 1. HANDLE ACCEPT
      if (data.startsWith('accept_')) {
        const rideId = data.split('_')[1];
        
        // SAFETY CHECK: Get Data first
        const snapshot = await get(ref(db, `rides/${rideId}`));
        if (!snapshot.exists()) {
             console.error("Ride data missing for ID:", rideId);
             return NextResponse.json({ error: "Ride not found" });
        }
        const ride = snapshot.val();
        
        // FIXED MAP LINK (Standard Format)
        const encodedAddress = encodeURIComponent(ride.pickup);
        const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

        // Update Firebase
        await update(ref(db, `rides/${rideId}`), {
          status: 'ACCEPTED',
          driverName: driverName,
          driverUsername: driverUsername,
          driverId: callback.from.id 
        });

        // Update Telegram Message
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `✅ *ACCEPTED by ${driverName}*\n\n📍 *Pickup:* ${ride.pickup}\n📞 *Phone:* ${ride.phone}\n💰 *Price:* ${ride.price}\n\n_Reply to this message to chat with passenger._`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: "🧭 NAVIGATE (Google Maps)", url: mapLink }],
                [{ text: "📍 I HAVE ARRIVED", callback_data: `arrived_${rideId}` }]
              ]
            }
          })
        });
      }

      // 2. HANDLE ARRIVED
      else if (data.startsWith('arrived_')) {
        const rideId = data.split('_')[1];
        await update(ref(db, `rides/${rideId}`), { status: 'ARRIVED' });

        // Update buttons to show "Complete"
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                    [{ text: "🏁 COMPLETE RIDE", callback_data: `complete_${rideId}` }]
                ]
              }
            })
        });
      }

      // 3. HANDLE COMPLETE
      else if (data.startsWith('complete_')) {
        const rideId = data.split('_')[1];
        
        // Update DB
        await update(ref(db, `rides/${rideId}`), { status: 'COMPLETED' });

        // Finalize Message
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `🏁 *RIDE COMPLETED*\nDriver: ${driverName}\nGood job!`,
              parse_mode: 'Markdown'
            })
        });

        // NOTIFY ADMIN
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                chat_id: ADMIN_ID, 
                text: `💰 *PAYMENT ALERT*\nRide completed by ${driverName}.` 
            })
        });
      }
    }

    // ============================================================
    // PART B: TEXT REPLIES (Driver -> User Chat)
    // ============================================================
    else if (updateData.message && updateData.message.text) {
        const text = updateData.message.text;
        const driverId = updateData.message.from.id;

        // Ignore commands
        if (text.startsWith('/')) return NextResponse.json({ ok: true });

        // Find Active Ride for this Driver
        const ridesRef = ref(db, 'rides');
        const q = query(ridesRef, orderByChild('driverId'), equalTo(driverId));
        const snapshot = await get(q);

        if (snapshot.exists()) {
            const rides = snapshot.val();
            // Find the one that is NOT completed
            const activeRideId = Object.keys(rides).find(key => 
                rides[key].status === 'ACCEPTED' || rides[key].status === 'ARRIVED'
            );

            if (activeRideId) {
                // Send to User
                await push(ref(db, `rides/${activeRideId}/messages`), {
                    sender: 'driver',
                    text: text,
                    timestamp: Date.now()
                });
            }
        }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("WEBHOOK CRASH:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}