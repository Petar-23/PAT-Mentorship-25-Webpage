import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { processPendingAnnouncements } from '@/lib/mentorship-announcement-service'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
export async function GET(req:Request) {
  const expected=process.env.CRON_SECRET
  const actual=req.headers.get('authorization')||''
  const wanted=`Bearer ${expected}`
  if(!expected||actual.length!==wanted.length||!crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(wanted)))return NextResponse.json({error:'Unauthorized'},{status:401})
  return NextResponse.json({ok:true,results:await processPendingAnnouncements()})
}
