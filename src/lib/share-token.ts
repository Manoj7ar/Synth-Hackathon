import { randomBytes } from 'crypto'

export function generateShareToken() {
  return randomBytes(24).toString('base64url')
}
