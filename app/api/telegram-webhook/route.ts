import { NextResponse } from 'next/server';

// 1. Define your specific database URL
const FIREBASE_DB_URL = "https://urbanride4244-default-rtdb.firebaseio.com";

export async function POST(request: Request) {
  try {
    // 2. Parse the incoming message from Telegram
    const update = await request.json();

    // 3. Check if this is a Button Click (Callback Query)
    if (update.callback_query) {
      const callback = update.callback_query;
      const data = callback.data; // e.g., "accept_ride_123"
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      
      // Driver Info
      const driverName = callback.from.first_name || "Unknown Driver";
      const driverUsername = callback.from.username || ""; 

      // Securely get the token
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return NextResponse.json({ error: 'Missing Token' }, { status: 500 });
      }

      // 4. Split the data
      const firstUnderscoreIndex = data.indexOf('_');
      if (firstUnderscoreIndex === -1) return NextResponse.json({ status: 'ignored' });

      const action = data.substring(0, firstUnderscoreIndex); 
      const rideId = data.substring(firstUnderscoreIndex + 1); 

      // 5. Logic Loop
      let newStatus = "";
      let responseText = "";
      
      // ✅ FIXED: Explicitly typed array for TypeScript
      let nextButtons: { text: string; callback_data: string }[][] = []; 

      // --- SCENARIO A: Driver Clicks ACCEPT ---
      if (action === 'accept') {
        newStatus = 'ACCEPTED';
        responseText = `✅ *RIDE ACCEPTED*\n\nDriver: ${driverName} is on the way!`;

        await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`, {
          method: 'PATCH',
          body: JSON.stringify({ 
            status: newStatus,
            driverName: driverName,
            driverUsername: driverUsername 
          })
        });

        nextButtons = [[{ text: "🏁 Driver Arrived", callback_data: `arrived_${rideId}` }]];
      }

      // --- SCENARIO B: Driver Clicks ARRIVED ---
      else if (action === 'arrived') {
        newStatus = 'ARRIVED';
        responseText = `📍 *DRIVER ARRIVED*\n\nWaiting for passenger...`;

        await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus })
        });

        nextButtons = [[{ text: "✅ Complete Ride", callback_data: `complete_${rideId}` }]];
      }

      // --- SCENARIO C: Driver Clicks COMPLETE ---
      else if (action === 'complete') {
        newStatus = 'COMPLETED';
        responseText = `🎉 *RIDE COMPLETED*\n\nGreat job, ${driverName}!`;

        await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus })
        });

        nextButtons = []; 
      }

      // 6. Update Telegram Message
      if (newStatus) {
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: responseText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: nextButtons
            }
          })
        });
      }

      // 7. Stop loading spinner
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback.id })
      });
    }

    return NextResponse.json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}