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
    
    // 1. BUTTON CLICKS (Accept, Arrived, Complete)
    if (updateData.callback_query) {
      const callback = updateData.callback_query;
      const data = callback.data; 
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const driverName = callback.from.first_name || "Driver";
      const driverUsername = callback.from.username || "NoUsername";

      // --- HANDLE ACCEPT ---
      if (data.startsWith('accept_')) {
        // FIX: Use replace to get the full correct ID (e.g., "ride_123456")
        const rideId = data.replace('accept_', '');
        
        console.log("Attempting to accept ride:", rideId); // Debug Log

        // CRITICAL SAFETY CHECK
        const snapshot = await get(ref(db, `rides/${rideId}`));
        if (!snapshot.exists()) {
             console.error(`❌ Ride ${rideId} not found in DB!`);
             // Determine if we should alert the user or fail silently
             return NextResponse.json({ ok: true }); 
        }
        const ride = snapshot.val();
        
        // FIX: Correct Google Maps URL and Syntax
        const encodedAddress = encodeURIComponent(ride.pickup || "Unknown Location");
        const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

        // 1. Update Firebase (This triggers the Frontend Change)
        await update(ref(db, `rides/${rideId}`), {
          status: 'ACCEPTED',
          driverName: driverName,
          driverUsername: driverUsername,
          driverId: callback.from.id 
        });

        // 2. Update Telegram Message (Driver Interface)
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `✅ *ACCEPTED by ${driverName}*\n\n📍 *Pickup:* ${ride.pickup}\n📞 *Phone:* ${ride.phone}\n💰 *Price:* ${ride.price}\n\n_Reply to chat with passenger._`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: "🧭 Open Google Maps", url: mapLink }],
                [{ text: "📍 I HAVE ARRIVED", callback_data: `arrived_${rideId}` }]
              ]
            }
          })
        });
      }

      // --- HANDLE ARRIVED ---
      else if (data.startsWith('arrived_')) {
        const rideId = data.replace('arrived_', '');
        
        await update(ref(db, `rides/${rideId}`), { status: 'ARRIVED' });

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

      // --- HANDLE COMPLETE ---
      else if (data.startsWith('complete_')) {
        const rideId = data.replace('complete_', '');
        
        await update(ref(db, `rides/${rideId}`), { status: 'COMPLETED' });

        // Tell Driver
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `🏁 *RIDE COMPLETED*\n\nDriver: ${driverName}\nGood job!`,
              parse_mode: 'Markdown'
            })
        });

        // Notify Admin
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                chat_id: ADMIN_ID, 
                text: `💰 *PAYMENT ALERT*\n\nRide ID: ${rideId}\nDriver: ${driverName}\nStatus: COMPLETED` 
            })
        });
      }
    }

    // 2. TEXT MESSAGES (Chat Bridge)
    else if (updateData.message && updateData.message.text) {
        const text = updateData.message.text;
        const driverId = updateData.message.from.id;

        if (text.startsWith('/')) return NextResponse.json({ ok: true });

        const ridesRef = ref(db, 'rides');
        const q = query(ridesRef, orderByChild('driverId'), equalTo(driverId));
        const snapshot = await get(q);

        if (snapshot.exists()) {
            const rides = snapshot.val();
            const activeRideId = Object.keys(rides).find(key => 
                rides[key].status === 'ACCEPTED' || rides[key].status === 'ARRIVED'
            );

            if (activeRideId) {
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
    console.error("WEBHOOK ERROR:", error);
    return NextResponse.json({ ok: true });
  }
}