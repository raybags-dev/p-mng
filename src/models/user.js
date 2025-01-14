// src/models/user.js
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { config } from 'dotenv'

config()

const { SUPER_USER_TOKEN, _SEC_TOKEN_ } = process.env

const userModel = {
  uuid: {
    type: String,
    required: [true, 'uuid is required'],
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    unique: true,
    trim: true,
    minlength: 5,
    maxlength: 50
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    minlength: 5,
    maxlength: 255,
    unique: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    trim: true,
    minlength: 5,
    maxlength: 1024
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isSuperUser: {
    type: Boolean,
    default: false
  },
  isSuperUser: {
    type: Boolean,
    default: false
  },
  sessionTokens: {
    type: [String],
    default: []
  },
  superUserToken: {
    type: String,
    default: null
  },
  superUserTokenExpiry: {
    type: Date,
    default: null
  },
  isSubscribed: {
    type: Boolean,
    default: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserId',
    required: true
  },
  version: {
    type: Number,
    default: 0
  },
  password_reset_token: {
    type: String
  }
}

const userSchema = new mongoose.Schema(userModel, {
  timestamps: true,
  toJSON: { virtuals: true }
})
const userIdSchema = new mongoose.Schema({}, { timestamps: true })

// Virtual field for password reset token
userSchema.virtual('passwordResetToken').get(function () {
  return generatePasswordResetToken()
})

// Instance methods
userSchema.methods.setPasswordResetToken = async function () {
  this.password_reset_token = await generatePasswordResetToken()
  await this.save()
  return this.password_reset_token
}

userSchema.methods.generateAuthToken = function () {
  const payload = {
    _id: this._id,
    isAdmin: this.isAdmin,
    version: this.version,
    superUserToken: this.superUserToken || null
  }
  return jwt.sign(payload, _SEC_TOKEN_)
}

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password)
}

// Static methods
userSchema.statics.findByCredentials = async function (email, password) {
  const user = await this.findOne({ email })
  if (!user) throw new Error('Invalid login credentials')

  const isMatch = await user.comparePassword(password)
  if (!isMatch) throw new Error('Invalid login credentials')

  return user
}

userSchema.statics.isSuperUser = async function (superUserToken) {
  if (!superUserToken) return false

  const user = await this.findOne({ superUserToken })
  if (
    !user ||
    !user.isSuperUser ||
    superUserToken !== user.superUserToken ||
    SUPER_USER_TOKEN !== superUserToken
  ) {
    return false
  }
  return true
}

userSchema.statics.resetPassword = async function (email, newPassword) {
  const user = await this.findOne({ email })
  if (!user) throw new Error('User not found')

  user.password = bcrypt.hashSync(newPassword, 8)
  user.password_reset_token = null
  await user.save()

  return user
}

userSchema.pre('save', function (next) {
  if (this.isModified('password')) {
    this.password = bcrypt.hashSync(this.password, 8)
  }
  if (this.isModified('password') || this.isNew) {
    this.version += 1
  }
  next()
})

// Helper function for generating password reset tokens
async function generatePasswordResetToken () {
  return randomBytes(64).toString('hex')
}

// Models
const USER_MODEL = mongoose.model('User', userSchema)
const USER_ID_MODEL = mongoose.model('UserId', userIdSchema)

export { USER_MODEL, USER_ID_MODEL }
