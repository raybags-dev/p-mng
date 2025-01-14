import mongoose from 'mongoose'
import crypto from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(crypto.scrypt)

const ENCRYPTION_KEY_LENGTH = 32
const SALT_LENGTH = 64
const IV_LENGTH = 16
const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const HASH_ITERATIONS = 100000

const PasswordDocSchema = {
  service: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  username: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  iv: {
    type: String,
    required: true
  },
  salt: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}

const PASSWORD_DOC_SCHEMA = new mongoose.Schema(PasswordDocSchema, {
  timestamps: true
})

// Add methods to the schema
PASSWORD_DOC_SCHEMA.statics = {
  async deriveKey (masterPassword, salt) {
    return scrypt(masterPassword, salt, ENCRYPTION_KEY_LENGTH)
  },

  async encryptPassword (password, masterPassword) {
    try {
      // Generate salt and IV
      const salt = crypto.randomBytes(SALT_LENGTH).toString('hex')
      const iv = crypto.randomBytes(IV_LENGTH)

      // Derive encryption key from master password
      const key = await this.deriveKey(masterPassword, salt)

      // Create cipher and encrypt
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
      let encryptedPassword = cipher.update(password, 'utf8', 'hex')
      encryptedPassword += cipher.final('hex')

      // Get auth tag for GCM mode
      const authTag = cipher.getAuthTag()

      // Combine encrypted password and auth tag
      const hash = encryptedPassword + authTag.toString('hex')

      return {
        hash,
        iv: iv.toString('hex'),
        salt
      }
    } catch (error) {
      throw new Error('Encryption failed: ' + error.message)
    }
  },

  async decryptPassword (hash, iv, salt, masterPassword) {
    try {
      const key = await this.deriveKey(masterPassword, salt)

      const authTag = Buffer.from(hash.slice(-32), 'hex')
      const encryptedPassword = hash.slice(0, -32)

      // Create decipher
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_ALGORITHM,
        key,
        Buffer.from(iv, 'hex')
      )

      // Set auth tag
      decipher.setAuthTag(authTag)

      // Decrypt
      let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      throw new Error('Decryption failed: ' + error.message)
    }
  },

  async createPassword (data, masterPassword) {
    const { service, username, password, userId } = data

    const { hash, iv, salt } = await this.encryptPassword(
      password,
      masterPassword
    )

    return this.create({
      service,
      username,
      passwordHash: hash,
      iv,
      salt,
      user: userId
    })
  },

  async getPasswordById (id, masterPassword) {
    const doc = await this.findById(id)
    if (!doc) throw new Error('Password not found')

    const password = await this.decryptPassword(
      doc.passwordHash,
      doc.iv,
      doc.salt,
      masterPassword
    )

    return {
      ...doc.toObject(),
      password
    }
  },

  async getAllUserPasswords (userId, masterPassword) {
    const docs = await this.find({ user: userId })

    return Promise.all(
      docs.map(async doc => {
        const password = await this.decryptPassword(
          doc.passwordHash,
          doc.iv,
          doc.salt,
          masterPassword
        )
        return {
          ...doc.toObject(),
          password
        }
      })
    )
  },

  async updatePassword (id, data, masterPassword) {
    const doc = await this.findById(id)
    if (!doc) throw new Error('Password not found')

    const updates = { ...data }

    if (data.password) {
      const { hash, iv, salt } = await this.encryptPassword(
        data.password,
        masterPassword
      )
      updates.passwordHash = hash
      updates.iv = iv
      updates.salt = salt
      delete updates.password
    }

    return this.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
  },

  async deletePassword (id) {
    const doc = await this.findByIdAndDelete(id)
    if (!doc) throw new Error('Password not found')
    return doc
  }
}

PASSWORD_DOC_SCHEMA.index({ user: 1, service: 1 })
PASSWORD_DOC_SCHEMA.index({ user: 1, username: 1 })

const PASSWORD_MODEL = mongoose.model('documents', PASSWORD_DOC_SCHEMA)

export { PASSWORD_MODEL }
