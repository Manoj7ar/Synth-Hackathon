import 'server-only'

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/options'
import { prisma } from '@/lib/data/prisma'

export type ClinicianUserProfile = {
  id: string
  email: string
  role: string
  name: string | null
  practiceName: string | null
  specialty: string | null
  onboardingCompletedAt: Date | null
  onboardingComplete: boolean
}

export type ClinicianSessionContext = {
  session: Awaited<ReturnType<typeof getServerSession>>
  user: ClinicianUserProfile
}

export async function getClinicianSessionContext(): Promise<ClinicianSessionContext | null> {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'clinician' || !session.user.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      practiceName: true,
      specialty: true,
      onboardingCompletedAt: true,
    },
  })

  if (!user || user.role !== 'clinician') {
    return null
  }

  return {
    session,
    user: {
      ...user,
      onboardingComplete: Boolean(user.onboardingCompletedAt),
    },
  }
}

export async function requireClinicianPage(options?: {
  requireOnboarding?: boolean
  loginRedirectTo?: string
  onboardingRedirectTo?: string
}): Promise<ClinicianSessionContext> {
  const context = await getClinicianSessionContext()
  if (!context) {
    redirect(options?.loginRedirectTo ?? '/login')
  }

  const requireOnboarding = options?.requireOnboarding ?? true
  if (requireOnboarding && !context.user.onboardingComplete) {
    redirect(options?.onboardingRedirectTo ?? '/clinician/onboarding')
  }

  return context
}

