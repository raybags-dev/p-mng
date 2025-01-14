import devLogger from './loggers.js'
import { sendResponse } from './util.js'

export function asyncMiddleware (handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next)
    } catch (ex) {
      const startTime = Date.now()
      const statusCode = ex.statusCode || 500
      const errorMessage = ex.message || 'Internal Server Error'

      devLogger(`${ex}`, 'error')

      sendResponse(res, statusCode, 'Error occurred', startTime, true, {
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

// export function asyncMiddleware (handler) {
//   return async (req, res, next) => {
//     try {
//       await handler(req, res)
//     } catch (ex) {
//       const statusCode = ex.statusCode || 500
//       res.status(statusCode).json({
//         status: 'error',
//         message: `'Internal Server Error: ${ex}`
//       })
//       console.error('Error message:', ex.message)
//       if (typeof next === 'function') {
//         next({ error: 'something went wrong!\n', message: ex })
//       }
//     }
//   }
// }
