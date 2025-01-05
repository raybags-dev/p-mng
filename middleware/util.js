import util from 'util'
import { exec } from 'child_process'

const execPromise = util.promisify(exec)

export async function clearDevPort (port) {
  try {
    const { stdout, stderr } = await execPromise(`lsof -ti:${port}`)
    if (stderr) throw new Error(stderr)

    const pidList = stdout.split('\n').filter(Boolean)
    if (pidList.length) {
      for (const pid of pidList) {
        await execPromise(`kill -9 ${pid}`)
        console.log(`Killed process with PID ${pid} on port ${port}`)
      }
    }
  } catch (error) {
    console.error(`Error checking or killing port ${port}:`, error.message)
  }
}
