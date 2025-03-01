// app/owner/page.tsx
'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import AdminDashboard from '@/components/dashboard/AdminDashboard'
import { motion, AnimatePresence } from 'framer-motion'

export default function OwnerPage() {
  const { user, isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (isLoaded) {
      if (!isSignedIn) {
        router.push('/')
        return
      }

      const userIsAdmin = user?.organizationMemberships?.some(
        membership => membership.role === 'org:admin'
      ) || false
      
      setIsAdmin(userIsAdmin)

      if (!userIsAdmin) {
        router.push('/dashboard')
      }
      
      setIsChecking(false)
    }
  }, [isLoaded, isSignedIn, user, router])

  return (
    <div className="container mx-auto">
      <AnimatePresence mode="wait">
        {isChecking || !isLoaded || !isAdmin ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-12 flex justify-center items-center min-h-[60vh]"
          >
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600">Loading dashboard...</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AdminDashboard />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}