import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log("--- 🚀 API TRIGGERED: RIDE REQUEST ---");

  try {
    const body = await request.json();
    const { pickup, destination, price, rideId } = body;

    // 🔒 SECURE: Reading from Environment Variables (Vercel)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Check if keys exist (Crucial for debugging deployment)
    if (!botToken || !chatId) {
      console.error("❌ ERROR: Missing API Keys in Environment Variables.");
      return NextResponse.json({ success: false, error: "Missing Server Keys" }, { status: 500 });
    }

    // 1. Prepare Message
    const text = `🚖 *NEW RIDE REQUEST*\n\n📍 *From:* ${pickup}\n🏁 *To:* ${destination}\n💰 *Price:* ${price}\n\n👇 Click below to Accept`;

    const keyboard = {
      inline_keyboard: [[{ text: "✅ Accept Ride", callback_data: `accept_${rideId}` }]]
    };

    // 2. Send to Telegram
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      })
    });

    const telegramData = await res.json();
    
    if (!res.ok) {
      console.error("❌ TELEGRAM ERROR:", telegramData);
      return NextResponse.json({ success: false, error: telegramData }, { status: 500 });
    }

    console.log("✅ Message Sent Successfully to Telegram!");
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("❌ SERVER ERROR:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}