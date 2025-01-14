// src/middleware/auth.js
import { USER_MODEL } from '../src/models/user.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { config } from 'dotenv'

config()

const { SUPER_USER_TOKEN } = process.env

import { sendResponse } from './util.js'
import devLogger from './loggers.js'
import { encrypt, generateRandomToken } from '../utils/tokenUtils.js'

const SUPERUSER_TOKEN_EXPIRY = 24 * 60 * 60 * 1000

export const generateSecureToken = (payload, secret, expiresIn = '1h') => {
  return jwt.sign(payload, secret, { expiresIn })
}

//**** */

//**** */

// export const loginHelper = async (req, res, next) => {
//   const { email, password } = req.body

//   try {
//     // Fetch the user from the database
//     const user = await USER_MODEL.findOne({ email })
//     if (!user) {
//       return res.status(404).json({ error: 'User not found' })
//     }

//     // Check if the password is correct
//     const isPasswordValid = await bcrypt.compare(password, user.password)
//     if (!isPasswordValid) {
//       return res.status(401).json({ error: 'Invalid credentials' })
//     }

//     // Generate tokens
//     const accessToken = generateSecureToken(
//       { _id: user._id },
//       ACCESS_ADMIN_TOKEN
//     )
//     const superUserToken = user.isSuperUser
//       ? generateSecureToken({ _id: user._id }, SUPER_USER_TOKEN)
//       : null

//     // Set tokens in response headers
//     res.setHeader('auth-token', accessToken)
//     if (user.isAdmin) res.setHeader('admin-token', accessToken)
//     if (user.isSuperUser) res.setHeader('super-user-token', superUserToken)

//     // Attach user to request object
//     req.user = user

//     next()
//   } catch (error) {
//     console.error('Login helper error:', error.message || error)
//     res.status(500).json({ error: 'Internal server error' })
//   }
// }

export const loginHelper = async (req, res, next) => {
  const { email, password } = req.body

  try {
    const user = await USER_MODEL.findOne({ email })
    if (!user) {
      return sendResponse(res, 404, 'User not found', true)
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return sendResponse(res, 401, 'Invalid credentials', true)
    }

    // Generate a new session token
    const sessionToken = generateRandomToken()
    user.sessionTokens.push(sessionToken)
    await user.save()

    // Set tokens in response headers
    res.setHeader('auth-token', sessionToken)
    // if (user.isAdmin) res.setHeader('admin-token', sessionToken)
    if (user.isSuperUser) {
      const superUserToken = generateSecureToken(
        {
          _id: user._id,
          email: user.email,
          isAdmin: user.isAdmin,
          isSuperUser: user.isSuperUser || false,
          superUserToken: user.isSuperUser ? superUserToken : null
        },
        SUPER_USER_TOKEN
      )
      res.setHeader('super-user-token', superUserToken)
    }

    req.user = user
    next()
  } catch (error) {
    devLogger(`Login helper error: '${error.message || error}`, 'error')
    sendResponse(res, 500, 'Internal server error', true)
  }
}

export const logoutHelper = async (req, res, next) => {
  try {
    const token = req.headers['auth-token']
    if (!token) return sendResponse(res, 400, 'Session token is required', true)

    const fromAllDevices = req.query['from-all-devices'] === 'true'

    const user = await USER_MODEL.findOne({ sessionTokens: token })
    if (!user)
      return sendResponse(
        res,
        404,
        'User not found or already logged out',
        true
      )
    let seesion_tokens_to_remove

    if (fromAllDevices) {
      seesion_tokens_to_remove = [...user.sessionTokens]
      user.sessionTokens = []
    } else {
      seesion_tokens_to_remove = [token]

      user.sessionTokens = user.sessionTokens.filter(t => t !== token)
    }

    // Save the updated user
    await user.save()

    const tokens = { tokens: seesion_tokens_to_remove }

    sendResponse(
      res,
      200,
      `Logout successful${fromAllDevices ? ' from all devices' : ''}`,
      false,
      tokens
    )
    next()
  } catch (error) {
    devLogger(`Logout helper error: ${error.message || error}`, 'error')
    sendResponse(res, 500, 'Internal server error', true)
  }
}

export const elevateHelper = async (req, res, next) => {
  try {
    const { userId, password } = req.body

    // Find the user by ID
    const user = await USER_MODEL.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Verify the user's password (re-authentication for security)
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Empty the sessionTokens array
    user.sessionTokens = []

    // Set the user as a superuser
    user.isSuperUser = true

    // Generate a new session token
    const sessionToken = generateRandomToken()
    user.sessionTokens.push(sessionToken)

    // Generate and encrypt the super-user token
    const superUserToken = generateRandomToken()
    const encryptedSuperUserToken = encrypt(superUserToken)

    // Store the encrypted token and its expiry time in the database
    user.superUserToken = encryptedSuperUserToken
    user.superUserTokenExpiry = Date.now() + SUPERUSER_TOKEN_EXPIRY

    // Save the updated user
    await user.save()

    // Set the new session token in response headers
    res.setHeader('auth-token', sessionToken)
    res.setHeader('super-user-token', superUserToken)

    // Add the updated user to the request object
    req.user = user

    // Continue to the next middleware/controller
    next()
  } catch (error) {
    console.error('Elevate helper error:', error.message || error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
