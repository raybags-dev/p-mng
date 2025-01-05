import mongoose from 'mongoose'
import { USER_MODEL } from './user.js'

const DocumentModel = {
  originalname: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    required: true
  },
  token: {
    type: String,
    maxlength: 500,
    minlength: 3
  },
  data: {
    type: Buffer,
    required: true
  },
  url: {
    type: String,
    required: true,
    default: ''
  },
  signature: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: function () {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  size: {
    type: String,
    trim: true,
    maxlength: 500,
    minlength: 1
  },
  encoding: {
    type: String,
    trim: true,
    maxlength: 100,
    minlength: 1,
    required: true
  },
  description: {
    type: String,
    default: 'Description not provided for this document.',
    trim: true,
    maxlength: 7000,
    minlength: 1
  }
}
const DOCUMENT_SCHEMA = new mongoose.Schema(DocumentModel, {
  timestamps: true
})

DOCUMENT_SCHEMA.index({ originalname: 'text', description: 'text' })
DOCUMENT_SCHEMA.statics.validateDocumentOwnership = async function (
  req,
  res,
  next
) {
  try {
    const user_id = req.user._id
    const documents = await this.find({ user: user_id }, { data: 0 }).exec()

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Documents not found' })
    }

    const userdocuments = documents.find(doc => doc.user.toString() === user_id)
    if (!userdocuments) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    req.locals = { userdocuments }
    next()
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: 'Server error' })
  }
}

DOCUMENT_SCHEMA.statics.isDocumentOwner = async function (req) {
  try {
    const userId = req.locals.user._id
    const documentUserId = req.document.user
    return userId.equals(documentUserId)
  } catch (error) {
    console.error('Error in isDocumentOwner:', error)
    return false
  }
}

const DOCUMENT = mongoose.model('documents', DOCUMENT_SCHEMA)
export { DOCUMENT }
