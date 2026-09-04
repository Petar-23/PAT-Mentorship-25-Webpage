import test from 'node:test'
import assert from 'node:assert/strict'
import { TARGET } from './mentorship-announcement-target.mjs'
import { deliverAnnouncement, deliveryKey } from './mentorship-announcement-delivery.mjs'

function scenario(options={}) {
  const entries=new Map(), posts=[]
  const env={DISCORD_MENTORSHIP_GUILD_ID:TARGET.guildId,DISCORD_MENTORSHIP_CHANNEL_ID:TARGET.channelId,DISCORD_BOT_TOKEN:'fake'}
  const video={id:'video',bunnyGuid:'guid',announcedAt:'yesterday',announcementMessageId:options.oldMessage?'wrong-server-message':null,chapter:{name:'Lektionen',module:{id:'module',name:'September',playlist:{name:'Advanced'}}}}
  const api=async(path,init={})=>{
    if(init.method==='POST'){posts.push(JSON.parse(init.body));if(options.sendTimeout)throw new Error('DISCORD_RESPONSE_UNCERTAIN');return{id:'new-message'}}
    if(path.endsWith('wrong-server-message')) throw new Error('DISCORD_HTTP_404')
    if(path.includes('/messages/'))return{id:'new-message',channel_id:options.badReadback?'wrong':TARGET.channelId,author:{id:'bot'},content:'https://www.price-action-trader.de/mentorship/modul/module?video=video',mention_everyone:false,mention_roles:[]}
    if(path.startsWith('/channels/'))return{id:TARGET.channelId,guild_id:TARGET.guildId,type:0,permission_overwrites:[{type:0,id:TARGET.guildId,deny:'1024',allow:'0'},{type:0,id:TARGET.memberRoleId,deny:'0',allow:'1024'}]}
    if(path==='/users/@me')return{id:'bot',bot:true}
    if(path.endsWith('/roles'))return[{id:TARGET.guildId,permissions:'0'},{id:TARGET.memberRoleId,permissions:'0'},{id:'botrole',permissions:'8'}]
    if(path.includes('/members/'))return{user:{id:'bot'},roles:['botrole']}
    return{id:TARGET.guildId}
  }
  const store={get:async k=>entries.get(k),claim:async(k,v)=>{if(entries.has(k))return false;entries.set(k,v);return true},complete:async(k,v)=>{if(options.dbFailure)throw new Error('DB');entries.set(k,v)},uncertain:async(k,v)=>entries.set(k,v)}
  const args={video,env,api,store,ready:async()=>{if(options.notReady)throw new Error('HLS_NOT_READY')}}
  return {args,posts,entries}
}
test('wrong destination legacy announcement does not suppress new authorized destination',async()=>{
  const s=scenario({oldMessage:true});const r=await deliverAnnouncement(s.args)
  assert.equal(r.channelId,TARGET.channelId);assert.equal(s.posts.length,1);assert.deepEqual(s.posts[0].allowed_mentions,{parse:[]});assert(!s.posts[0].content.includes('@everyone'))
})
test('same target retry verifies existing delivery without posting again',async()=>{
  const s=scenario();await deliverAnnouncement(s.args);assert.equal((await deliverAnnouncement(s.args)).action,'already_announced');assert.equal(s.posts.length,1)
})
test('concurrent attempts claim once',async()=>{const s=scenario();await Promise.allSettled([deliverAnnouncement(s.args),deliverAnnouncement(s.args)]);assert.equal(s.posts.length,1)})
for(const option of ['sendTimeout','dbFailure','badReadback'])test(`${option} never triggers fallback or second POST`,async()=>{
  const s=scenario({[option]:true});await assert.rejects(deliverAnnouncement(s.args));await assert.rejects(deliverAnnouncement(s.args));assert.equal(s.posts.length,1);assert.equal(s.entries.get(deliveryKey('video',TARGET)).state,'uncertain')
})
test('readiness failure sends nothing and claims nothing',async()=>{const s=scenario({notReady:true});await assert.rejects(deliverAnnouncement(s.args),/HLS/);assert.equal(s.posts.length,0);assert.equal(s.entries.size,0)})
