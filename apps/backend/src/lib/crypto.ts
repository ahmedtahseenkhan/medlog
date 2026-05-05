import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16
const SALT_LENGTH = 32

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH)
}

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a base64url-encoded payload: salt:iv:tag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY env var not set')

  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = deriveKey(encryptionKey, salt)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [salt, iv, tag, encrypted].map((b) => b.toString('base64url')).join(':')
}

/**
 * Decrypts a value produced by encrypt().
 */
export function decrypt(payload: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY env var not set')

  const parts = payload.split(':')
  if (parts.length !== 4) throw new Error('Invalid encrypted payload format')

  const [saltB64, ivB64, tagB64, ciphertextB64] = parts
  const salt = Buffer.from(saltB64, 'base64url')
  const iv = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const ciphertext = Buffer.from(ciphertextB64, 'base64url')

  if (tag.length !== TAG_LENGTH) throw new Error('Invalid auth tag length')

  const key = deriveKey(encryptionKey, salt)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return decipher.update(ciphertext) + decipher.final('utf8')
}
