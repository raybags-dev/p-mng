import winston from 'winston'
import path from 'path'
import { existsSync } from 'fs'
import fsPromises from 'fs/promises'

const getWinstonConfig = () => {
  const logsDirectory = 'logs'

  return winston.createLogger({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return message
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ message }) => message)
        )
      }),
      new winston.transports.File({
        filename: path.join(logsDirectory, 'info.log'),
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ message }) => message)
        )
      }),
      new winston.transports.File({
        filename: path.join(logsDirectory, 'warn.log'),
        level: 'warn',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ message }) => message)
        )
      }),
      new winston.transports.File({
        filename: path.join(logsDirectory, 'error.log'),
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ message }) => message)
        )
      })
    ]
  })
}
export async function handleLogging () {
  let currentDir = process.cwd()
  const knownFile = 'package.json'
  const logFiles = ['error.log', 'info.log', 'warn.log']

  while (true) {
    try {
      await fsPromises.access(
        path.join(currentDir, knownFile),
        fsPromises.constants.F_OK
      )

      const logsDirectory = path.resolve(currentDir, 'logs')

      if (!existsSync(logsDirectory)) {
        await fsPromises.mkdir(logsDirectory, { recursive: true })
        console.log(`Logs directory created at ${logsDirectory}`)
      }

      for (const logFile of logFiles) {
        const logFilePath = path.join(logsDirectory, logFile)

        try {
          await fsPromises.access(logFilePath, fsPromises.constants.F_OK)
        } catch (error) {
          try {
            await fsPromises.writeFile(logFilePath, '', 'utf-8')
            devLogger(`File '${logFile}' created.`, 'info')
          } catch (err) {
            devLogger(
              `Error creating file '${logFile}': ${err.message}`,
              'error'
            )
          }
        }
      }

      return currentDir
    } catch (error) {
      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) {
        throw new Error(`Could not find project root.`)
      }
      currentDir = parentDir
    }
  }
}
export default function devLogger (message, logLevel = 'info', onlyLog = false) {
  const winston = getWinstonConfig()
  const timestamp = new Date().toISOString()
  const formattedMessage = `${timestamp}: ${message}`

  if (onlyLog) {
    switch (logLevel.toLowerCase()) {
      case 'info':
        console.info(formattedMessage)
        break
      case 'warn':
        console.warn(formattedMessage)
        break
      case 'error':
        console.error(formattedMessage)
        break
      case 'table':
        console.table(formattedMessage)
        break
      default:
        console.warn(`> Unknown log level: ${logLevel}`)
        throw new Error('Invalid log level in <devLogger>')
    }
  } else {
    switch (logLevel.toLowerCase()) {
      case 'info':
        winston.info(formattedMessage)
        break
      case 'warn':
        winston.warn(formattedMessage)
        break
      case 'error':
        winston.error(formattedMessage)

        break
      case 'table':
        winston.info(formattedMessage)
        break
      default:
        winston.warn(`> Unknown log level: ${logLevel}`)
        throw new Error('Invalid log level in <devLogger>')
    }
  }
}
