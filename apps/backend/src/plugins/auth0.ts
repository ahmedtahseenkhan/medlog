import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import jwksClient from 'jwks-rsa'
import { createVerifier } from 'fast-jwt'

/**
 * When AUTH0_DOMAIN is set we validate tokens against Auth0's JWKS endpoint.
 * In dev (no AUTH0_DOMAIN) we fall back to the local JWT_SECRET so the rest of
 * the stack stays fully functional without an Auth0 tenant.
 */
async function auth0Plugin(app: FastifyInstance) {
  const domain = process.env.AUTH0_DOMAIN
  const audience = process.env.AUTH0_AUDIENCE

  if (!domain) {
    app.log.warn('AUTH0_DOMAIN not set — using local JWT_SECRET (dev only)')
    return
  }

  const client = jwksClient({
    jwksUri: `https://${domain}/.well-known/jwks.json`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000, // 10 min
    rateLimit: true,
  })

  async function getKey(header: { kid?: string }) {
    if (!header.kid) throw new Error('No kid in JWT header')
    const key = await client.getSigningKey(header.kid)
    return key.getPublicKey()
  }

  const verifyAuth0Token = createVerifier({
    key: getKey,
    algorithms: ['RS256'],
    allowedAud: audience,
    allowedIss: `https://${domain}/`,
  })

  // Override the default jwtVerify to support Auth0 RS256 tokens
  app.decorate('verifyAuth0', verifyAuth0Token)
  app.log.info(`Auth0 JWKS configured for https://${domain}`)
}

export default fp(auth0Plugin, { name: 'auth0' })
