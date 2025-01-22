import 'dotenv/config'
const { SUPER_USER_TOKEN, ACCESS_ADMIN_TOKEN } = process.env
import { USER_MODEL } from '../src/models/user.js'

import { sendResponse } from './util.js'
import devLogger from './loggers.js'
import {
  genJWTToken,
  verifyToken,
  genRandomToken,
  extractBearerToken,
  validatePassword
} from '../utils/tokenUtils.js'

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000

export const loginHelper = async (req, res, next) => {
  const { email, password } = req.body

  try {
    const user = await USER_MODEL.findOne({ email })
    if (!user)
      return sendResponse(res, 403, 'Unauthorized: User does not exist', true)

    await validatePassword(password, user.password)

    // Generate a new session token
    const sessionToken = genRandomToken()
    user.sessionTokens.push(sessionToken)
    await user.save()

    req.locals = req.locals || {}
    req.locals.user = user

    const userPayload = {
      _id: user._id.toString(),
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin || false,
      isSuperUser: user.isSuperUser || false,
      userId: user.userId.toString(),
      sessionTokens: user.sessionTokens[0],
      isSubscribed: user.isSubscribed || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }

    if (user.isAdmin && user.isSuperUser) {
      const superUserToken = await genJWTToken(userPayload, SUPER_USER_TOKEN)
      res.setHeader('super-auth', `Bearer ${superUserToken}`)
    }
    const userToken = await genJWTToken(userPayload, sessionToken)
    res.setHeader('standard-auth', `Bearer ${userToken}`)

    next()
  } catch (error) {
    devLogger(`Login helper error: ${error.message || error}`, 'error')
    sendResponse(res, 500, 'Internal server error', true)
  }
}
export const logoutHelper = async (req, res, next) => {
  try {
    const authHeader = req.headers['standard-auth'] || ''
    const accessToken = authHeader.replace('Bearer ', '').trim()

    const fromAllDevices = req.query['from-all-devices'] === 'true'

    if (!req.locals || !req.locals.user) {
      return sendResponse(res, 400, 'Bad request: No active user session', true)
    }

    const user = req.locals.user
    const currentUserId = user._id

    // Verify the access token
    const currentLocalUser = verifyToken(accessToken, ACCESS_ADMIN_TOKEN)

    // Retrieve the user from the database
    const dbUser = await USER_MODEL.findById(currentUserId)
    if (!dbUser) {
      const message = 'User not found or already logged out!'
      return sendResponse(res, 404, message, true)
    }

    if (!dbUser.sessionTokens.includes(currentLocalUser.sessionTokens)) {
      const message = 'User not found or already logged out'
      return sendResponse(res, 404, message, true)
    }

    let sessionTokensToRemove
    if (fromAllDevices) {
      sessionTokensToRemove = [...dbUser.sessionTokens]
      dbUser.sessionTokens = []
    } else {
      sessionTokensToRemove = [currentLocalUser.sessionTokens]
      dbUser.sessionTokens = dbUser.sessionTokens.filter(
        token => token !== currentLocalUser.sessionTokens
      )
    }

    await dbUser.save()

    res.setHeader('standard-auth', '')
    res.setHeader('super-auth', '')

    next()
  } catch (error) {
    devLogger(`Logout Helper Error: ${error}`, 'error')
    return sendResponse(res, 500, 'Internal server error during logout', true)
  }
}
export const elevatePrevilageHelper = async (req, res, next) => {
  try {
    const accessToken = await extractBearerToken(req, 'standard-auth')

    if (!accessToken) {
      return res.status(401).json({ message: 'Unauthorized: Missing token' })
    }

    const localDecodedUser = verifyToken(accessToken, ACCESS_ADMIN_TOKEN)

    if (!localDecodedUser) {
      return res
        .status(401)
        .json({ message: 'Unauthorized: Invalid or expired token' })
    }

    const currentUserId = localDecodedUser._id

    const dbUser = await USER_MODEL.findById(currentUserId)

    if (!dbUser) {
      const message = 'User not found or already logged out!'
      return sendResponse(res, 404, message, true)
    }

    // Check if the user is already a superuser
    if (
      dbUser.isSuperUser &&
      dbUser.superUserToken &&
      dbUser.superUserTokenExpiry > new Date()
    ) {
      req.locals = req.locals || {}
      req.locals.superUser = dbUser
    }

    // Generate a new superuser token
    const superUserToken = await genJWTToken(
      accessToken,
      SUPER_USER_TOKEN,
      TOKEN_EXPIRY
    )

    // Set superuser token and expiry
    const superUserTokenExpiry = new Date()

    superUserTokenExpiry.setHours(superUserTokenExpiry.getHours() + 1)
    dbUser.superUserToken = superUserToken
    dbUser.superUserTokenExpiry = superUserTokenExpiry
    dbUser.isSuperUser = true

    // Save the updated user
    await dbUser.save()

    req.locals = req.locals || {}
    req.locals.superUser = dbUser

    // Set headers with the new tokens
    res.setHeader('standard-auth', `Bearer ${accessToken}`)
    res.setHeader('super-auth', `Bearer ${superUserToken}`)

    next()
  } catch (error) {
    devLogger(`Elevate helper error: ${error}`, 'error')
    res.status(500).json({ error: 'Internal server error' })
  }
}
