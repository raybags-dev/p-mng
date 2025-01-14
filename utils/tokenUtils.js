import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { config } from 'dotenv'
config()

import { USER_MODEL } from '../src/models/user.js'

const { ENCRYPTION_KEY, ACCESS_ADMIN_TOKEN, SUPER_USER_TOKEN } = process.env

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

export const generateRandomToken = () => randomBytes(64).toString('hex')
export function encrypt (text) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY),
    iv
  )
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}
export function decrypt (text) {
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift(), 'hex')
  const encryptedText = Buffer.from(parts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY),
    iv
  )
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}
export function verifyToken (token, secret) {
  return jwt.verify(token, secret)
}
export async function verifySuperUserToken (req, res, next) {
  try {
    const userId = req.user._id
    if (!userId) throw new Error('user could not be found')

    const superUserTokenFromHeader = req.headers['super-user-token']
    if (!superUserTokenFromHeader) {
      return res.status(403).json({ error: 'Superuser token is required' })
    }

    const user = await USER_MODEL.findById(userId)
    if (!user || !user.isSuperUser) {
      return res.status(404).json({ error: 'Superuser access required' })
    }

    const decryptedToken = decrypt(user.superUserToken)

    if (decryptedToken !== superUserTokenFromHeader) {
      return res.status(403).json({ error: 'Invalid superuser token' })
    }

    if (Date.now() > user.superUserTokenExpiry) {
      return res.status(401).json({
        error: 'Superuser token expired. Please log out and log in again.'
      })
    }

    next()
  } catch (error) {
    console.error('Superuser token verification error:', error.message || error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
export function checkTokenExpiry (req, res, next) {
  const { tokenExpiry } = req.user

  if (new Date() > new Date(tokenExpiry)) {
    return res.status(401).json({ error: 'Token expired' })
  }
  next()
}
export function isAdmin (req, res, next) {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'FORBIDDEN: Access denied!' })
  }
  next()
}
export async function extractAndValidateTokens (req, res, next) {
  const authHeader = req.headers['authorization']
  const superHeader = req.headers['admin-token']

  if (!authHeader || !superHeader) {
    return res.status(401).json({ error: 'Unauthorized: Missing tokens' })
  }

  const [bearer, accessToken] = authHeader.split(' ')

  if (bearer !== 'Bearer' || !accessToken) {
    return res.status(401).json({ error: 'Invalid Authorization header' })
  }

  try {
    // Verify both tokens
    const decodedAccessToken = verifyToken(accessToken, ACCESS_ADMIN_TOKEN)
    const decodedSuperToken = verifyToken(superHeader, SUPER_USER_TOKEN)

    // Check tokens against database records
    const user = await USER_MODEL.findOne({ _id: decodedAccessToken._id })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if tokens match
    if (!(await compareTokens(accessToken, user.accessToken))) {
      return res.status(401).json({ error: 'Invalid access token' })
    }

    if (!(await compareTokens(superHeader, user.superUserToken))) {
      return res.status(401).json({ error: 'Invalid super token' })
    }

    // Attach user to request
    req.user = user
    next()
  } catch (error) {
    console.error('Token validation error:', error.message || error)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}
export async function hashToken (token) {
  const saltRounds = 10
  return await bcrypt.hash(token, saltRounds)
}

export async function compareTokens (plainToken, hashedToken) {
  return await bcrypt.compare(plainToken, hashedToken)
}
