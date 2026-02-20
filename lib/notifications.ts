export async function postSlackMessage(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.error('Slack webhook error:', await response.text());
    }
  } catch (error) {
    // Slack should never break ride booking flow.
    console.error('Slack webhook request failed:', error);
  }
}
