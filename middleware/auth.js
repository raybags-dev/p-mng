import jwt from 'jsonwebtoken'
import { config } from 'dotenv'
config()
const { ACCESS_TOKEN } = process.env
import { USER_MODEL } from '../src/models/user.js'
import { DOCUMENT } from '../src/models/documentModel.js'

export const generateJWTToken = async (data, version, superUserToken) => {
  const expiresIn = 60000
  const payload = {
    email: data.email,
    _id: data._id,
    version: version,
    isAdmin: data.isAdmin,
    isSuperUser: data.isSuperUser || false,
    superUserToken: data.isSuperUser ? superUserToken : null
  }

  return new Promise((resolve, reject) => {
    jwt.sign(payload, ACCESS_TOKEN, { expiresIn }, (err, token) => {
      if (err) reject(err)
      resolve(token)
    })
  })
}
export const loginUser = async (req, res, next) => {
  const {
    email = '',
    password = '',
    verification_token,
    isAdmin,
    superUserToken
  } = req.body

  try {
    const user = await USER_MODEL.findOne({ email })
    if (!user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized. Signup to use this service.' })
    }

    if (verification_token) {
      try {
        if (verification_token !== user.password_reset_token) {
          return res.status(401).json({ error: 'Invalid verification token' })
        }

        user.password = password
        await user.save()

        user.password_reset_token = undefined
        await user.save()

        const token = await generateJWTToken(
          {
            email: user.email,
            _id: user._id,
            isAdmin: user.isAdmin,
            version: user.version,
            isSuperUser: user.isSuperUser
          },
          user.version,
          user.superUserToken
        )

        res.setHeader('authorization', `Bearer ${token}`)
        req.user = user.toObject()
        return res
          .status(200)
          .json({ message: 'Password updated successfully.' })
      } catch (error) {
        console.log(error)
        return res
          .status(500)
          .json({ error: 'Error updating password', message: error.message })
      }
    }

    const isMatch = await user.comparePassword(password)

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const userData = {
      email: user.email,
      _id: user._id,
      version: user.version,
      isAdmin: user.isAdmin,
      isSuperUser: user.isSuperUser || false
    }

    if (isAdmin) {
      userData.isAdmin = true
      if (superUserToken) {
        userData.isSuperUser = true
      }
    }

    req.locals = req.locals || {}

    const token = await generateJWTToken(
      userData,
      user.version,
      user.superUserToken
    )

    // Set token in the response header
    res.setHeader('authorization', `Bearer ${token}`)
    if (user.superUserToken) {
      res.setHeader('admin-token', user.superUserToken)
      req.locals.superUserToken = user.superUserToken
    }

    req.user = user.toObject()
    next()
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Server error', message: error.message })
  }
}
export const extractTokenMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization']
  if (authHeader) {
    const [bearer, token] = authHeader.split(' ')
    req.token = token
  }
  next()
}
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization']

  if (!authHeader) {
    return res
      .status(401)
      .json({ error: 'Authentication Failed: Missing required header(s)' })
  }
  const [bearer, token] = authHeader.split(' ')

  if (bearer !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Invalid Authorization header' })
  }

  try {
    const decodedToken = jwt.verify(token, ACCESS_TOKEN)
    req.user = decodedToken
    req.token = token

    const userEmail = decodedToken.email

    if (!userEmail) {
      return res.status(401).json({ error: 'Missing email in token data' })
    }

    const user = await USER_MODEL.findOne({ email: userEmail }).maxTimeMS(10000)

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized action!' })
    }

    if (decodedToken.version !== user.version) {
      return res.status(401).json({ error: 'User has been deleted!' })
    }

    if (user.isAdmin) {
      if (user.superUserToken && decodedToken.isSuperUser) {
        req.locals = { user, isSuperUser: true }
      } else {
        req.locals = { user }
      }
    } else {
      req.locals = { user }
    }

    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' })
    }

    console.error('Authentication error:', error.message || error)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}
export const checkDocumentAccess = async (req, res, next) => {
  try {
    const { user } = req.locals // retrieve user object from req.locals
    const document = await DOCUMENT.findById(req.params.id)

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }
    if (document.user.toString() !== user._id.toString() && !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    req.document = document
    next()
  } catch (error) {
    console.error(error.message)
    res.status(500).json({ error: 'Server error', message: 'Try again later' })
  }
}
export const isAdmin = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      message: 'FORBIDDEN: Access denied!'
    })
  }
  next()
}
