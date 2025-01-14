import router from './routes/mainRoutes.js'
import devLogger from '../middleware/loggers.js'

export default async app => {
  try {
    app.use(router)
  } catch (e) {
    devLogger(`Error setting up Router: ${e}`, 'error')
  }
}
