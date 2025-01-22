// import { sendEmail } from '../../middleware/emailer.js'
// import { ObjectId } from 'mongodb'
// import { PASSWORD_MODEL } from '../models/documentModel.js'
import 'dotenv/config'
import { ObjectId } from 'mongodb'
import { USER_MODEL, USER_ID_MODEL } from '../models/user.js'
import { verifyToken, extractBearerToken } from '../../utils/tokenUtils.js'
import {
  genUUID,
  sendResponse,
  sanitizeDBObject
} from '../../middleware/util.js'

import devLogger from '../../middleware/loggers.js'

const { ACCESS_ADMIN_TOKEN, SUPER_USER_TOKEN } = process.env

const ControllerRegistry = {
  CreateUser: async (req, res) => {
    const { name, email, password, 'auth-token': authToken } = req.body
    const omissionList = [
      'id',
      '__v',
      'version',
      'updatedAt',
      'sessionTokens',
      'password',
      'superUserToken'
    ]

    if (!authToken) {
      devLogger(
        `Invalid request! authorization incomplete - missing token`,
        'error',
        false
      )
      return sendResponse(
        res,
        403,
        'Invalid request - authorization incomplete',
        true
      )
    }

    if (authToken !== ACCESS_ADMIN_TOKEN) {
      devLogger('FORBIDDEN! Invalid token', 'error')
      return sendResponse(
        res,
        403,
        'FORBIDDEN! You do not have sufficient authorization to complete this task!',
        true
      )
    }

    const existingUser = await USER_MODEL.findOne({ email })
    if (existingUser) {
      const existingUserObject = sanitizeDBObject(existingUser, omissionList)
      devLogger('Conflict! User already exists', 'error')

      return sendResponse(res, 409, 'Conflict! User already exists', true, {
        user: existingUserObject
      })
    }

    const isAdmin = authToken === ACCESS_ADMIN_TOKEN
    const uuid = genUUID()

    const newUserId = await USER_ID_MODEL.create({})
    const userId = newUserId._id

    // Create new user
    const newUser = new USER_MODEL({
      uuid,
      name,
      email,
      password,
      isAdmin,
      isSuperUser: false,
      userId: userId
    })

    newUserId.user = newUser._id

    await newUserId.save()
    await newUser.save()

    const userResponse = sanitizeDBObject(newUser, omissionList)
    devLogger('User created successfully', 'info')

    return sendResponse(res, 201, 'User created successfully', false, {
      user: userResponse
    })
  },
  Login: async (req, res) => {
    const user = req.locals.user

    if (!user) throw new Error('could not find user on req Object!')
    const omissionList = [
      'id',
      '__v',
      'version',
      'updatedAt',
      'password',
      'isSubscribed',
      'sessionTokens',
      'superUserToken'
    ]

    const user_object = sanitizeDBObject(user, omissionList)

    devLogger('Login successfully!', 'info')

    return sendResponse(res, 200, 'Login successfully!', false, {
      user: user_object
    })
  },
  Logout: async (req, res) => {
    devLogger('Logout successfully!', 'info')
    if (req.locals.user) req.locals.user = null

    if (!res.headersSent) {
      return sendResponse(res, 200, 'Logout successfully!', false, {
        user: null
      })
    }
  },
  GetCurrentUser: async (req, res) => {
    const authHeader = req.headers['standard-auth'] || ''
    const accessToken = authHeader.replace('Bearer ', '').trim()

    const omissionList = [
      '__v',
      'password',
      'sessionTokens',
      'passwordResetToken',
      'superUserToken'
    ]

    if (!accessToken) {
      let message = 'Unauthorized: Missing standard-auth token'
      return sendResponse(res, 401, message, true)
    }

    // Decode the JWT to extract the session token
    let decodedToken

    decodedToken = verifyToken(accessToken, ACCESS_ADMIN_TOKEN)
    if (!decodedToken) {
      let message = 'Unauthorized: Invalid or expired token'
      return sendResponse(res, 401, message, true)
    }

    const { _id, sessionTokens: sessionTokenFromJWT } = decodedToken

    // Fetch user from the database
    const dbUser = await USER_MODEL.findById(_id)
    if (!dbUser) {
      return sendResponse(res, 404, 'User not found in database', true)
    }

    // Verify if the session token exists in the user's sessionTokens array
    const isTokenValid = dbUser.sessionTokens.includes(sessionTokenFromJWT)
    if (!isTokenValid) {
      let message = 'Unauthorized: Session token mismatch'
      return sendResponse(res, 401, message, true)
    }

    const modifiedUser = sanitizeDBObject(dbUser, omissionList)

    return sendResponse(res, 200, modifiedUser, false)
  },
  GetCurrentUser: async (req, res) => {
    const authHeader = req.headers['standard-auth'] || ''
    const accessToken = authHeader.replace('Bearer ', '').trim()

    const omissionList = [
      '__v',
      'password',
      'sessionTokens',
      'passwordResetToken',
      'superUserToken'
    ]

    if (!accessToken) {
      let message = 'Unauthorized: Missing standard-auth token'
      return sendResponse(res, 401, message, true)
    }

    // Decode the JWT to extract the session token
    let decodedToken

    decodedToken = verifyToken(accessToken, ACCESS_ADMIN_TOKEN)
    if (!decodedToken) {
      let message = 'Unauthorized: Invalid or expired token'
      return sendResponse(res, 401, message, true)
    }

    const { _id, sessionTokens: sessionTokenFromJWT } = decodedToken

    // Fetch user from the database
    const dbUser = await USER_MODEL.findById(_id)
    if (!dbUser) {
      return sendResponse(res, 404, 'User not found in database', true)
    }

    // Verify if the session token exists in the user's sessionTokens array
    const isTokenValid = dbUser.sessionTokens.includes(sessionTokenFromJWT)
    if (!isTokenValid) {
      let message = 'Unauthorized: Session token mismatch'
      return sendResponse(res, 401, message, true)
    }

    const modifiedUser = sanitizeDBObject(dbUser, omissionList)

    return sendResponse(res, 200, modifiedUser, false)
  },
  DeleteUser: async (req, res) => {
    const omissionList = [
      '__v',
      'password',
      'sessionTokens',
      'passwordResetToken',
      'superUserToken'
    ]
    try {
      const localSuperUser = req.locals?.superUser
      const currentUser = req.locals?.user

      const _id = currentUser?._id
      const isAdmin = currentUser?.isAdmin
      const isSuperUser = localSuperUser?.isSuperUser

      const idParameter = req.params.id
      const targetUserId = idParameter || _id

      // If trying to delete another user's account
      if (idParameter) {
        if (!isSuperUser || !isAdmin) {
          const message =
            'Forbidden: Only super admins can delete other user accounts'
          devLogger(message, 'error', false)
          return sendResponse(res, 403, message, true, {})
        }
      } else {
        if (!isAdmin) {
          const message =
            'Forbidden: Only admin users can delete their own account'
          devLogger(message, 'error', false)
          return sendResponse(res, 403, message, true, {})
        }
      }

      const targetUser = await USER_MODEL.findById(targetUserId)
      if (!targetUser) {
        devLogger(`User with id ${targetUserId} not found`, 'error')
        return sendResponse(res, 404, 'User not found', true, {})
      }

      // Extract and validate the active session token
      const activeSessionTokens = currentUser.sessionTokens
      const authHeaderToken = extractBearerToken(req, 'standard-auth')
      const decryptedUser = verifyToken(authHeaderToken, ACCESS_ADMIN_TOKEN)

      const isTokenMatch = activeSessionTokens.includes(
        decryptedUser.sessionTokens
      )

      if (!isTokenMatch) {
        const message = 'Unauthorized: Invalid session token'
        devLogger(message, 'error', false)
        return sendResponse(res, 401, message, true, {})
      }

      const _UserID_ = targetUser._id.toString() === currentUser._id.toString()

      if (idParameter || _UserID_) {
        await USER_ID_MODEL.findByIdAndDelete(targetUser.userId)
        const deletedUser = await USER_MODEL.findByIdAndDelete(targetUser._id, {
          returnDocument: 'before'
        })

        req.locals.user = null
        req.locals.superUser = null
        req.locals = {}

        devLogger(
          `User with id ${targetUserId} deleted successfully`,
          'info',
          false
        )

        const modifiedUser = sanitizeDBObject(deletedUser, omissionList)

        return sendResponse(res, 200, 'User deleted successfully', false, {
          deletedUser: modifiedUser
        })
      }

      const message = 'Forbidden: Action not permitted'
      devLogger(message, 'error', false)
      return sendResponse(res, 403, message, true, {})
    } catch (error) {
      // Handle unexpected errors
      devLogger(`Error deleting user: ${error.message}`, 'error', false)
      return sendResponse(res, 500, 'An error occurred', true, {
        error: error.message
      })
    }
  },
  PromoteToSuperUser: async (req, res) => {
    try {
      const omissionList = [
        'id',
        '__v',
        'updatedAt',
        'password',
        'isSubscribed',
        'sessionTokens'
      ]
      const { superUser: user } = req.locals

      if (!user) {
        return res.status(400).json({
          message: 'Superuser data not found in request locals'
        })
      }

      // Sanitize the user object
      const user_object = sanitizeDBObject(user, omissionList)

      if (
        user.isSuperUser &&
        user.superUserToken &&
        user.superUserTokenExpiry > new Date()
      ) {
        req.locals = req.locals || {}
        req.locals.superUser = user

        const message = 'User is already a superuser.'
        return sendResponse(res, 202, message, false, {})
      }

      // Respond with the success message and sanitized user object
      const message = 'Superuser privileges granted successfully'
      return sendResponse(res, 200, message, false, {
        user: user_object
      })
    } catch (error) {
      // Handle unexpected errors
      console.error('Error in PromoteToSuperUser:', error)
      return res.status(500).json({
        message: 'Internal server error while promoting to superuser'
      })
    }
  }
}

export default ControllerRegistry
