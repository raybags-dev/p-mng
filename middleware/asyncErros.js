import devLogger from './loggers.js'
import { sendResponse } from './util.js'

export function asyncMiddleware (handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next)
    } catch (ex) {
      const mongoValidationMessages = [
        'CastError: Cast to ObjectId failed for value',
        'CastError'
      ]

      const statusCode = ex.statusCode || 500
      const errorMessage = ex.message || 'Internal Server Error'

      const isMongoValidationError = mongoValidationMessages.some(msg =>
        ex.message.includes(msg)
      )

      if (isMongoValidationError) {
        devLogger(`MongoDB Validation Error: ${ex.message}`, 'error')
        return sendResponse(res, 400, 'Bad Request: Invalid input', true, {
          error: errorMessage
        })
      }

      devLogger(`Error: ${errorMessage}`, 'error')
      return sendResponse(res, statusCode, 'Error occurred', true, {
        error: errorMessage
      })

      if (next) next(ex)
    }
  }
}

export async function asyncHandler (func) {
  try {
    return await func()
  } catch (error) {
    devLogger(`Error occurred in async function:, ${error}`, 'error')
    throw new Error(error.message || 'Something went wrong in async function')
  }
}
