export type StoredClinicianProfile = {
  email: string
  name: string
  practiceName: string
  specialty: string
  onboardingCompletedAt: string
  onboardingComplete: boolean
}

const PROFILE_STORAGE_PREFIX = 'synth.clinicianProfile'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function getClinicianProfileStorageKey(email: string) {
  return `${PROFILE_STORAGE_PREFIX}:${normalizeEmail(email)}`
}

export function readStoredClinicianProfile(email: string): StoredClinicianProfile | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(getClinicianProfileStorageKey(email))
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<StoredClinicianProfile>
    if (
      typeof parsed?.email !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.practiceName !== 'string' ||
      typeof parsed.specialty !== 'string' ||
      typeof parsed.onboardingCompletedAt !== 'string' ||
      typeof parsed.onboardingComplete !== 'boolean'
    ) {
      return null
    }

    return {
      email: normalizeEmail(parsed.email),
      name: parsed.name,
      practiceName: parsed.practiceName,
      specialty: parsed.specialty,
      onboardingCompletedAt: parsed.onboardingCompletedAt,
      onboardingComplete: parsed.onboardingComplete,
    }
  } catch {
    return null
  }
}

export function writeStoredClinicianProfile(profile: StoredClinicianProfile) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    getClinicianProfileStorageKey(profile.email),
    JSON.stringify({
      ...profile,
      email: normalizeEmail(profile.email),
    })
  )
}

