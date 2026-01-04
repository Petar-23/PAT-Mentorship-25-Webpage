const DISCORD_API_BASE = 'https://discord.com/api/v10'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

const DISCORD_BOT_TOKEN = requireEnv('DISCORD_BOT_TOKEN')
const DISCORD_CLIENT_ID = requireEnv('DISCORD_CLIENT_ID')
const DISCORD_CLIENT_SECRET = requireEnv('DISCORD_CLIENT_SECRET')

export type DiscordOAuthTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

export type DiscordUser = {
  id: string
  username: string
  discriminator: string
  global_name?: string | null
  avatar?: string | null
}

export type DiscordGuildMember = {
  nick?: string | null
  user?: DiscordUser
}

export function buildDiscordAuthorizeUrl(params: {
  redirectUri: string
  state: string
}) {
  const search = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'identify guilds.join',
    state: params.state,
    prompt: 'consent',
  })

  return `https://discord.com/oauth2/authorize?${search.toString()}`
}

export async function exchangeDiscordCodeForToken(params: {
  code: string
  redirectUri: string
}): Promise<DiscordOAuthTokenResponse> {
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
  })

  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Discord token exchange failed (${res.status}): ${text}`)
  }

  return (await res.json()) as DiscordOAuthTokenResponse
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Discord /users/@me failed (${res.status}): ${text}`)
  }

  return (await res.json()) as DiscordUser
}

async function discordBotFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bot ${DISCORD_BOT_TOKEN}`)

  // Wenn wir FormData senden, darf Content-Type nicht manuell gesetzt werden
  // (sonst fehlt der multipart boundary).
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  if (init.body && !headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...init,
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Discord API error (${res.status}) ${path}: ${text}`)
  }

  return res
}

export async function addDiscordMemberToGuild(params: {
  guildId: string
  discordUserId: string
  userAccessToken: string
}) {
  // 201 = neu gejoint, 204 = war schon drin
  await discordBotFetch(`/guilds/${params.guildId}/members/${params.discordUserId}`, {
    method: 'PUT',
    body: JSON.stringify({ access_token: params.userAccessToken }),
  })
}

export async function addRoleToGuildMember(params: {
  guildId: string
  discordUserId: string
  roleId: string
}) {
  // 204 = ok
  await discordBotFetch(
    `/guilds/${params.guildId}/members/${params.discordUserId}/roles/${params.roleId}`,
    { method: 'PUT' }
  )
}

export async function removeRoleFromGuildMember(params: {
  guildId: string
  discordUserId: string
  roleId: string
}) {
  // 204 = ok
  await discordBotFetch(
    `/guilds/${params.guildId}/members/${params.discordUserId}/roles/${params.roleId}`,
    { method: 'DELETE' }
  )
}

export async function sendDiscordChannelMessage(params: {
  channelId: string
  content: string
  embeds?: Array<Record<string, unknown>>
  allowedMentions?: {
    parse?: Array<'everyone' | 'users' | 'roles'>
    users?: string[]
    roles?: string[]
    replied_user?: boolean
  }
}) {
  const res = await discordBotFetch(`/channels/${params.channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: params.content,
      embeds: params.embeds,
      allowed_mentions: params.allowedMentions,
    }),
  })

  return (await res.json()) as unknown
}

export async function sendDiscordChannelMessageWithAttachment(params: {
  channelId: string
  content: string
  embeds?: Array<Record<string, unknown>>
  allowedMentions?: {
    parse?: Array<'everyone' | 'users' | 'roles'>
    users?: string[]
    roles?: string[]
    replied_user?: boolean
  }
  file: {
    name: string
    contentType: string
    data: ArrayBuffer
  }
}) {
  const form = new FormData()

  const payload = {
    content: params.content,
    embeds: params.embeds,
    allowed_mentions: params.allowedMentions,
    attachments: [{ id: 0, filename: params.file.name }],
  }

  form.append('payload_json', JSON.stringify(payload))
  form.append('files[0]', new Blob([params.file.data], { type: params.file.contentType }), params.file.name)

  const res = await discordBotFetch(`/channels/${params.channelId}/messages`, {
    method: 'POST',
    body: form,
  })

  return (await res.json()) as unknown
}

export async function fetchDiscordGuildMember(params: {
  guildId: string
  discordUserId: string
}): Promise<DiscordGuildMember> {
  const res = await discordBotFetch(
    `/guilds/${params.guildId}/members/${params.discordUserId}`,
    { method: 'GET' }
  )
  return (await res.json()) as DiscordGuildMember
}