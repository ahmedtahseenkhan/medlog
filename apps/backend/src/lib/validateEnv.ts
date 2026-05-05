/**
 * Validates critical security environment variables at startup.
 * Throws if any are missing or obviously insecure in production.
 */
export function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production'

  const required = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY']
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }

  if (isProd) {
    const jwtSecret = process.env.JWT_SECRET!
    if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production')
    if (jwtSecret.includes('dev') || jwtSecret.includes('change')) {
      throw new Error('JWT_SECRET looks like a placeholder — use a random value in production')
    }

    const encKey = process.env.ENCRYPTION_KEY!
    if (encKey.length < 32) throw new Error('ENCRYPTION_KEY must be at least 32 characters in production')
    if (encKey.includes('change')) {
      throw new Error('ENCRYPTION_KEY looks like a placeholder — use a random value in production')
    }

    if (!process.env.AUTH0_DOMAIN) {
      throw new Error('AUTH0_DOMAIN must be set in production (local auth is dev-only)')
    }
  }
}
