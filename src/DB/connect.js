import mongoose from 'mongoose'
import { devLogger } from '../../middleware/loggers.js'

export default function connectToDB (url, isConnect) {
  if (isConnect) {
    try {
      mongoose.set('strictQuery', true)
      devLogger('Connecting to database...')
      return mongoose
        .connect(url)
        .then(() => devLogger('Connected to Database ✓ ✓ ✓ ✓'))
    } catch (e) {
      devLogger(e.message)
    }
  }
  return devLogger('Database connection failed.', 'error')
}
