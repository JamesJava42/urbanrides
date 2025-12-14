import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const update = await request.json();

    // Check if someone clicked a button
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const data = callbackQuery.data; // e.g. "accept_ride_123"
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const driverName = callbackQuery.from.first_name; 

      // 🔒 SECURE: Reading from Environment Variables
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (data.startsWith('accept_')) {
        const rideId = data.replace('accept_', '');
        
        // 1. Update Firebase
        // Note: We keep the URL hardcoded or use a variable if you prefer, 
        // but the hardcoded URL is fine here as long as the ID matches your project.
        const firebaseUrl = `https://urbanride4244-default-rtdb.firebaseio.com/rides/${rideId}.json`;
        
        await fetch(firebaseUrl, {
          method: 'PATCH',
          body: JSON.stringify({ 
            status: 'ACCEPTED',
            driverName: driverName 
          })
        });

        // 2. Update the Telegram Message (Remove button)
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ *RIDE ACCEPTED*\n\nDriver: ${driverName} is on the way!`,
              parse_mode: 'Markdown'
            })
          });
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}