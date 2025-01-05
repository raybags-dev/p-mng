export function asyncMiddleware (handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res)
    } catch (ex) {
      const statusCode = ex.statusCode || 500
      res.status(statusCode).json({
        status: 'error',
        message: `'Internal Server Error: ${ex}`
      })
      console.error('Error message:', ex.message)
      if (typeof next === 'function') {
        next({ error: 'something went wrong!\n', message: ex })
      }
    }
  }
}

export async function handleStandardErrors (asyncFunction) {
  try {
    await asyncFunction()
  } catch (error) {
    console.error('Error:', error.message || error)
  }
}
