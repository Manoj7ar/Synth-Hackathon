import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { ensureSarahDemoSoapNoteForClinician } from '@/lib/demo/sarah-soap-note'

async function resolveDatabaseUserForToken(input: {
  userId?: string | null
  email?: string | null
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

export const authOptions: NextAuthOptions = {
  providers: [
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
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.authProvider = 'credentials'
        token.userId = user.id
        token.role = user.role
      }

      if (!token.userId || !token.role) {
        const dbUser = await resolveDatabaseUserForToken({
          userId: typeof token.userId === 'string' ? token.userId : null,
          email: typeof token.email === 'string' ? token.email : null,
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
        session.user.authProvider = 'credentials'
      } else {
        session.user.id = typeof token.userId === 'string' ? token.userId : ''
        session.user.email = typeof token.email === 'string' ? token.email : ''
        session.user.name = typeof token.name === 'string' ? token.name : null
        session.user.role = typeof token.role === 'string' ? token.role : 'clinician'
        session.user.practiceName = null
        session.user.specialty = null
        session.user.onboardingCompletedAt = null
        session.user.onboardingComplete = false
        session.user.authProvider = 'credentials'
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
