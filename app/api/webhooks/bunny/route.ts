import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processQueuedAnnouncement } from '@/lib/mentorship-announcement-service'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
export async function POST(req:Request) {
  const secret=process.env.BUNNY_WEBHOOK_SIGNING_SECRET||process.env.BUNNY_STREAM_READ_ONLY_API_KEY||process.env.BUNNY_READ_ONLY_API_KEY
  if(!secret)return NextResponse.json({error:'Webhook signature not configured'},{status:503})
  const raw=await req.text()
  const signature=req.headers.get('x-bunnystream-signature')||''
  const expected=crypto.createHmac('sha256',secret).update(raw,'utf8').digest('hex')
  if(req.headers.get('x-bunnystream-signature-version')!=='v1'||req.headers.get('x-bunnystream-signature-algorithm')!=='hmac-sha256'||!/^[a-f0-9]{64}$/.test(signature)||!crypto.timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex')))return NextResponse.json({error:'Invalid signature'},{status:401})
  let body
  try{body=JSON.parse(raw)}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
  if(!body?.VideoGuid||typeof body.Status!=='number')return NextResponse.json({error:'Missing VideoGuid or Status'},{status:400})
  if(body.Status!==3)return NextResponse.json({ok:true,action:'status_acknowledged',announcementSent:false})
  const video=await prisma.video.findFirst({where:{bunnyGuid:body.VideoGuid},select:{id:true}})
  const result=video?await processQueuedAnnouncement(video.id):{action:'video_not_found'}
  return NextResponse.json({ok:true,...result,revision:'mentorship-target-v1'})
}
