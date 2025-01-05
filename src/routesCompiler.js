import router from './routes/mainRoutes.js'

export default async app => {
  try {
    app.use(router)
    const { NotSupportedRouter } = await import(
      './controllers/notSupportedController.js'
    )
    try {
      app.use(NotSupportedRouter)
    } catch (e) {
      console.log(`Error setting up NotSupportedRouter: ${e}`)
    }
  } catch (error) {
    console.error('Error reading router files:', error)
  }
}
