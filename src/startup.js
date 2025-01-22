import { config } from 'dotenv'
config()
const { MONGO_URI, NODE_ENV } = process.env

import connectDB from '../src/DB/connect.js'
import { clearDevPort } from '../middleware/util.js'

import devLogger, { handleLogging } from '../middleware/loggers.js'

const PORT = process.env.PORT || 6001

async function starterLogger (port) {
  try {
    await handleLogging()

    const memoryUsage = process.memoryUsage()
    const currentMemory =
      Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100
    const currentTime = new Date().toLocaleString()
    const environment = NODE_ENV || 'development'
    const currentUser = process.env.USER || 'guest_user'
    const duration = process.env.DURATION || 'undefined'
    const logname = process.env.LOGNAME || 'undefined'

    await connectDB(MONGO_URI, true)

    const starterMessages = [
      `Memory_usage: ${currentMemory} MB`,
      `Curren_time: ${currentTime}`,
      `Environment: ${environment}`,
      `Current_user: ${currentUser}`,
      `Duration: ${duration}`,
      `Log name: ${logname}`,
      `Server_running_on_port: ${port}`
    ]

    starterMessages.forEach((message, index) =>
      setTimeout(devLogger, index * 35, message, 'info', true)
    )
  } catch (e) {
    devLogger(`Error in starterLogger function: ${e.message}`, 'error')
  }
}

const startServer = async (app, port, attempt = 1) => {
  try {
    await new Promise((resolve, reject) => {
      const server = app.listen(port, async () => {
        await starterLogger(port)
        resolve()
      })
      server.on('error', reject)
    })
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      await clearDevPort(port)

      if (attempt < 3) {
        devLogger(`Retrying to start server on port ${port}...`, 'warn', true)
        await startServer(app, port, attempt + 1)
      } else {
        devLogger(
          `Failed to start server after ${attempt} attempts.`,
          'warn',
          true
        )
        process.exit(1)
      }
    } else {
      devLogger(`Server error:, ${err}`, 'error')
      process.exit(1)
    }
  }
}

export default async app => {
  app.use('/ray-bags/manager-node/*', (req, res, next) => {
    let newUrl = req.url.replace(
      '/ray-bags/manager-node/',
      `http://${PORT}/ray-bags/manager-node/`
    )
    req.url = newUrl
    next()
  })
  await startServer(app, PORT)
}
