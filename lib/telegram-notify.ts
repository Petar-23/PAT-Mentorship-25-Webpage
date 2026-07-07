import 'server-only'

// Push an Petars Cortana-Telegram-Chat (Trial-/Zahlungs-/Support-Ereignisse).
// Fehlt die Config, wird nur geloggt — Benachrichtigungen duerfen Checkout,
// Webhook oder Account-Actions NIE brechen.
export async function sendCortanaTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.log('[telegram] skipped (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set):', text)
    return
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.error('[telegram] sendMessage failed:', res.status, await res.text())
    }
  } catch (error) {
    console.error('[telegram] sendMessage error (non-fatal):', error)
  }
}
