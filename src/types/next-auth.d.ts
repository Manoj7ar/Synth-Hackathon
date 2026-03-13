import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
      practiceName?: string | null
      specialty?: string | null
      onboardingCompletedAt?: string | null
      onboardingComplete?: boolean
      authProvider?: string
      image?: string | null
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    role: string
    practiceName?: string | null
    specialty?: string | null
    onboardingCompletedAt?: string | null
    onboardingComplete?: boolean
    authProvider?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    role?: string
    authProvider?: string
    practiceName?: string | null
    specialty?: string | null
    onboardingCompletedAt?: string | null
    onboardingComplete?: boolean
  }
}

