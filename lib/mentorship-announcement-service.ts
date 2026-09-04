import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { discordApi, verifyTarget, TARGET } from '@/lib/mentorship-announcement-target.mjs'
import { deliverAnnouncement } from '@/lib/mentorship-announcement-delivery.mjs'
import { verify1080p } from '@/lib/mentorship-announcement-readiness.mjs'

const PREFIX='mentorship-announcement-queue:v1:'
type Queue={videoId:string;guildId:string;channelId:string;state:string;requestedAt:string;lastError?:string}
const store={
  get:async(key:string)=>(await prisma.adminSetting.findUnique({where:{key},select:{value:true}}))?.value ?? null,
  claim:async(key:string,value:Prisma.InputJsonValue)=>{
    try {await prisma.adminSetting.create({data:{key,value}});return true}
    catch(e){if(typeof e==='object'&&e&&'code'in e&&e.code==='P2002')return false;throw e}
  },
  complete:async(key:string,value:Prisma.InputJsonValue,videoId:string)=>{
    const record=value as {messageId:string;deliveredAt:string}
    await prisma.$transaction([
      prisma.adminSetting.update({where:{key},data:{value}}),
      prisma.video.update({where:{id:videoId},data:{announcedAt:new Date(record.deliveredAt),announcementMessageId:record.messageId}}),
    ])
  },
  uncertain:async(key:string,value:Prisma.InputJsonValue)=>{await prisma.adminSetting.update({where:{key},data:{value}})},
}

export async function queueAnnouncement(videoId:string) {
  await verifyTarget(process.env,discordApi(process.env))
  const video=await prisma.video.findUnique({where:{id:videoId},select:{id:true,bunnyGuid:true}})
  if(!video?.bunnyGuid)throw new Error('VIDEO_NOT_FOUND')
  const value:Queue={videoId,guildId:TARGET.guildId,channelId:TARGET.channelId,state:'pending',requestedAt:new Date().toISOString()}
  // Existing sent/uncertain records are never reset by a retry.
  await prisma.adminSetting.upsert({where:{key:PREFIX+videoId},create:{key:PREFIX+videoId,value},update:{}})
  return processQueuedAnnouncement(videoId)
}

export async function processQueuedAnnouncement(videoId:string) {
  const key=PREFIX+videoId
  const row=await prisma.adminSetting.findUnique({where:{key},select:{value:true}})
  if(!row)return {action:'not_requested'}
  const queue=row.value as unknown as Queue
  if(queue.guildId!==TARGET.guildId||queue.channelId!==TARGET.channelId||queue.videoId!==videoId)throw new Error('QUEUE_TARGET_MISMATCH')
  if(queue.state==='blocked')return {action:'blocked',...queue}
  try {
    const video=await prisma.video.findUnique({where:{id:videoId},include:{chapter:{include:{module:{include:{playlist:true}}}}}})
    if(!video)throw new Error('VIDEO_NOT_FOUND')
    // In this schema presence in the chapter is the published app state. No
    // separate published flag exists. Readiness is checked at the real CDN.
    const result=await deliverAnnouncement({video,env:process.env,api:discordApi(process.env),store,ready:verify1080p})
    await prisma.adminSetting.update({where:{key},data:{value:{...queue,state:'sent',messageId:result.messageId,verifiedAt:new Date().toISOString()}}})
    console.info('mentorship_announcement_verified',{videoId,guildId:result.guildId,channelId:result.channelId,messageId:result.messageId,action:result.action})
    return result
  } catch(error) {
    const reason=error instanceof Error&&/^[A-Z_0-9]+$/.test(error.message)?error.message:'ANNOUNCEMENT_FAILED'
    const blocked=reason.includes('RECONCILIATION')||reason==='VIDEO_NOT_FOUND'
    await prisma.adminSetting.update({where:{key},data:{value:{...queue,state:blocked?'blocked':'pending',lastError:reason,lastCheckedAt:new Date().toISOString()}}})
    return {action:blocked?'blocked':'pending',videoId,reason}
  }
}

export async function processPendingAnnouncements() {
  const rows=await prisma.adminSetting.findMany({where:{key:{startsWith:PREFIX},value:{path:['state'],equals:'pending'}},select:{value:true},orderBy:{updatedAt:'asc'},take:5})
  const results=[]
  for(const row of rows)results.push(await processQueuedAnnouncement((row.value as unknown as Queue).videoId))
  return results
}
