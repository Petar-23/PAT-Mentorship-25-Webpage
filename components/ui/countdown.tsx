 'use client'

 import { useEffect, useMemo, useState } from 'react'

 type CountdownProps = {
   targetDate: string
   className?: string
 }

 const pad = (value: number) => value.toString().padStart(2, '0')

 const getTimeParts = (target: Date) => {
   const now = new Date()
   const diffMs = Math.max(0, target.getTime() - now.getTime())
   const totalSeconds = Math.floor(diffMs / 1000)

   const days = Math.floor(totalSeconds / 86400)
   const hours = Math.floor((totalSeconds % 86400) / 3600)
   const minutes = Math.floor((totalSeconds % 3600) / 60)
   const seconds = totalSeconds % 60

   return { days, hours, minutes, seconds }
 }

 export function Countdown({ targetDate, className }: CountdownProps) {
   const target = useMemo(() => new Date(targetDate), [targetDate])
   const [timeLeft, setTimeLeft] = useState(() => getTimeParts(target))

   useEffect(() => {
     const id = window.setInterval(() => {
       setTimeLeft(getTimeParts(target))
     }, 1000)

     return () => window.clearInterval(id)
   }, [target])

   return (
     <div className={className}>
       <div className="grid grid-cols-4 gap-2 text-center">
         <div className="rounded-lg bg-white/80 border border-gray-200 px-2 py-2">
           <div className="text-lg font-bold text-gray-900">{timeLeft.days}</div>
           <div className="text-[11px] uppercase tracking-wide text-gray-500">Tage</div>
         </div>
         <div className="rounded-lg bg-white/80 border border-gray-200 px-2 py-2">
           <div className="text-lg font-bold text-gray-900">{pad(timeLeft.hours)}</div>
           <div className="text-[11px] uppercase tracking-wide text-gray-500">Std</div>
         </div>
         <div className="rounded-lg bg-white/80 border border-gray-200 px-2 py-2">
           <div className="text-lg font-bold text-gray-900">{pad(timeLeft.minutes)}</div>
           <div className="text-[11px] uppercase tracking-wide text-gray-500">Min</div>
         </div>
         <div className="rounded-lg bg-white/80 border border-gray-200 px-2 py-2">
           <div className="text-lg font-bold text-gray-900">{pad(timeLeft.seconds)}</div>
           <div className="text-[11px] uppercase tracking-wide text-gray-500">Sek</div>
         </div>
       </div>
     </div>
   )
 }
