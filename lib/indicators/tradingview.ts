const TV_BASE = 'https://www.tradingview.com'
const DEFAULT_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

function normalizeUsernameInput(username: string) {
  return String(username || '').trim().replace(/^@+/, '')
}

function normalizeCookieInput(input: string | null | undefined) {
  const value = String(input ?? '').trim()
  if (!value) return ''

  if (value.includes('=')) {
    return value
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .join('; ')
  }

  return value
}

function cookieHeader(cookieValue: string) {
  if (!cookieValue) return ''
  return cookieValue.includes('=') ? cookieValue : `sessionid=${cookieValue}`
}

function tradingViewHeaders(cookieValue?: string) {
  return {
    ...(cookieValue ? { Cookie: cookieHeader(cookieValue) } : {}),
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Origin: TV_BASE,
    Referer: `${TV_BASE}/`,
    'User-Agent': process.env.TRADINGVIEW_USER_AGENT?.trim() || DEFAULT_BROWSER_USER_AGENT,
    'X-Requested-With': 'XMLHttpRequest',
  }
}

function isLoginRequired(status: number, text: string) {
  return status === 401 || (status === 403 && /login_required|login required/i.test(text))
}

function extractHintUsernames(payload: unknown): string[] {
  const entries = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : []

  return entries.flatMap((entry) => {
    if (typeof entry === 'string') return [entry]
    if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { username?: unknown }).username === 'string'
    ) {
      return [(entry as { username: string }).username]
    }

    return []
  })
}

export type TradingViewValidationResult = {
  valid: boolean
  exactName: string
}

export type TradingViewAccessResult = {
  success: boolean
  message: string
  code?: 'not_configured' | 'login_required' | 'request_failed' | 'tradingview_rejected'
}

export type TradingViewPineScript = {
  scriptIdPart: string
  scriptName: string
  scriptAccess?: string
}

export class TradingViewService {
  private readonly cookieValue: string

  constructor(cookieValue?: string | null) {
    this.cookieValue = normalizeCookieInput(cookieValue)
  }

  get isConfigured() {
    return Boolean(this.cookieValue)
  }

  async validateUsername(username: string): Promise<TradingViewValidationResult> {
    const normalizedUsername = normalizeUsernameInput(username)
    if (normalizedUsername.length < 2) {
      return { valid: false, exactName: '' }
    }

    try {
      const res = await fetch(
        `${TV_BASE}/username_hint/?s=${encodeURIComponent(normalizedUsername)}`,
        { headers: { 'User-Agent': process.env.TRADINGVIEW_USER_AGENT?.trim() || DEFAULT_BROWSER_USER_AGENT } }
      )

      if (!res.ok) return { valid: false, exactName: '' }

      const data: unknown = await res.json()
      const exact = extractHintUsernames(data).find(
        (match) => match.toLowerCase() === normalizedUsername.toLowerCase()
      )

      return { valid: Boolean(exact), exactName: exact ?? '' }
    } catch {
      return { valid: false, exactName: '' }
    }
  }

  async grantAccess(username: string, pineId: string): Promise<TradingViewAccessResult> {
    if (!this.cookieValue) {
      return {
        success: false,
        message: 'TradingView cookie is not configured.',
        code: 'not_configured',
      }
    }

    const formData = new FormData()
    formData.append('pine_id', pineId)
    formData.append('username_recip', normalizeUsernameInput(username))

    try {
      const res = await fetch(`${TV_BASE}/pine_perm/add/`, {
        method: 'POST',
        headers: tradingViewHeaders(this.cookieValue),
        body: formData,
      })

      if (res.status === 200 || res.status === 201) {
        return { success: true, message: 'Access granted on TradingView.' }
      }

      const text = await res.text().catch(() => '')
      if (isLoginRequired(res.status, text)) {
        return {
          success: false,
          code: 'login_required',
          message: 'TradingView session expired. Refresh the TradingView cookie in the admin tab.',
        }
      }

      return {
        success: false,
        code: 'tradingview_rejected',
        message: `TradingView returned HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ''}`,
      }
    } catch (error) {
      return {
        success: false,
        code: 'request_failed',
        message: error instanceof Error ? error.message : 'TradingView request failed.',
      }
    }
  }

  async revokeAccess(username: string, pineId: string): Promise<TradingViewAccessResult> {
    if (!this.cookieValue) {
      return {
        success: false,
        message: 'TradingView cookie is not configured.',
        code: 'not_configured',
      }
    }

    const formData = new FormData()
    formData.append('pine_id', pineId)
    formData.append('username_recip', normalizeUsernameInput(username))

    try {
      const res = await fetch(`${TV_BASE}/pine_perm/remove/`, {
        method: 'POST',
        headers: tradingViewHeaders(this.cookieValue),
        body: formData,
      })

      if (res.ok) {
        return { success: true, message: 'Access revoked on TradingView.' }
      }

      const text = await res.text().catch(() => '')
      if (isLoginRequired(res.status, text)) {
        return {
          success: false,
          code: 'login_required',
          message: 'TradingView session expired. Refresh the TradingView cookie in the admin tab.',
        }
      }

      return {
        success: false,
        code: 'tradingview_rejected',
        message: `TradingView returned HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ''}`,
      }
    } catch (error) {
      return {
        success: false,
        code: 'request_failed',
        message: error instanceof Error ? error.message : 'TradingView request failed.',
      }
    }
  }

  async testSession(): Promise<TradingViewAccessResult> {
    if (!this.cookieValue) {
      return {
        success: false,
        message: 'No TradingView cookie saved.',
        code: 'not_configured',
      }
    }

    try {
      const res = await fetch(`${TV_BASE}/pine_perm/list_users/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...tradingViewHeaders(this.cookieValue),
        },
        body: 'pine_id=invalid_test_id',
        signal: AbortSignal.timeout(8000),
      })

      if (res.status === 200 || res.status === 422) {
        return { success: true, message: 'TradingView cookie is valid.' }
      }

      const text = await res.text().catch(() => '')
      if (isLoginRequired(res.status, text)) {
        return {
          success: false,
          code: 'login_required',
          message: 'TradingView rejected the saved cookie. Log in to TradingView again and replace it.',
        }
      }

      return {
        success: false,
        code: 'tradingview_rejected',
        message: `Cookie rejected by TradingView HTTP ${res.status}${text ? `: ${text.slice(0, 140)}` : ''}`,
      }
    } catch (error) {
      return {
        success: false,
        code: 'request_failed',
        message: error instanceof Error ? error.message : 'Could not reach TradingView.',
      }
    }
  }

  async listOwnedScripts(): Promise<TradingViewPineScript[]> {
    if (!this.cookieValue) return []

    const headers = tradingViewHeaders(this.cookieValue)
    const scripts: TradingViewPineScript[] = []
    const urls = [
      'https://pine-facade.tradingview.com/pine-facade/list?filter=published',
      'https://pine-facade.tradingview.com/pine-facade/list?filter=saved',
    ]

    for (const url of urls) {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue
      const data: unknown = await res.json()
      if (Array.isArray(data)) scripts.push(...(data as TradingViewPineScript[]))
    }

    const seen = new Set<string>()
    return scripts.filter((script) => {
      if (!script.scriptIdPart || seen.has(script.scriptIdPart)) return false
      seen.add(script.scriptIdPart)
      return true
    })
  }
}
