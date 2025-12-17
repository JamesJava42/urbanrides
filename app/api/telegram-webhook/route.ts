import { NextResponse } from 'next/server';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, update, get, push, query, orderByChild, equalTo } from "firebase/database";

// --- CONFIG ---
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
const ADMIN_ID = "8500104449"; // Your Personal ID for Notifications

export async function POST(request: Request) {
  try {
    const updateData = await request.json();

    // ============================================================
    // PART A: BUTTON CLICKS (Accept, Arrived, Complete, Cancel)
    // ============================================================
    if (updateData.callback_query) {
      const callback = updateData.callback_query;
      const data = callback.data;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const driverName = callback.from.first_name;
      const driverUsername = callback.from.username || "NoUsername";

      // 1. ACCEPT
      if (data.startsWith('accept_')) {
        const rideId = data.split('_')[1];
        const snapshot = await get(ref(db, `rides/${rideId}`));
        const ride = snapshot.val();
        
        const mapLink = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ride.pickup)}`;

        await update(ref(db, `rides/${rideId}`), {
          status: 'ACCEPTED',
          driverName: driverName,
          driverUsername: driverUsername,
          driverId: callback.from.id // IMPORTANT: We save the Driver's ID here
        });

        // Update Driver's Message
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `✅ *ACCEPTED* \n\n📍 Pickup: ${ride.pickup}\n📞 Phone: ${ride.phone}\n\n_You can now chat with the passenger by replying to this message._`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: "🧭 NAVIGATE (Maps)", url: mapLink }],
                [{ text: "📍 I HAVE ARRIVED", callback_data: `arrived_${rideId}` }]
              ]
            }
          })
        });
      }

      // 2. ARRIVED
      else if (data.startsWith('arrived_')) {
        const rideId = data.split('_')[1];
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

      // 3. COMPLETE (Fixing Admin Notification)
      else if (data.startsWith('complete_')) {
        const rideId = data.split('_')[1];
        
        // Update DB
        await update(ref(db, `rides/${rideId}`), { status: 'COMPLETED' });

        // Tell Driver
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `🏁 *RIDE COMPLETED*\n\nGood job, ${driverName}! You are ready for the next one.`,
              parse_mode: 'Markdown'
            })
        });

        // NOTIFY ADMIN (You)
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                chat_id: ADMIN_ID, 
                text: `💰 *PAYMENT ALERT*\n\nRide ${rideId} was completed by ${driverName}.\nCheck Dashboard.` 
            })
        });
      }
    }

    // ============================================================
    // PART B: TEXT REPLIES (Driver Chatting Back)
    // ============================================================
    else if (updateData.message && updateData.message.text) {
        const text = updateData.message.text;
        const driverId = updateData.message.from.id;

        // Ignore commands like /start
        if (text.startsWith('/')) return NextResponse.json({ ok: true });

        // Find which ride this driver is currently active on
        // We look for rides where 'driverId' matches this person AND status is ACCEPTED or ARRIVED
        const ridesRef = ref(db, 'rides');
        const q = query(ridesRef, orderByChild('driverId'), equalTo(driverId));
        const snapshot = await get(q);

        if (snapshot.exists()) {
            const rides = snapshot.val();
            // Find the active one
            const activeRideId = Object.keys(rides).find(key => 
                rides[key].status === 'ACCEPTED' || rides[key].status === 'ARRIVED'
            );

            if (activeRideId) {
                // Push the driver's message to Firebase so the User sees it
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
    console.error("Webhook Error:", error);
    return NextResponse.json({ ok: false });
  }
}