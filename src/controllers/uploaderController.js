import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import { genVerificationToken } from '../../middleware/generateToken.js'
import { DOCUMENT } from '../models/documentModel.js'
import { USER_MODEL } from '../models/user.js'

export async function DocsUploaderController (req, res) {
  try {
    return null
  } catch (error) {
    console.log(error)
    if (error.name === 'ValidationError') {
      if (error.errors.question) {
        return res.status(400).json({
          status: 'Bad request!',
          message: error.errors.question.message
        })
      }
      if (error.errors.response) {
        return res.status(400).json({
          status: 'Error',
          message: error.errors.response.message
        })
      }
      if (error.errors.user) {
        return res.status(400).json({
          status: 'Error',
          message: error.errors.user.message
        })
      }
    }

    return res.status(500).json({
      status: 'Error',
      message: 'An internal error occurred:  ' + error.message
    })
  }
}
