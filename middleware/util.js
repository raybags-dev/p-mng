import util from 'util'
import { exec } from 'child_process'

import { devLogger } from '../middleware/loggers.js'

const execPromise = util.promisify(exec)

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
