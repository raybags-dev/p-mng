// import { sendEmail } from '../../middleware/emailer.js'
// import { ObjectId } from 'mongodb'
// import { PASSWORD_MODEL } from '../models/documentModel.js'
import { USER_MODEL, USER_ID_MODEL } from '../models/user.js'
import {
  genUniqueIdentifer,
  sendResponse,
  sanitizeDBObject
} from '../../middleware/util.js'

import devLogger from '../../middleware/loggers.js'

import { config } from 'dotenv'
config()

const { ACCESS_ADMIN_TOKEN, SUPER_USER_TOKEN } = process.env

const ControllerRegistry = {
  CreateUser: async (req, res) => {
    const { name, email, password, 'auth-token': authToken } = req.body
    const omissionList = ['id', '__v', 'version', 'updatedAt', 'sessionTokens']

    if (!authToken) {
      return sendResponse(res, 403, 'Invalid request! missing token', true)
    }

    if (authToken !== ACCESS_ADMIN_TOKEN) {
      devLogger('FORBIDDEN! Invalid token', 'error')
      return sendResponse(res, 403, 'FORBIDDEN! Invalid token', true)
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
    const uniqueId = genUniqueIdentifer()

    const newUserId = await USER_ID_MODEL.create({})
    const userId = newUserId._id

    // Create new user
    const newUser = new USER_MODEL({
      uuid: uniqueId,
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
    if (!req.user) throw new Error('could not find user on req Object!')
    const omissionList = [
      'id',
      '__v',
      'version',
      'updatedAt',
      'password',
      'isSubscribed',
      'sessionTokens'
    ]
    const { user } = req

    const user_object = sanitizeDBObject(user, omissionList)

    devLogger('Login successfully!', 'info')

    return sendResponse(res, 200, 'Login successfully!', false, {
      user: user_object
    })
  },
  Logout: async (req, res) => {
    devLogger('Logout successfully!', 'info')

    if (!res.headersSent) {
      return sendResponse(res, 200, 'Logout successfully!', false, {
        user: null
      })
    }
  },
  PromoteToSuperUser: async (req, res) => {
    const { user } = req

    const omissionList = [
      'id',
      '__v',
      'version',
      'updatedAt',
      'password',
      'isSubscribed',
      'sessionTokens'
    ]

    const user_object = sanitizeDBObject(user, omissionList)

    return sendResponse(
      res,
      200,
      'User promoted to superuser successfully',
      false,
      {
        user: user_object
      }
    )
  }
}

export default ControllerRegistry
