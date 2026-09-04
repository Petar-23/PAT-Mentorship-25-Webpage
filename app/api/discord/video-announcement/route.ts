import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiAccess } from '@/lib/authz'
import { requireAgentUploadAccess } from '@/lib/agent-upload-auth'
import { discordApi, verifyTarget, REVISION } from '@/lib/mentorship-announcement-target.mjs'
import { deliveryKey } from '@/lib/mentorship-announcement-delivery.mjs'
import { queueAnnouncement } from '@/lib/mentorship-announcement-service'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
async function authorize(req:NextRequest) {
  const agent=requireAgentUploadAccess(req)
  return agent.ok?agent:requireAdminApiAccess()
}
function failure(error:unknown) {
  const reason=error instanceof Error&&/^[A-Z_0-9]+$/.test(error.message)?error.message:'ANNOUNCEMENT_FAILED'
  console.error('mentorship_announcement_blocked',{revision:REVISION,reason})
  return NextResponse.json({error:reason,revision:REVISION},{status:503})
}
export async function GET(req:NextRequest) {
  const access=await authorize(req)
  if(!access.ok)return access.response
  try {
    const target=await verifyTarget(process.env,discordApi(process.env))
    const id=req.nextUrl.searchParams.get('videoId')
    const audit=id?await prisma.adminSetting.findUnique({where:{key:deliveryKey(id,target)},select:{value:true}}):null
    return NextResponse.json({ok:true,target,audit:audit?.value??null,automaticAnnouncement:'explicitly-queued-only',revision:REVISION})
  }catch(error){return failure(error)}
}
export async function POST(req:NextRequest) {
  const access=await authorize(req)
  if(!access.ok)return access.response
  const body=await req.json().catch(()=>null)
  if(typeof body?.videoId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(body.videoId))return NextResponse.json({error:'Missing videoId'},{status:400})
  try {
    const result=await queueAnnouncement(body.videoId)
    return NextResponse.json({ok:result.action!=='blocked',...result,revision:REVISION},{status:result.action==='pending'?202:result.action==='blocked'?409:200})
  }catch(error){return failure(error)}
}
