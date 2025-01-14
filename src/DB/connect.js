import mongoose from 'mongoose'
import devLogger from '../../middleware/loggers.js'

export default function connectToDB (url, isConnect) {
  if (isConnect) {
    try {
      mongoose.set('strictQuery', true)
      devLogger('Connecting to database...', 'info', false)
      return mongoose
        .connect(url, { serverSelectionTimeoutMS: 5000 })
        .then(() => devLogger('Connected to Database ✓ ✓ ✓ ✓', 'info', false))
    } catch (e) {
      devLogger(e.message)
    }
  }
  return devLogger('Database connection failed.', 'error')
}
