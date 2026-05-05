import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import * as OTPAuth from 'otpauth'
import { encrypt, decrypt } from '../lib/crypto.js'

export interface TotpService {
  generateSecret(userEmail: string): { secret: string; uri: string; qrData: string }
  /** secret here is the encrypted blob stored in DB */
  verify(encryptedSecret: string, token: string): boolean
  encryptSecret(plain: string): string
  decryptSecret(encrypted: string): string
}

async function totpPlugin(app: FastifyInstance) {
  const service: TotpService = {
    generateSecret(userEmail) {
      const totp = new OTPAuth.TOTP({
        issuer: 'MedLog AI',
        label: userEmail,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.generate(20),
      })
      return {
        secret: encrypt(totp.secret.base32), // store encrypted
        uri: totp.toString(),
        qrData: totp.toString(),
      }
    },

    verify(encryptedSecret, token) {
      const plainSecret = decrypt(encryptedSecret)
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(plainSecret),
      })
      const delta = totp.validate({ token, window: 1 })
      return delta !== null
    },

    encryptSecret: encrypt,
    decryptSecret: decrypt,
  }

  app.decorate('totp', service)
}

export default fp(totpPlugin, { name: 'totp' })

declare module 'fastify' {
  interface FastifyInstance {
    totp: TotpService
  }
}
