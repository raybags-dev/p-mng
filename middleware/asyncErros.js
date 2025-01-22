import devLogger from './loggers.js'
import { sendResponse } from './util.js'

export function asyncMiddleware (handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next)
    } catch (ex) {
      const mongoValidationMessages = [
        'Cast to ObjectId failed for value',
        'CastError'
      ]

      const statusCode = ex.statusCode || 500
      const errorMessage = ex.message || 'Internal Server Error'

      const isMongoValidationError = mongoValidationMessages.some(msg =>
        ex.message.includes(msg)
      )

      const sourceFunctionName = handler.name || 'Anonymous Function'

      if (isMongoValidationError) {
        const errMessage = `MongoDB Validation Error in "${sourceFunctionName}": ${ex.message}`
        const resMessage = 'Bad Request: Invalid input'
        devLogger(errMessage, 'error')
        return sendResponse(res, 400, resMessage, true, {
          error: errorMessage
        })
      }

      devLogger(`Error in "${sourceFunctionName}": ${errorMessage}`, 'error')
      return sendResponse(res, statusCode, 'Error occurred!', true, {
        error: errorMessage
      })

      // if (next) next(ex)
    }
  }
}
