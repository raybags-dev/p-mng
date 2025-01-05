import router from './routes/mainRoutes.js'

import ControllerRegistry from './controllers/controllerRegistry.js'

const { NotSupportedRouter } = ControllerRegistry

export default async app => {
  try {
    app.use(router)
    try {
      app.use(NotSupportedRouter)
    } catch (e) {
      console.log(`Error setting up NotSupportedRouter: ${e}`)
    }
  } catch (error) {
    console.error('Error reading router files:', error)
  }
}
