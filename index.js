import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import bodyParser from 'body-parser'
import startUp from './src/startup.js'
import mainRouter from './src/routesCompiler.js'
const app = express()

app.use(cors())
app.use(bodyParser.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))
app.use(express.json())
app.use(morgan('tiny'))

mainRouter(app)
startUp(app)
