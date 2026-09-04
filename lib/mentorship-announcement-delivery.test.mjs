import test from 'node:test'
import assert from 'node:assert/strict'
import { TARGET } from './mentorship-announcement-target.mjs'
import { deliverAnnouncement, deliveryKey } from './mentorship-announcement-delivery.mjs'

function scenario(options={}) {
  const entries=new Map(), posts=[], files=[]
  const env={DISCORD_MENTORSHIP_GUILD_ID:TARGET.guildId,DISCORD_MENTORSHIP_CHANNEL_ID:TARGET.channelId,DISCORD_BOT_TOKEN:'fake'}
  const video={id:'video',title:'AM Session',bunnyGuid:'11111111-1111-1111-1111-111111111111',announcedAt:'yesterday',announcementMessageId:options.oldMessage?'wrong-server-message':null,chapter:{name:'Lektionen',module:{id:'module',name:'September',playlist:{name:'Advanced'}}}}
  const api=async(path,init={})=>{
    if(init.method==='POST'){assert(init.body instanceof FormData);posts.push(JSON.parse(init.body.get('payload_json')));files.push(init.body.get('files[0]'));if(options.sendTimeout)throw new Error('DISCORD_RESPONSE_UNCERTAIN');return{id:'new-message'}}
    if(path.endsWith('wrong-server-message')) throw new Error('DISCORD_HTTP_404')
    if(path.includes('/messages/'))return{id:'new-message',channel_id:options.badReadback?'wrong':TARGET.channelId,author:{id:'bot'},content:posts.at(-1)?.content||'https://www.price-action-trader.de/mentorship/modul/module?video=video',mention_everyone:options.missingPing?false:posts.length>0,mention_roles:options.rolePing?['role']:[],mentions:options.userPing?[{id:'user'}]:[],embeds:options.missingEmbed?[]:posts.at(-1)?.embeds.map(e=>({...e,...(options.badEmbed?{title:'wrong'}:{}),image:{url:`https://cdn.discordapp.com/attachments/${TARGET.channelId}/123/thumbnail.jpg`}}))||[]}
    if(path.startsWith('/channels/'))return{id:TARGET.channelId,guild_id:TARGET.guildId,type:0,permission_overwrites:[{type:0,id:TARGET.guildId,deny:'1024',allow:'0'},{type:0,id:TARGET.memberRoleId,deny:'0',allow:'1024'}]}
    if(path==='/users/@me')return{id:'bot',bot:true}
    if(path.endsWith('/roles'))return[{id:TARGET.guildId,permissions:'0'},{id:TARGET.memberRoleId,permissions:'0'},{id:'botrole',permissions:'8'}]
    if(path.includes('/members/'))return{user:{id:'bot'},roles:['botrole']}
    return{id:TARGET.guildId}
  }
  const store={get:async k=>entries.get(k),claim:async(k,v)=>{if(entries.has(k))return false;entries.set(k,v);return true},complete:async(k,v)=>{if(options.dbFailure)throw new Error('DB');entries.set(k,v)},uncertain:async(k,v)=>entries.set(k,v)}
  const args={video,env,api,store,ready:async()=>{if(options.notReady)throw new Error('HLS_NOT_READY')},thumbnailFetcher:async()=>{if(options.thumbnailFailure)throw new Error('offline');return new Response(new Uint8Array([255,216,255,0]),{headers:{'content-type':'image/jpeg'}})}}
  return {args,posts,entries,files}
}
test('wrong destination legacy announcement does not suppress new authorized destination',async()=>{
  const s=scenario({oldMessage:true});const r=await deliverAnnouncement(s.args)
  assert.equal(r.channelId,TARGET.channelId);assert.equal(s.posts.length,1);assert.deepEqual(s.posts[0].allowed_mentions,{parse:['everyone'],users:[],roles:[],replied_user:false});assert(s.posts[0].content.startsWith('@everyone\n'));assert.equal(r.mentionEveryone,true)
})
test('same target retry verifies existing delivery without posting again',async()=>{
  const s=scenario();await deliverAnnouncement(s.args);assert.equal((await deliverAnnouncement(s.args)).action,'already_announced');assert.equal(s.posts.length,1)
})
test('concurrent attempts claim once',async()=>{const s=scenario();await Promise.allSettled([deliverAnnouncement(s.args),deliverAnnouncement(s.args)]);assert.equal(s.posts.length,1)})
for(const option of ['sendTimeout','dbFailure','badReadback','missingPing','rolePing','userPing','missingEmbed','badEmbed'])test(`${option} never triggers fallback or second POST`,async()=>{
  const s=scenario({[option]:true});await assert.rejects(deliverAnnouncement(s.args));await assert.rejects(deliverAnnouncement(s.args));assert.equal(s.posts.length,1);assert.equal(s.entries.get(deliveryKey('video',TARGET)).state,'uncertain')
})
test('readiness failure sends nothing and claims nothing',async()=>{const s=scenario({notReady:true});await assert.rejects(deliverAnnouncement(s.args),/HLS/);assert.equal(s.posts.length,0);assert.equal(s.entries.size,0)})
test('pre-change no-ping audit (including the AM post) is read back, never resent or modified',async()=>{
  const s=scenario();const key=deliveryKey('video',TARGET)
  const old={state:'sent',messageId:'new-message',videoId:'video',...TARGET}
  s.entries.set(key,old)
  assert.equal((await deliverAnnouncement(s.args)).action,'already_announced')
  assert.equal(s.posts.length,0);assert.equal(s.entries.get(key),old)
})
test('metadata cannot inject another everyone, here, user or role mention',async()=>{
  const s=scenario();s.args.video.title='@everyone @here <@123> <@&456>'
  s.args.video.chapter.name='@here';s.args.video.chapter.module.name='@everyone'
  await deliverAnnouncement(s.args)
  const body=s.posts[0].content
  assert.equal(body.match(/@everyone/g).length,1)
  assert(!/@here|<@[!&]?\d+>/.test(body))
})
test('one multipart POST includes the correct rich card and actual thumbnail bytes',async()=>{
  const s=scenario();await deliverAnnouncement(s.args)
  const e=s.posts[0].embeds[0]
  assert.equal(e.title,'Neues Video: AM Session');assert.equal(e.color,0x24fc35)
  assert.deepEqual(e.fields.map(f=>f.value),['Advanced','September','Lektionen'])
  assert.equal(e.url,'https://www.price-action-trader.de/mentorship/modul/module?video=video')
  assert.equal(e.image.url,'attachment://thumbnail.jpg');assert.equal(s.files[0].name,'thumbnail.jpg')
  assert.deepEqual(new Uint8Array(await s.files[0].arrayBuffer()),new Uint8Array([255,216,255,0]))
})
test('thumbnail failure cannot claim or post; a later ready thumbnail sends once',async()=>{
  const s=scenario({thumbnailFailure:true});await assert.rejects(deliverAnnouncement(s.args),/THUMBNAIL_NOT_READY/)
  assert.equal(s.posts.length,0);assert.equal(s.entries.size,0)
  s.args.thumbnailFetcher=scenario().args.thumbnailFetcher
  await deliverAnnouncement(s.args);assert.equal(s.posts.length,1)
})
