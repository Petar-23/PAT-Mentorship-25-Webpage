import test from 'node:test'
import assert from 'node:assert/strict'
import { TARGET, configuredTarget, verifyTarget, discordApi } from './mentorship-announcement-target.mjs'

const env = { DISCORD_MENTORSHIP_GUILD_ID: TARGET.guildId, DISCORD_MENTORSHIP_CHANNEL_ID: TARGET.channelId, DISCORD_BOT_TOKEN: 'test' }
function fixture(change = {}) {
  const channel = { id: TARGET.channelId, guild_id: TARGET.guildId, type: 0, permission_overwrites: [{id:TARGET.guildId,type:0,deny:'1024',allow:'0'},{id:TARGET.memberRoleId,type:0,deny:'0',allow:'1024'},{id:'botrole',type:0,deny:'0',allow:'84992'}], ...change }
  return async path => {
    if (path.startsWith('/channels/')) return channel
    if (path === '/users/@me') return {id:'bot',bot:true}
    if (path.endsWith('/roles')) return [{id:TARGET.guildId,permissions:'0'},{id:TARGET.memberRoleId,permissions:'0'},{id:'botrole',permissions:'0'}]
    if (path.includes('/members/')) return {user:{id:'bot'},roles:['botrole']}
    return {id:TARGET.guildId,name:'community'}
  }
}
test('ignores old HQ variables and requires explicit exact member target', () => {
  assert.throws(() => configuredTarget({DISCORD_GUILD_ID:TARGET.guildId,DISCORD_ANNOUNCEMENTS_CHANNEL_ID:TARGET.channelId}), /CONFIG/)
  assert.throws(() => configuredTarget({...env, DISCORD_MENTORSHIP_CHANNEL_ID:'1454248550593728623'}), /CONFIG/)
  assert.throws(() => configuredTarget({...env, DISCORD_MENTORSHIP_GUILD_ID:'843450168451399681'}), /CONFIG/)
})
test('validates exact role-restricted guild/channel with bot rights', async () => assert.equal((await verifyTarget(env,fixture())).guildId,TARGET.guildId))
test('same name or channel response cannot hide wrong guild', async () => assert.rejects(verifyTarget(env,fixture({guild_id:'843450168451399681'})), /MISMATCH/))
test('no sending when target lookup fails', async () => assert.rejects(verifyTarget(env,async()=>{throw new Error('403')}), /403/))
test('rejects public channel and absent bot rights', async () => assert.rejects(verifyTarget(env,fixture({permission_overwrites:[]})), /PERMISSIONS/))
test('no secret or Discord response body in errors', async () => {
  const api=discordApi(env,async()=>new Response('secret error body',{status:403}))
  await assert.rejects(api('/test'),e=>e.message === 'DISCORD_HTTP_403')
})
