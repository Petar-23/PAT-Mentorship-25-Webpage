// app/owner/page.tsx
'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import AdminDashboardV2 from '@/components/dashboard/AdminDashboardV2'
import { motion, AnimatePresence } from 'framer-motion'

export default function OwnerPage() {
  const { user, isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const isAdmin =
    user?.organizationMemberships?.some((membership) => membership.role === 'org:admin') || false

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.replace('/')
      return
    }

    if (!isAdmin) {
      router.replace('/dashboard')
    }
  }, [isLoaded, isSignedIn, isAdmin, router])

  const canShowDashboard = isLoaded && isSignedIn && isAdmin

  return (
    <div className="container mx-auto">
      <AnimatePresence mode="wait">
        {!canShowDashboard ? (
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
            <AdminDashboardV2 />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}