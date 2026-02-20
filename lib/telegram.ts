const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export function hasTelegramBotToken(): boolean {
  return Boolean(BOT_TOKEN);
}

export async function telegramApiRequest(method: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error('Telegram bot token is missing. Skipping Telegram API call.');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Telegram API ${method} error:`, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Telegram API ${method} request failed:`, error);
    return false;
  }
}
