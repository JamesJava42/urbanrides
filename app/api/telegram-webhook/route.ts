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
const ADMIN_ID = "8500104449"; // Admin ID for payment alerts

export async function POST(request: Request) {
  try {
    const updateData = await request.json();

    // ============================================================
    // A. DRIVER VERIFICATION (Saving Phone Number)
    // ============================================================
    if (updateData.message && updateData.message.contact) {
        const contact = updateData.message.contact;
        const driverId = updateData.message.from.id;
        
        // Save Driver to Database
        await update(ref(db, `drivers/${driverId}`), {
            name: contact.first_name,
            phone: contact.phone_number,
            telegramId: driverId
        });

        // Confirm to Driver
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: updateData.message.chat.id,
                text: `✅ *Number Verified!*\n\nYou can now go back and click "ACCEPT" on the ride request.`
            })
        });
        return NextResponse.json({ ok: true });
    }

    // ============================================================
    // B. BUTTON CLICKS (The Main Logic)
    // ============================================================
    if (updateData.callback_query) {
      const callback = updateData.callback_query;
      const data = callback.data; 
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const driverTelegramId = callback.from.id;

      // --- 1. ACCEPT RIDE ---
      if (data.startsWith('accept_')) {
        const rideId = data.replace('accept_', '');
        
        // STEP 1: CHECK IF WE KNOW THIS DRIVER
        const driverSnapshot = await get(ref(db, `drivers/${driverTelegramId}`));
        
        // If driver is UNVERIFIED -> Stop them & Ask for Phone
        if (!driverSnapshot.exists()) {
             await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    chat_id: chatId, 
                    text: `⚠ *Action Required*\n\nHey ${callback.from.first_name}, to accept rides, we need your phone number for the passenger.\n\nClick the button below to share it once.`,
                    reply_markup: {
                        keyboard: [[{ text: "📱 Share My Phone Number", request_contact: true }]],
                        one_time_keyboard: true,
                        resize_keyboard: true
                    }
                })
             });
             return NextResponse.json({ ok: true });
        }

        // STEP 2: CHECK THE LOCK (Sprint 3)
        // Ensure the ride hasn't been taken by someone else in the last second
        const rideSnapshot = await get(ref(db, `rides/${rideId}`));
        if (!rideSnapshot.exists()) return NextResponse.json({ ok: true });
        
        const ride = rideSnapshot.val();

        if (ride.status !== 'PENDING') {
            // Ride is already taken
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `⚠️ *TOO LATE!*\n\nAnother driver has already accepted this ride.`,
                    parse_mode: 'Markdown'
                })
            });
            // Ideally delete the button to stop others clicking
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
                 method: 'POST',
                 headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({ chat_id: chatId, message_id: messageId })
            });
            return NextResponse.json({ ok: true });
        }

        // STEP 3: ASSIGN THE DRIVER (Success)
        const driverData = driverSnapshot.val();
        const encodedAddress = encodeURIComponent(ride.pickup || "");
        // Link logic can be improved later with lat/lng
        const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

        // Update Firebase (This triggers the Frontend change)
        await update(ref(db, `rides/${rideId}`), {
          status: 'ACCEPTED',
          driverName: driverData.name,
          driverPhone: driverData.phone, // Sending Verified Phone
          driverId: driverTelegramId 
        });

        // Update Telegram Card (Show navigation buttons)
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `✅ *ACCEPTED by ${driverData.name}*\n\n📍 Pickup: ${ride.pickup}\n📞 Pax: ${ride.phone}\n💰 Price: ${ride.price}`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: "🧭 Open Google Maps", url: mapLink }],
                [{ text: "📍 I HAVE ARRIVED", callback_data: `arrived_${rideId}` }],
                [{ text: "❌ CANCEL RIDE", callback_data: `cancel_${rideId}` }]
              ]
            }
          })
        });
      }

      // --- 2. DRIVER ARRIVED ---
      else if (data.startsWith('arrived_')) {
        const rideId = data.replace('arrived_', '');
        await update(ref(db, `rides/${rideId}`), { status: 'ARRIVED' });
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              reply_markup: { inline_keyboard: [[{ text: "🏁 COMPLETE RIDE", callback_data: `complete_${rideId}` }]] }
            })
        });
      }

      // --- 3. COMPLETE RIDE ---
      else if (data.startsWith('complete_')) {
        const rideId = data.replace('complete_', '');
        await update(ref(db, `rides/${rideId}`), { status: 'COMPLETED' });
        
        // Notify Driver
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: `🏁 *RIDE COMPLETED*` })
        });
        
        // Notify Admin (You)
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ chat_id: ADMIN_ID, text: `💰 MONEY: Ride ${rideId} Finished.` })
        });
      }

      // --- 4. CANCEL RIDE (By Driver) ---
      else if (data.startsWith('cancel_')) {
          const rideId = data.replace('cancel_', '');
          await update(ref(db, `rides/${rideId}`), { status: 'CANCELLED' });
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: `❌ RIDE CANCELLED by Driver` })
          });
      }
    }

    // ============================================================
    // C. CHAT BRIDGE (Driver Text -> User Website)
    // ============================================================
    else if (updateData.message && updateData.message.text) {
        const text = updateData.message.text;
        const driverId = updateData.message.from.id;
        
        // Ignore commands
        if (text.startsWith('/')) return NextResponse.json({ ok: true });

        // Find the active ride for this driver
        const ridesRef = ref(db, 'rides');
        const q = query(ridesRef, orderByChild('driverId'), equalTo(driverId));
        const snapshot = await get(q);

        if (snapshot.exists()) {
            const rides = snapshot.val();
            // Look for a ride that is ACTIVE (Accepted or Arrived)
            const activeRideId = Object.keys(rides).find(key => 
                rides[key].status === 'ACCEPTED' || rides[key].status === 'ARRIVED'
            );

            if (activeRideId) {
                // Push message to Firebase so Frontend sees it
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