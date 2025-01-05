import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { config } from 'dotenv'
config()
const { SUPER_USER_TOKEN } = process.env
const userIdSchema = new mongoose.Schema({}, { timestamps: true })

const userModel = {
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 5,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 255,
    unique: true
  },
  password: {
    type: String,
    required: true,
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
  superUserToken: {
    type: String,
    default: null
  },
  isSubscribed: {
    type: Boolean,
    default: false,
    required: true
  },

  version: {
    type: Number,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserId',
    required: true
  },
  password_reset_token: {
    type: String
  }
}
const userSchema = new mongoose.Schema(userModel, {
  timestamps: true,
  toJSON: { virtuals: true }
})
userSchema.virtual('passwordResetToken').get(function () {
  return generatePasswordResetToken()
})
userSchema.methods.setPasswordResetToken = async function () {
  this.password_reset_token = await generatePasswordResetToken()
  await this.save()
  return this.password_reset_token
}
userSchema.methods.generateAuthToken = function () {
  const superUserToken = this.superUserToken || null

  const token = jwt.sign(
    {
      _id: this._id,
      isAdmin: this.isAdmin,
      version: this.version,
      superUserToken: superUserToken
    },
    process.env.MY_SECRET
  )
  return token
}
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password)
}
userSchema.statics.findByCredentials = async function (email, password) {
  const user = await this.findOne({ email })
  if (!user) {
    throw new Error('Invalid login credentials')
  }

  const isMatch = await user.comparePassword(password)
  if (!isMatch) {
    throw new Error('Invalid login credentials')
  }
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
userSchema.statics.isAdminUser = function (isAdmin, isSuperUser) {
  return isAdmin || isSuperUser
}
userSchema.statics.getSubscriptionStatus = async function (userId) {
  const user = await this.findById(userId)
  return user ? user.isSubscribed : null
}

userSchema.statics.isOwner = async function (userId, targetId) {
  const user = await this.findById(userId)
  return user && user._id.toString() === targetId.toString()
}
userSchema.pre('save', function (next) {
  if (this.isModified('password')) {
    this.password = bcrypt.hashSync(this.password, 8)
  }
  if (this.isModified('password') || this.isNew) {
    this.version = this.version + 1
  }
  next()
})
const USER_MODEL = mongoose.model('User', userSchema)
const USER_ID_MODEL = mongoose.model('UserId', userIdSchema)

export async function generatePasswordResetToken () {
  const token = randomBytes(64).toString('hex')
  return token
}
export { USER_MODEL, USER_ID_MODEL }
