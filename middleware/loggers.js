import kleur from 'kleur'
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
export async function findRootAndCreateLogsFolder () {
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
const formatLogMessage = async (message, level) => {
  const timestamp = new Date().toISOString()
  const logLevels = ['info', 'warn', 'error']

  if (!logLevels.includes(level.toLowerCase())) {
    return message
  }

  let logMessage = `${timestamp} [${level.toUpperCase()}]: `

  // Add the message directly
  if (typeof message === 'string') {
    logMessage += message
  } else if (Array.isArray(message)) {
    logMessage += JSON.stringify(message)
  } else if (typeof message === 'object') {
    logMessage += JSON.stringify(message)
  } else {
    logMessage += message.toString()
  }

  return logMessage
}
export async function logger (message, level = 'info') {
  const winston = getWinstonConfig()
  try {
    const logMessage = await formatLogMessage(message, level)

    switch (level.toLowerCase()) {
      case 'info':
        winston.info(logMessage)
        break
      case 'warn':
        winston.warn(logMessage)
        break
      case 'error':
        winston.error(logMessage)
        break
      default:
        winston.info(logMessage)
    }
  } catch (error) {
    console.log(message)
    winston.info(message)
  }
}
export function devLogger (message, logLevel = 'info') {
  const timestamp = new Date().toISOString()
  const original_timestamp = kleur.italic().cyan(`${timestamp}`)
  const formattedMessage = `${original_timestamp} ${message}`

  switch (logLevel.toLowerCase()) {
    case 'info':
      console.log(kleur.green(`${formattedMessage}`))
      break
    case 'warn':
      console.warn(kleur.yellow(`${formattedMessage}`))
      break
    case 'error':
      console.error(kleur.red(`${formattedMessage}`))
      break
    case 'table':
      if (
        Array.isArray(message) &&
        message.length > 0 &&
        typeof message[0] === 'object'
      ) {
        console.table(message)
      } else {
        console.log(kleur.italic().cyan(`${formattedMessage}`))
      }
      break
    default:
      console.warn(kleur.bgRed(`> Unknown log level: ${logLevel}`))
      throw new Error('Invalid log level in <devLogger>')
  }
}
