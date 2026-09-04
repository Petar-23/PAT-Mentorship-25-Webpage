import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

// Exercise the production queue adapter without any production DB or Discord.
let serial=0
async function setup() {
  const rows=new Map();let deliveryCalls=0,ready=false
  const target={guildId:'1179688000809091182',channelId:'1457383300946722838'}
  const prisma={adminSetting:{
    findUnique:async({where})=>rows.has(where.key)?{value:rows.get(where.key)}:null,
    upsert:async({where,create})=>{if(!rows.has(where.key))rows.set(where.key,create.value)},
    update:async({where,data})=>rows.set(where.key,data.value),
    findMany:async()=>[...rows.values()].filter(v=>v.state==='pending').map(value=>({value})),
  },video:{findUnique:async()=>({id:'v',bunnyGuid:'guid',chapter:{module:{id:'m',playlist:{}}}})}}
  const deps={prisma,TARGET:target,discordApi:()=>{},verifyTarget:async()=>target,verify1080p:async()=>{},deliverAnnouncement:async()=>{deliveryCalls++;if(!ready)throw new Error('HLS_1080P_NOT_READY');return{action:'announced',messageId:'msg',...target}}}
  const name=`__announcementQueueTest${++serial}`;globalThis[name]=deps
  let source=fs.readFileSync(new URL('./mentorship-announcement-service.ts',import.meta.url),'utf8')
  source=source.replace(/^import .*\n/gm,'')
  source=`const {prisma,TARGET,discordApi,verifyTarget,verify1080p,deliverAnnouncement}=globalThis.${name};\n`+source
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  const service=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
  delete globalThis[name]
  return {service,rows,setReady:()=>{ready=true},calls:()=>deliveryCalls}
}
test('Bunny event without explicit queue request cannot send',async()=>{const s=await setup();assert.equal((await s.service.processQueuedAnnouncement('v')).action,'not_requested');assert.equal(s.calls(),0)})
test('encoding lag survives as a pending job then cron delivers after readiness',async()=>{
 const s=await setup();assert.equal((await s.service.queueAnnouncement('v')).action,'pending');assert.equal([...s.rows.values()][0].state,'pending')
 s.setReady();await s.service.processPendingAnnouncements();assert.equal([...s.rows.values()][0].state,'sent')
 await s.service.processPendingAnnouncements();assert.equal(s.calls(),2)
})
test('blocked delivery is never reset by repeat enqueue',async()=>{
 const s=await setup();await s.service.queueAnnouncement('v');[...s.rows.values()][0].state='blocked'
 assert.equal((await s.service.queueAnnouncement('v')).action,'blocked');assert.equal(s.calls(),1)
})
test('queue record cannot redirect target',async()=>{
 const s=await setup();await s.service.queueAnnouncement('v');[...s.rows.values()][0].guildId='wrong'
 await assert.rejects(s.service.processQueuedAnnouncement('v'),/MISMATCH/)
})
