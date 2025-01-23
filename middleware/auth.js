import 'dotenv/config'
const { SUPER_USER_TOKEN, ACCESS_ADMIN_TOKEN } = process.env
import { USER_MODEL } from '../src/models/user.js'

import { sendResponse } from './util.js'
import devLogger from './loggers.js'
import {
  genJWTToken,
  genRandomToken,
  validatePassword,
  extractBearerToken,
  decodeUserFromToken
} from '../utils/tokenUtils.js'

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000

export const loginHelper = async (req, res, next) => {
  const { email, password } = req.body

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
}
export const logoutHelper = async (req, res, next) => {
  const accessToken = extractBearerToken(req, 'standard-auth')

  const fromAllDevices = req.query['from-all-devices'] === 'true'

  if (!req.locals || !req.locals.user) {
    return sendResponse(res, 400, 'Bad request: No active user session', true)
  }

  const user = req.locals.user
  const currentUserId = user._id

  // Verify access token
  const currentLocalUser = await decodeUserFromToken(
    accessToken,
    ACCESS_ADMIN_TOKEN
  )

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

  let sessionTokensToRemove = null

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
}
export const elevatePrevilageHelper = async (req, res, next) => {
  const accessToken = await extractBearerToken(req, 'standard-auth')

  if (!accessToken) {
    return res.status(401).json({ message: 'Unauthorized: Missing token' })
  }

  const localDecodedUser = await decodeUserFromToken(
    accessToken,
    ACCESS_ADMIN_TOKEN
  )

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
    req.locals.isJustPromotedToSuperUser = false
    res.setHeader('standard-auth', `Bearer ${accessToken}`)
    res.setHeader('super-auth', `Bearer ${dbUser.superUserToken}`)
    return next()
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

  await dbUser.save()

  req.locals = req.locals || {}
  req.locals.superUser = dbUser
  req.locals.isJustPromotedToSuperUser = true

  res.setHeader('standard-auth', `Bearer ${accessToken}`)
  res.setHeader('super-auth', `Bearer ${superUserToken}`)

  next()
}

export const updateHelper = async (req, res, next) => {
  try {
    const { id: targetUserId } = req.params
    const accessToken = extractBearerToken(req, 'standard-auth')
    const updateFields = req.body

    // Fields that cannot be modified
    const restrictedFields = [
      '__v',
      '_id',
      'isAdmin',
      'isSuperUser',
      'sessionTokens',
      'superUserToken',
      'createdAt',
      'updatedAt'
    ]

    const currentUser = req.locals?.user
    const isSuperUser = req.locals?.superUser?.isSuperUser

    if (!currentUser) {
      return sendResponse(res, 500, 'Current user context not found', true)
    }

    const isUpdatingSelf = !targetUserId || targetUserId === currentUser._id
    const userIdToUpdate = isUpdatingSelf ? currentUser._id : targetUserId

    const decodedUser = await decodeUserFromToken(
      accessToken,
      ACCESS_ADMIN_TOKEN
    )
    const isAuthorizedUser = currentUser.sessionTokens.includes(
      decodedUser.sessionTokens
    )

    const isAuthorized = isUpdatingSelf || (isSuperUser && isAuthorizedUser)

    if (!isAuthorized) {
      const res_message = 'You are not authorized to update this user'
      return sendResponse(res, 403, res_message, true)
    }

    const targetUser = await USER_MODEL.findById(userIdToUpdate)
    if (!targetUser) {
      return sendResponse(res, 404, 'User not found', true)
    }

    // Define a list of valid fields for updating
    const updatableFields = Object.keys(targetUser.toObject()).filter(
      key => !restrictedFields.includes(key)
    )

    // Separate restricted and unrecognized fields
    const restrictedDetected = Object.keys(updateFields).filter(key =>
      restrictedFields.includes(key)
    )

    const unrecognizedFields = Object.keys(updateFields).filter(
      key => !updatableFields.includes(key) && !restrictedFields.includes(key)
    )

    // Handle errors for restricted and unrecognized fields
    if (restrictedDetected.length > 0) {
      const res_message = `${restrictedDetected.join(', ')} may not be modified`
      return sendResponse(res, 400, res_message, true)
    }

    if (unrecognizedFields.length > 0) {
      const res_message = `Unrecognized field detected: ${unrecognizedFields.join(
        ', '
      )}`
      return sendResponse(res, 400, res_message, true)
    }

    // Sanitize update fields by removing restricted fields
    const sanitizedFields = Object.keys(updateFields)
      .filter(key => updatableFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateFields[key]
        return obj
      }, {})

    // Check if fields are identical to DB values
    const areFieldsIdentical = Object.entries(sanitizedFields).every(
      ([key, value]) => targetUser[key] === value
    )

    if (areFieldsIdentical) {
      const res_message = 'No changes detected in the update payload'
      return sendResponse(res, 201, res_message, true)
    }

    req.locals = req.locals || {}
    req.locals.targetUser = targetUser
    req.locals.sanitizedFields = sanitizedFields
    req.locals.isUpdatingSelf = isUpdatingSelf
    next()
  } catch (error) {
    devLogger(`Error in updateHelper: ${error.message}`, 'error')
    const res_message = 'An error occurred while processing the update'
    return sendResponse(res, 500, res_message, true)
  }
}
