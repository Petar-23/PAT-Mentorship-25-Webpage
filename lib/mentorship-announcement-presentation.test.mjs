import test from 'node:test'
import assert from 'node:assert/strict'
import {preparePresentation,verifyPresentation} from './mentorship-announcement-presentation.mjs'
const guid='11111111-1111-1111-1111-111111111111'
const url='https://www.price-action-trader.de/mentorship/modul/module?video=video'
const video={bunnyGuid:guid,title:'Daily Review 07.09.2026',thumbnailUrl:'https://untrusted.invalid/other.jpg',chapter:{name:'KW 37',module:{name:'September 2026',playlist:{name:'Daily Reviews'}}}}
const jpeg=()=>new Response(new Uint8Array([255,216,255,0]),{headers:{'content-type':'image/jpeg'}})
test('fetches only the matching video thumbnail, with Referer and no redirects',async()=>{
  const p=await preparePresentation(video,url,async(target,init)=>{
    assert.equal(target,`https://vz-08bb86cc-ee1.b-cdn.net/${guid}/thumbnail.jpg`)
    assert.equal(init.headers.Referer,'https://iframe.mediadelivery.net/');assert.equal(init.redirect,'error')
    return jpeg()
  })
  assert.equal(p.embed.title,'Neues Video: Daily Review 07.09.2026')
  assert.deepEqual(p.embed.fields.map(f=>f.value),['Daily Reviews','September 2026','KW 37'])
  assert.equal(p.embed.footer.icon_url,'https://www.price-action-trader.de/images/pat-banner.jpeg')
})
test('invalid guid cannot cause a thumbnail request',async()=>{
  await assert.rejects(preparePresentation({...video,bunnyGuid:'../secret'},url,()=>{throw Error('SHOULD_NOT_FETCH')}),/VIDEO_GUID_INVALID/)
})
for(const [name,response] of [
  ['missing',()=>new Response('',{status:404})],
  ['html',()=>new Response('html',{headers:{'content-type':'text/html'}})],
  ['empty',()=>new Response('',{headers:{'content-type':'image/jpeg'}})],
  ['fake jpeg',()=>new Response('not a jpeg',{headers:{'content-type':'image/jpeg'}})],
  ['oversized',()=>new Response('',{headers:{'content-type':'image/jpeg','content-length':'9999999'}})],
])test(`${name} thumbnail fails before sending`,async()=>assert.rejects(preparePresentation(video,url,response),/THUMBNAIL_NOT_READY/))
test('readback verifies card metadata and the Discord-hosted image without needing a separate attachment entry',async()=>{
  const {embed}=await preparePresentation(video,url,jpeg)
  const actual={...embed,image:{url:'https://cdn.discordapp.com/attachments/channel/123/thumbnail.jpg?signature=test'}}
  assert.doesNotThrow(()=>verifyPresentation({embeds:[actual],attachments:[]},embed,'channel'))
  for(const change of [{title:'other'},{fields:[]},{image:{url:'https://foreign.invalid/thumbnail.jpg'}},{image:{url:'https://cdn.discordapp.com/attachments/wrong/123/thumbnail.jpg'}},{footer:{text:'other'}}]) {
    assert.throws(()=>verifyPresentation({embeds:[{...actual,...change}]},embed,'channel'),/EMBED_READBACK_MISMATCH/)
  }
})
test('long and mention-bearing metadata stays within Discord payload limits',async()=>{
  const p=await preparePresentation({...video,title:'@everyone @here <@123> <@&456> '.repeat(1000)},url,jpeg)
  assert(p.content.length<=2000);assert(p.embed.title.length<=256)
  assert.equal(p.content.match(/@everyone/g).length,1)
  assert(!/@everyone|@here|<@[!&]?\d+>/.test(p.embed.title))
})
