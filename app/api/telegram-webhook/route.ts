import { NextResponse } from 'next/server';

const FIREBASE_DB_URL = "https://urbanride4244-default-rtdb.firebaseio.com";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// ⚠️ REPLACE THIS WITH YOUR PERSONAL TELEGRAM ID (Not the channel ID)
// Use the "userinfobot" on Telegram to find your numeric ID if you don't know it.
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
      const driverId = callback.from.id;

      const firstUnderscore = data.indexOf('_');
      if (firstUnderscore === -1) return NextResponse.json({ status: 'ignored' });
      
      const action = data.substring(0, firstUnderscore);
      const rideId = data.substring(firstUnderscore + 1);

      let newStatus = "";
      let responseText = "";
      let nextButtons: any[] = [];

      // --- 1. DRIVER ACCEPTS ---
      if (action === 'accept') {
        newStatus = 'ACCEPTED';
        
        // A. GET RIDE DETAILS FROM FIREBASE
        const rideRes = await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`);
        const rideData = await rideRes.json();
        
        if (!rideData) return NextResponse.json({ status: 'error' });

        // B. FORMAT THE SHORT MESSAGE FOR DRIVER
        responseText = `
✅ *RIDE CONFIRMED*
------------------------
📞 *Phone:* \`${rideData.phone}\` (Click to call)
👥 *Pax:* ${rideData.passengers}
📍 *Pick:* ${rideData.pickup} (${rideData.details})
🏁 *Drop:* ${rideData.destination}
📏 *Dist:* ${rideData.distance}
💰 *Price:* ${rideData.price}
------------------------
_Go pick up the passenger now._
`;
        
        // C. UPDATE FIREBASE
        await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`, {
          method: 'PATCH',
          body: JSON.stringify({ 
            status: newStatus,
            driverName: driverName,
            driverId: driverId 
          })
        });

        // D. NOTIFY ADMIN (LOGGING)
        // This sends a private DM to YOU (The Admin)
        if (ADMIN_LOG_ID) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_LOG_ID,
                    text: `🚨 *ADMIN LOG*\n\nRide: ${rideId}\nDriver: ${driverName} (ID: ${driverId})\nStatus: APPROVED`,
                    parse_mode: 'Markdown'
                })
            });
        }

        // E. BUTTONS (Add Cancel for safety)
        nextButtons = [
            [{ text: "🏁 Driver Arrived", callback_data: `arrived_${rideId}` }],
            [{ text: "❌ Cancel Ride", callback_data: `cancel_${rideId}` }]
        ];
      } 

      // --- 2. DRIVER ARRIVED ---
      else if (action === 'arrived') {
        newStatus = 'ARRIVED';
        responseText = `📍 *YOU HAVE ARRIVED*\n\nWait for the passenger to come out.`;
        
        await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
        
        nextButtons = [[{ text: "✅ Complete Ride", callback_data: `complete_${rideId}` }]];
      } 
      
      // --- 3. DRIVER COMPLETES ---
      else if (action === 'complete') {
        newStatus = 'COMPLETED';
        responseText = `🎉 *JOB DONE*\n\nRide finished. Good work!`;
        
        await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
        
        // Notify Admin of Completion
        if (ADMIN_LOG_ID) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_LOG_ID,
                    text: `💰 *ADMIN LOG*\n\nRide: ${rideId}\nStatus: COMPLETED (Success)`,
                    parse_mode: 'Markdown'
                })
            });
        }
        
        nextButtons = [];
      }

      // --- 4. DRIVER CANCELS ---
      else if (action === 'cancel') {
        newStatus = 'CANCELLED';
        responseText = `🚫 *RIDE CANCELLED*\n\nYou cancelled this job. The passenger has been notified.`;
        
        await fetch(`${FIREBASE_DB_URL}/rides/${rideId}.json`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
        
        if (ADMIN_LOG_ID) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_LOG_ID,
                    text: `⚠️ *ADMIN LOG*\n\nRide: ${rideId}\nStatus: CANCELLED by Driver`,
                    parse_mode: 'Markdown'
                })
            });
        }
        nextButtons = [];
      }

      // SEND THE UPDATE TO TELEGRAM
      if (newStatus) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: responseText,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: nextButtons }
          })
        });
      }
      
      // Stop Spinner
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback.id })
      });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}