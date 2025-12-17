import { NextResponse } from 'next/server';

const FIREBASE_DB_URL = "https://urbanride4244-default-rtdb.firebaseio.com";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ✅ YOUR ADMIN ID IS INTEGRATED HERE
const ADMIN_LOG_ID = "8500104449"; 

export async function POST(request: Request) {
  try {
    const update = await request.json();

    if (update.callback_query) {
      const callback = update.callback_query;
      const data = callback.data; 
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const driverName = callback.from.first_name;
      const driverUsername = callback.from.username || "";
      const driverId = callback.from.id;

      const firstUnderscore = data.indexOf('_');
      if (firstUnderscore === -1) return NextResponse.json({ status: 'ignored' });
      
      const action = data.substring(0, firstUnderscore);
      const rideId = data.substring(firstUnderscore + 1);

      let newStatus = "";
      let responseText = "";
      let nextButtons: any[] = [];

      // 1. ACCEPT
      if (action === 'accept') {
        newStatus = 'ACCEPTED';
        
        const rideRes = await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`);
        const rideData = await rideRes.json();
        
        // Save Driver Info
        await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus, driverName, driverUsername, driverId })
        });
        
        // Link Driver to Ride (for Chat)
        await fetch(`${FIREBASE_DB_URL}/active_drivers/${driverId}.json`, {
            method: 'PUT', body: JSON.stringify(rideId)
        });

        responseText = `✅ *ACCEPTED*\n📞: \`${rideData.phone}\`\n📍: ${rideData.pickup}\n🏁: ${rideData.destination}\n💰: ${rideData.price}`;
        nextButtons = [[{ text: "🏁 Arrived", callback_data: `arrived_${rideId}` }]];

        // 🚨 SEND ADMIN LOG
        if (ADMIN_LOG_ID) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_LOG_ID,
                    text: `🚨 *LOG: New Ride*\nRide: ${rideId}\nDriver: ${driverName}\nStatus: ACCEPTED`,
                    parse_mode: 'Markdown'
                })
            });
        }
      } 
      
      // 2. ARRIVED
      else if (action === 'arrived') {
        newStatus = 'ARRIVED';
        responseText = `📍 *YOU ARRIVED*\nWait for passenger.`;
        await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
        nextButtons = [[{ text: "✅ Complete", callback_data: `complete_${rideId}` }]];
      } 
      
      // 3. COMPLETE
      else if (action === 'complete') {
        newStatus = 'COMPLETED';
        responseText = `🎉 *RIDE FINISHED*`;
        await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
        await fetch(`${FIREBASE_DB_URL}/active_drivers/${driverId}.json`, { method: 'DELETE' }); // End Chat
        nextButtons = [];
        
        if (ADMIN_LOG_ID) {
             await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: ADMIN_LOG_ID, text: `💰 *LOG: Ride Paid*\nRide: ${rideId}\nStatus: COMPLETED` })
            });
        }
      }

      if (newStatus) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId, message_id: messageId, text: responseText, parse_mode: 'Markdown', reply_markup: { inline_keyboard: nextButtons }
          })
        });
      }
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
         method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: callback.id })
      });
    }

    // --- CHAT: DRIVER TO USER ---
    else if (update.message && update.message.text) {
        const driverId = update.message.from.id;
        const text = update.message.text;

        const activeRes = await fetch(`${FIREBASE_DB_URL}/active_drivers/${driverId}.json`);
        const activeRideId = await activeRes.json();

        if (activeRideId) {
            await fetch(`${FIREBASE_DB_URL}/rides/${activeRideId}/messages.json`, {
                method: 'POST',
                body: JSON.stringify({ sender: 'driver', text: text, timestamp: Date.now() })
            });
        }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}