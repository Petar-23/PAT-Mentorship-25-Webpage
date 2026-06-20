export type IndicatorClaimStatus =
  | 'pending'
  | 'processing'
  | 'granted'
  | 'failed'
  | 'needs_session'
  | 'revoked'

export type Indicator = {
  id: string
  packageId: string | null
  slug: string
  name: string
  shortDescription: string
  detailDescription: string
  pineId: string
  imageUrl: string | null
  ready: boolean
  visible: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type IndicatorPackage = {
  id: string
  slug: string
  name: string
  description: string
  sortOrder: number
  visible: boolean
  indicators: Indicator[]
}

export type IndicatorClaim = {
  id: string | null
  indicatorId: string
  tvUsername: string
  status: IndicatorClaimStatus
  errorMessage: string | null
  claimedAt: string | null
  attemptCount: number
  nextRetryAt: string | null
  lastAttemptAt: string | null
}

export type TradingViewAccountBinding = {
  userId: string
  tvUsername: string
  normalizedUsername: string
  verificationStatus: 'unverified' | 'verified'
  createdAt: string
  updatedAt: string
}

export type ClaimIndicatorActionResult = {
  ok: boolean
  indicatorId?: string
  tvUsername?: string
  claimStatus?: IndicatorClaimStatus
  message: string
}

export type TradingViewSessionMeta = {
  configured: boolean
  savedAt: string | null
  savedBy: string | null
  preview: string | null
}

export type AdminTradingViewAccountBinding = TradingViewAccountBinding & {
  email: string | null
  claimCount: number
  grantedCount: number
}

export type AdminIndicatorClaimRetrySummary = {
  attempted: number
  granted: number
  failed: number
  skipped: number
  blockedBySession: boolean
  message: string
}

export type AdminIndicatorClaimQueueItem = {
  id: string
  userId: string
  indicatorId: string
  indicatorName: string
  tvUsername: string
  status: IndicatorClaimStatus
  errorMessage: string | null
  claimedAt: string | null
  attemptCount: number
  nextRetryAt: string | null
  lastAttemptAt: string | null
  lastErrorCode: string | null
  lastWorkerId: string | null
  updatedAt: string | null
}

export type AdminIndicatorClaimQueueSummary = {
  total: number
  pending: number
  processing: number
  needsSession: number
  failed: number
  granted: number
  revoked: number
  retryable: number
  staleProcessing: number
  lastAttemptAt: string | null
  lastErrorMessage: string | null
  recentClaims: AdminIndicatorClaimQueueItem[]
  workerHeartbeat: {
    workerId: string
    status: 'idle' | 'running' | 'blocked' | 'failed'
    lastSeenAt: string | null
    processedCount: number
    grantedCount: number
    failedCount: number
    lastError: string | null
  } | null
  session: {
    configured: boolean
    ok: boolean
    checkedAt: string
    message: string
  }
}

export type AdminIndicatorOverview = {
  packages: IndicatorPackage[]
  unassignedIndicators: Indicator[]
  tradingViewAccounts: AdminTradingViewAccountBinding[]
  claimQueue: AdminIndicatorClaimQueueSummary
  tradingViewSession: TradingViewSessionMeta
}
