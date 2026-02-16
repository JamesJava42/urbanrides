import { NextResponse } from 'next/server';
import { initializeApp } from 'firebase/app';
import { equalTo, get, getDatabase, orderByChild, push, query, ref, update } from 'firebase/database';
import { telegramApiRequest } from '@/lib/telegram';

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
const adminTelegramId = process.env.TELEGRAM_ADMIN_ID;

export async function POST(request: Request) {
  try {
    const updateData = await request.json();

    if (updateData.message && updateData.message.contact) {
      const contact = updateData.message.contact;
      const driverId = updateData.message.from.id;

      await update(ref(db, `drivers/${driverId}`), {
        name: contact.first_name,
        phone: contact.phone_number,
        telegramId: driverId,
      });

      await telegramApiRequest('sendMessage', {
        chat_id: updateData.message.chat.id,
        text: '✅ *Number Verified!*\n\nYou can now go back and click "ACCEPT" on the ride request.',
      });
      return NextResponse.json({ ok: true });
    }

    if (updateData.callback_query) {
      const callback = updateData.callback_query;
      const data = callback.data;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const driverTelegramId = callback.from.id;

      if (data.startsWith('accept_')) {
        const rideId = data.replace('accept_', '');
        const driverSnapshot = await get(ref(db, `drivers/${driverTelegramId}`));

        if (!driverSnapshot.exists()) {
          await telegramApiRequest('sendMessage', {
            chat_id: chatId,
            text: `⚠ *Action Required*\n\nHey ${callback.from.first_name}, to accept rides, we need your phone number for the passenger.\n\nClick the button below to share it once.`,
            reply_markup: {
              keyboard: [[{ text: '📱 Share My Phone Number', request_contact: true }]],
              one_time_keyboard: true,
              resize_keyboard: true,
            },
          });
          return NextResponse.json({ ok: true });
        }

        const rideSnapshot = await get(ref(db, `rides/${rideId}`));
        if (!rideSnapshot.exists()) return NextResponse.json({ ok: true });

        const ride = rideSnapshot.val();

        if (ride.status !== 'PENDING') {
          await telegramApiRequest('sendMessage', {
            chat_id: chatId,
            text: '⚠️ *TOO LATE!*\n\nAnother driver has already accepted this ride.',
            parse_mode: 'Markdown',
          });

          await telegramApiRequest('deleteMessage', {
            chat_id: chatId,
            message_id: messageId,
          });

          return NextResponse.json({ ok: true });
        }

        const driverData = driverSnapshot.val();
        const encodedAddress = encodeURIComponent(ride.pickup || '');
        const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

        await update(ref(db, `rides/${rideId}`), {
          status: 'ACCEPTED',
          driverName: driverData.name,
          driverPhone: driverData.phone,
          driverId: driverTelegramId,
        });

        await telegramApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `✅ *ACCEPTED by ${driverData.name}*\n\n📍 Pickup: ${ride.pickup}\n📞 Pax: ${ride.phone}\n💰 Price: ${ride.price}`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🧭 Open Google Maps', url: mapLink }],
              [{ text: '📍 I HAVE ARRIVED', callback_data: `arrived_${rideId}` }],
              [{ text: '❌ CANCEL RIDE', callback_data: `cancel_${rideId}` }],
            ],
          },
        });
      } else if (data.startsWith('arrived_')) {
        const rideId = data.replace('arrived_', '');
        await update(ref(db, `rides/${rideId}`), { status: 'ARRIVED' });

        await telegramApiRequest('editMessageReplyMarkup', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: { inline_keyboard: [[{ text: '🏁 COMPLETE RIDE', callback_data: `complete_${rideId}` }]] },
        });
      } else if (data.startsWith('complete_')) {
        const rideId = data.replace('complete_', '');
        await update(ref(db, `rides/${rideId}`), { status: 'COMPLETED' });

        await telegramApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: '🏁 *RIDE COMPLETED*',
        });

        if (adminTelegramId) {
          await telegramApiRequest('sendMessage', {
            chat_id: adminTelegramId,
            text: `💰 MONEY: Ride ${rideId} Finished.`,
          });
        }
      } else if (data.startsWith('cancel_')) {
        const rideId = data.replace('cancel_', '');
        await update(ref(db, `rides/${rideId}`), { status: 'CANCELLED' });

        await telegramApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: '❌ RIDE CANCELLED by Driver',
        });
      }
    } else if (updateData.message && updateData.message.text) {
      const text = updateData.message.text;
      const driverId = updateData.message.from.id;

      if (text.startsWith('/')) return NextResponse.json({ ok: true });

      const ridesRef = ref(db, 'rides');
      const q = query(ridesRef, orderByChild('driverId'), equalTo(driverId));
      const snapshot = await get(q);

      if (snapshot.exists()) {
        const rides = snapshot.val();
        const activeRideId = Object.keys(rides).find(
          (key) => rides[key].status === 'ACCEPTED' || rides[key].status === 'ARRIVED',
        );

        if (activeRideId) {
          await push(ref(db, `rides/${activeRideId}/messages`), {
            sender: 'driver',
            text,
            timestamp: Date.now(),
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('WEBHOOK ERROR:', error);
    return NextResponse.json({ ok: true });
  }
}
