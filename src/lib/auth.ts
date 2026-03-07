import { NextAuthOptions } from 'next-auth'
import CognitoProvider from 'next-auth/providers/cognito'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { ensureSarahDemoSoapNoteForClinician } from '@/lib/demo/sarah-soap-note'
import {
  allowLegacyCredentialsAuth,
  getCognitoClientId,
  getCognitoClientSecret,
  getCognitoIssuer,
  isCognitoConfigured,
} from '@/lib/config'

type AppAuthUser = {
  id: string
  email: string
  name: string | null
  role: string
}

async function ensureCognitoClinicianUser(input: {
  cognitoSub: string
  email: string
  name?: string | null
}): Promise<AppAuthUser> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const displayName = input.name?.trim() || null

  const existingBySub = await prisma.user.findUnique({
    where: { cognitoSub: input.cognitoSub },
  })

  if (existingBySub) {
    const updated = await prisma.user.update({
      where: { id: existingBySub.id },
      data: {
        email: normalizedEmail,
        name: existingBySub.name ?? displayName,
        authProvider: 'cognito',
      },
    })

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
    }
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (existingByEmail) {
    const updated = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        cognitoSub: input.cognitoSub,
        authProvider: 'cognito',
        name: existingByEmail.name ?? displayName,
      },
    })

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
    }
  }

  const created = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash: null,
      role: 'clinician',
      name: displayName,
      cognitoSub: input.cognitoSub,
      authProvider: 'cognito',
    },
  })

  try {
    await ensureSarahDemoSoapNoteForClinician(prisma, created.id)
  } catch (error) {
    console.warn('Unable to create Sarah demo SOAP note for new Cognito clinician:', error)
  }

  return {
    id: created.id,
    email: created.email,
    name: created.name,
    role: created.role,
  }
}

async function resolveDatabaseUserForToken(input: {
  userId?: string | null
  email?: string | null
  cognitoSub?: string | null
}) {
  if (input.userId) {
    const byId = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        practiceName: true,
        specialty: true,
        onboardingCompletedAt: true,
      },
    })

    if (byId) return byId
  }

  if (input.cognitoSub) {
    const bySub = await prisma.user.findUnique({
      where: { cognitoSub: input.cognitoSub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        practiceName: true,
        specialty: true,
        onboardingCompletedAt: true,
      },
    })

    if (bySub) return bySub
  }

  if (input.email) {
    return prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        practiceName: true,
        specialty: true,
        onboardingCompletedAt: true,
      },
    })
  }

  return null
}

const providers: NextAuthOptions['providers'] = []

if (isCognitoConfigured()) {
  providers.push(
    CognitoProvider({
      clientId: getCognitoClientId()!,
      clientSecret: getCognitoClientSecret()!,
      issuer: getCognitoIssuer()!,
    })
  )
}

if (allowLegacyCredentialsAuth()) {
  providers.push(
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        name: { label: 'Name', type: 'text' },
        intent: { label: 'Intent', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email.trim().toLowerCase()
        const password = credentials.password
        const providedName = typeof credentials.name === 'string' ? credentials.name.trim() : ''
        const intent = typeof credentials.intent === 'string' ? credentials.intent : 'signin'

        if (!email || !password) {
          return null
        }

        let user = await prisma.user.findUnique({
          where: { email },
        })

        if (intent === 'signup') {
          if (user) {
            return null
          }

          const passwordHash = await bcrypt.hash(password, 10)
          user = await prisma.user.create({
            data: {
              email,
              passwordHash,
              role: 'clinician',
              name: providedName || null,
              authProvider: 'credentials',
            },
          })

          try {
            await ensureSarahDemoSoapNoteForClinician(prisma, user.id)
          } catch (error) {
            console.warn('Unable to create Sarah demo SOAP note for new clinician:', error)
          }
        } else {
          if (!user || !user.passwordHash) {
            return null
          }

          const isValidPassword = await bcrypt.compare(password, user.passwordHash)
          if (!isValidPassword) {
            return null
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    })
  )
}

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'cognito') {
        return true
      }

      const providerSub = account.providerAccountId
      const email =
        typeof user.email === 'string'
          ? user.email
          : typeof profile?.email === 'string'
            ? profile.email
            : ''
      const name =
        typeof user.name === 'string'
          ? user.name
          : typeof profile?.name === 'string'
            ? profile.name
            : null

      if (!providerSub || !email) {
        console.error('Cognito sign-in missing provider sub or email')
        return false
      }

      const dbUser = await ensureCognitoClinicianUser({
        cognitoSub: providerSub,
        email,
        name,
      })

      ;(user as typeof user & { appUserId?: string; role?: string }).appUserId = dbUser.id
      user.role = dbUser.role
      return true
    },
    async jwt({ token, user, account }) {
      const appUser = user as typeof user & { appUserId?: string; role?: string }

      if (account?.provider === 'cognito') {
        token.authProvider = 'cognito'
        token.cognitoSub = account.providerAccountId
        token.userId = appUser.appUserId
        token.role = appUser.role ?? token.role
      } else if (user) {
        token.authProvider = 'credentials'
        token.userId = user.id
        token.role = user.role
      }

      if (!token.userId || !token.role) {
        const dbUser = await resolveDatabaseUserForToken({
          userId: typeof token.userId === 'string' ? token.userId : null,
          email: typeof token.email === 'string' ? token.email : null,
          cognitoSub: typeof token.cognitoSub === 'string' ? token.cognitoSub : null,
        })

        if (dbUser) {
          token.userId = dbUser.id
          token.role = dbUser.role
          token.email = dbUser.email
          token.name = dbUser.name
        }
      }

      return token
    },
    async session({ session, token }) {
      if (!session?.user) {
        return session
      }

      const dbUser = await resolveDatabaseUserForToken({
        userId: typeof token.userId === 'string' ? token.userId : null,
        email: typeof token.email === 'string' ? token.email : null,
        cognitoSub: typeof token.cognitoSub === 'string' ? token.cognitoSub : null,
      })

      if (dbUser) {
        session.user.id = dbUser.id
        session.user.email = dbUser.email
        session.user.name = dbUser.name
        session.user.role = dbUser.role
        session.user.practiceName = dbUser.practiceName
        session.user.specialty = dbUser.specialty
        session.user.onboardingCompletedAt = dbUser.onboardingCompletedAt?.toISOString() ?? null
        session.user.onboardingComplete = Boolean(dbUser.onboardingCompletedAt)
        session.user.authProvider =
          typeof token.authProvider === 'string' ? token.authProvider : 'credentials'
      } else {
        session.user.id = typeof token.userId === 'string' ? token.userId : ''
        session.user.email = typeof token.email === 'string' ? token.email : ''
        session.user.name = typeof token.name === 'string' ? token.name : null
        session.user.role = typeof token.role === 'string' ? token.role : 'clinician'
        session.user.practiceName = null
        session.user.specialty = null
        session.user.onboardingCompletedAt = null
        session.user.onboardingComplete = false
        session.user.authProvider =
          typeof token.authProvider === 'string' ? token.authProvider : 'credentials'
      }

      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
}
