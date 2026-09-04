// These IDs are the member-only destination explicitly approved by Petar.
export const TARGET = Object.freeze({ guildId: '1179688000809091182', channelId: '1457383300946722838', memberRoleId: '1457381268944851198' })
export const REVISION = 'mentorship-target-v2-everyone-embed'
const VIEW = 1024n, SEND = 2048n, EMBED = 16384n, ATTACH = 32768n, HISTORY = 65536n, MENTION_EVERYONE = 131072n, ADMIN = 8n

export function configuredTarget(env) {
  if (env.DISCORD_MENTORSHIP_GUILD_ID !== TARGET.guildId || env.DISCORD_MENTORSHIP_CHANNEL_ID !== TARGET.channelId) {
    throw new Error('MENTORSHIP_TARGET_CONFIG_MISMATCH')
  }
  if (!env.DISCORD_BOT_TOKEN) throw new Error('MENTORSHIP_BOT_NOT_CONFIGURED')
  return TARGET
}

export function permissionsFor(guildId, roles, overwrites, memberId, memberRoles) {
  const ids = new Set([guildId, ...memberRoles])
  let permissions = roles.filter(r => ids.has(r.id)).reduce((p,r) => p | BigInt(r.permissions), 0n)
  if (permissions & ADMIN) return ~0n
  const everyone = overwrites.find(o => o.type === 0 && o.id === guildId)
  if (everyone) permissions = (permissions & ~BigInt(everyone.deny)) | BigInt(everyone.allow)
  let deny = 0n, allow = 0n
  for (const o of overwrites.filter(o => o.type === 0 && o.id !== guildId && ids.has(o.id))) {
    deny |= BigInt(o.deny); allow |= BigInt(o.allow)
  }
  permissions = (permissions & ~deny) | allow
  const personal = overwrites.find(o => o.type === 1 && o.id === memberId)
  return personal ? (permissions & ~BigInt(personal.deny)) | BigInt(personal.allow) : permissions
}

export async function verifyTarget(env, api) {
  const target = configuredTarget(env)
  const channel = await api(`/channels/${target.channelId}`)
  if (channel.id !== target.channelId || channel.guild_id !== target.guildId || ![0,5].includes(channel.type)) throw new Error('MENTORSHIP_CHANNEL_GUILD_MISMATCH')
  const [guild, bot, roles] = await Promise.all([api(`/guilds/${target.guildId}`), api('/users/@me'), api(`/guilds/${target.guildId}/roles`)])
  if (guild.id !== target.guildId || !bot.bot || !Array.isArray(roles) || !Array.isArray(channel.permission_overwrites)) throw new Error('MENTORSHIP_TARGET_UNVERIFIED')
  const member = await api(`/guilds/${target.guildId}/members/${bot.id}`)
  if (member.user?.id !== bot.id || !Array.isArray(member.roles) || member.communication_disabled_until && new Date(member.communication_disabled_until) > new Date()) throw new Error('MENTORSHIP_BOT_MEMBER_UNVERIFIED')
  const perms = permissionsFor(target.guildId, roles, channel.permission_overwrites, bot.id, member.roles)
  const required = VIEW | SEND | EMBED | ATTACH | HISTORY
  if ((perms & required) !== required) throw new Error('MENTORSHIP_BOT_PERMISSIONS_MISSING')
  if (!(perms & MENTION_EVERYONE)) throw new Error('MENTORSHIP_BOT_MENTION_EVERYONE_MISSING')
  const publicPerms = permissionsFor(target.guildId, roles, channel.permission_overwrites, '', [])
  const menteePerms = permissionsFor(target.guildId, roles, channel.permission_overwrites, '', [target.memberRoleId])
  if ((publicPerms & VIEW) || !(menteePerms & VIEW) || !roles.some(r => r.id === target.memberRoleId)) throw new Error('MENTORSHIP_CHANNEL_NOT_ROLE_RESTRICTED')
  return { ...target, botId: bot.id, guildName: guild.name, channelName: channel.name, revision: REVISION, mentionPolicy: 'everyone-only', canMentionEveryone: true }
}

export function discordApi(env, fetcher = fetch) {
  return async (path, init = {}) => {
    let response
    try {
      response = await fetcher(`https://discord.com/api/v10${path}`, { ...init, headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, ...(init.body instanceof FormData ? {} : {'Content-Type': 'application/json'}) }, cache: 'no-store', signal: AbortSignal.timeout(10000) })
    } catch { throw new Error('DISCORD_RESPONSE_UNCERTAIN') }
    if (!response.ok) throw new Error(`DISCORD_HTTP_${response.status}`)
    try { return await response.json() } catch { throw new Error('DISCORD_RESPONSE_UNCERTAIN') }
  }
}
