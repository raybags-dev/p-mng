import util from 'util'
import { exec } from 'child_process'
import { v4 as uuidv4 } from 'uuid'

import devLogger from '../middleware/loggers.js'

const execPromise = util.promisify(exec)
export const genUUID = () => uuidv4()
export async function clearDevPort (port) {
  try {
    const { stdout, stderr } = await execPromise(`lsof -ti:${port}`)
    if (stderr) throw new Error(stderr)

    const pidList = stdout.split('\n').filter(Boolean)
    if (pidList.length) {
      for (const pid of pidList) {
        await execPromise(`kill -9 ${pid}`)
        devLogger(`Resolving process: <${pid}> on port ${port}`, 'warn')
      }
    }
  } catch (error) {
    devLogger(`Failed! Port ${port} unavailable.`, 'warn')
  }
}
export const getTimestamp = () => new Date().toISOString()

export const getResponse = (
  statusCode,
  message,
  isError = true,
  data = null
) => {
  return {
    statusCode,
    message,
    isError,
    data,
    timestamp: getTimestamp()
  }
}
export const sendResponse = (
  res,
  status,
  message,
  isError = false,
  data = {}
) => {
  const resMsg = getResponse(status, message, isError, data)
  return res.status(status).json(resMsg)
}
export const sanitizeDBObject = (object, fieldsToRemove) => {
  const objectCopy = object.toObject ? object.toObject() : { ...object }
  fieldsToRemove.forEach(key => delete objectCopy[key])
  return objectCopy
}
