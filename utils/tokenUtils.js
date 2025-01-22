import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import 'dotenv/config'

import { USER_MODEL } from '../src/models/user.js'
import { sendResponse } from '../middleware/util.js'

import devLogger from '../middleware/loggers.js'

const { ENCRYPTION_KEY, ACCESS_ADMIN_TOKEN, SUPER_USER_TOKEN } = process.env

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

export function genRandomToken () {
  return randomBytes(64).toString('hex')
}
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
export async function hashToken (token) {
  const saltRounds = 10
  return await bcrypt.hash(token, saltRounds)
}
export async function compareTokens (plainToken, hashedToken) {
  return await bcrypt.compare(plainToken, hashedToken)
}
export const extractBearerToken = (req, headerName) => {
  try {
    if (!req || !headerName) {
      throw new Error('expected 2 arguments received less!')
    }

    const headerToken = req.headers[headerName]
    if (!headerToken || !headerToken.startsWith('Bearer ')) {
      devLogger(`FORBIDDEN: Missing or Invalid token format <<`, 'error')
      return null
    }

    return headerToken.split(' ')[1].trim()
  } catch (e) {
    devLogger(`FORBIDDEN: ${e.message || e}`, 'error')
    return null
  }
}
export async function validatePassword (plainPassword, hashedPassword, res) {
  try {
    const isValid = await bcrypt.compare(plainPassword, hashedPassword)
    if (!isValid) {
      sendResponse(res, 401, 'Invalid credentials', true)
      return false
    }
    return true
  } catch (error) {
    console.error('Error during password validation:', error.message || error)
    sendResponse(res, 500, 'Internal server error', true)
    return false
  }
}
export function verifyToken (token, secret) {
  try {
    return jwt.verify(token, secret)
  } catch (error) {
    devLogger(`Token verification failed: ${error}`, 'error')
    return null
  }
}
export function checkTokenExpiry (req, res, next) {
  const { tokenExpiry } = req.user

  if (new Date() > new Date(tokenExpiry)) {
    return sendResponse(res, 401, 'UNAUTHORIZED: Token expired', true)
  }
  next()
}
export async function isSuperUser (req, res, next) {
  const _userId_ = req.locals.user?._id

  try {
    const super_user = await USER_MODEL.findById(_userId_)

    if (!super_user) {
      devLogger(`User with ID ${_userId_} not found`, 'error')
      return sendResponse(res, 403, 'FORBIDDEN: Access denied!', true)
    }

    if (!super_user.isAdmin || !super_user.isSuperUser) {
      const message = `User with ID ${_userId_} does not have admin/superuser privileges`
      const resMessage = 'FORBIDDEN: You do not have admin privileges'
      devLogger(message, 'warn')
      return sendResponse(res, 403, resMessage, true)
    }

    // Decrypt and validate the superUserToken
    const token = await extractBearerToken(req, 'standard-auth')

    if (!token) {
      const resMessage = 'FORBIDDEN: Missing or invalid superuser token'
      devLogger(`Missing or invalid super-auth header`, 'warn')
      return sendResponse(res, 401, resMessage)
    }

    const decryptedSuperUser = verifyToken(token, ACCESS_ADMIN_TOKEN)

    const decryptedID = decryptedSuperUser._id
    const localUserID = _userId_.toString()

    if (!decryptedSuperUser || decryptedID !== localUserID) {
      const message = `Token mismatch: token ID ${decryptedSuperUser?._id}, user ID ${localUserID}`
      const resMessage = 'FORBIDDEN: Token mismatch'
      devLogger(message, 'error')
      return sendResponse(res, 403, resMessage)
    }

    req.locals.superUser = null
    req.locals.superUser = super_user

    next()
  } catch (e) {
    devLogger(`Error in isSuperUser middleware: ${e.message || e}`, 'error')
    return sendResponse(res, 500, 'Internal server error during validation')
  }
}
export function isAdmin (req, res, next) {
  const user = req.locals.user

  if (!user) return sendResponse(res, 403, 'FORBIDDEN: Access denied!', true)

  if (!user.isAdmin) {
    const message = 'Forbidden: admin privilegesrequired'
    return sendResponse(res, 403, message, true)
  }

  next()
}
export const extractAndValidateToken = async (req, res, next) => {
  try {
    const accessToken = await extractBearerToken(req, 'standard-auth')

    if (!accessToken)
      return sendResponse(res, 401, 'Unauthorized: Missing token', true)

    // Attempt to verify the token with both secrets
    const secrets = [ACCESS_ADMIN_TOKEN, SUPER_USER_TOKEN]
    let userObject

    for (const secret of secrets) {
      try {
        userObject = jwt.verify(accessToken, secret)
        break
      } catch (err) {
        continue
      }
    }

    if (!userObject) {
      throw new Error('Token verification failed with all provided secrets')
    }

    // Attach user data to req.locals
    req.locals = req.locals || {}
    req.locals.user = userObject

    next()
  } catch (error) {
    const message = 'Unauthorized: Invalid or expired token'
    devLogger(`${error.message || error}`, 'error', true)
    return sendResponse(res, 401, message, true)
  }
}
export const evalSuperUserToken = async (req, res, next) => {
  const superAuthHeaderToken = await extractBearerToken(req, 'super-auth')

  if (!superAuthHeaderToken) {
    const message = 'FORBIDDEN: Unauthorized request. Missing superuser token'
    return sendResponse(res, 401, message, true)
  }

  try {
    const decryptedUser = verifyToken(superAuthHeaderToken, SUPER_USER_TOKEN)
    const dbUser = await USER_MODEL.findById(decryptedUser._id)

    if (!dbUser) return sendResponse(res, 404, 'User not found', true)

    const superUserToken = dbUser._id

    if (superUserToken !== dbUser._id.toString()) {
      const message = 'UNAUTHORIZED: Access denied.'
      return sendResponse(res, 403, message, true)
    }

    // Step 5: Ensure the user has superuser privileges
    if (!dbUser.isSuperUser) {
      const message = 'FORBIDDEN: higher privileges required to complete task.'
      return sendResponse(res, 403, message, true)
    }

    req.locals = req.locals || {}
    req.locals.superUser = dbUser

    next()
  } catch (error) {
    const message = `Token validation error: ${error}`
    devLogger(message, 'error', true)
    return sendResponse(res, 500, message, true)
  }
}
export async function authenticateUser (req, res, next) {
  const accessToken = extractBearerToken(req, 'standard-auth')

  if (!accessToken)
    return sendResponse(res, 401, 'Unauthorized: Missing token', true)

  const decodedToken = verifyToken(accessToken, ACCESS_ADMIN_TOKEN)
  if (!decodedToken) {
    const message = 'Unauthorized: Invalid or expired token'
    devLogger(message, 'error', true)
    return sendResponse(res, 401, message, true)
  }

  try {
    const user = await USER_MODEL.findById(decodedToken._id)

    if (!user) {
      const message = 'Unauthorized: User does not exist'
      devLogger(message, 'error', true)
      return sendResponse(res, 403, message, true)
    }

    req.locals = { user }
    next()
  } catch (error) {
    console.log(error.message)
    const message = `Error in authentication middleware: ${error.message}`
    const resMessage = 'An error occurred during authentication'
    devLogger(message, 'error', true)
    return sendResponse(res, 500, resMessage, true, {
      error: error.message
    })
  }
}
export const genJWTToken = async (data, superUserToken) => {
  const expiresIn = '7d' // Correct format for expiration time (e.g., '1h', '30m', '7d')

  const payload = typeof data === 'string' ? { data } : { ...data }

  if (payload.isSuperUser) {
    payload.superUserToken = superUserToken
  }

  return new Promise((resolve, reject) => {
    jwt.sign(payload, ACCESS_ADMIN_TOKEN, { expiresIn }, (err, token) => {
      if (err) {
        return reject(err)
      }
      resolve(token)
    })
  })
}
