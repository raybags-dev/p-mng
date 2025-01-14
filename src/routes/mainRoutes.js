import express from 'express'
const router = express.Router()

import { asyncMiddleware } from '../../middleware/asyncErros.js'
import {
  loginHelper,
  logoutHelper,
  elevateHelper
} from '../../middleware/auth.js'
import { verifySuperUserToken } from '../../utils/tokenUtils.js'

import ControllerRegistry from '../controllers/controllerRegistry.js'

const { CreateUser, Login, Logout, PromoteToSuperUser } = ControllerRegistry

const routes = [
  {
    method: 'post',
    path: '/ray-bags/manager-node/create-user',
    handler: asyncMiddleware(CreateUser)
  },
  {
    method: 'post',
    path: '/ray-bags/manager-node/user/login',
    handler: [loginHelper, asyncMiddleware(Login)]
  },
  {
    method: 'post',
    path: '/ray-bags/manager-node/user/logout',
    handler: [logoutHelper, asyncMiddleware(Logout)]
  },
  {
    method: 'post',
    path: '/ray-bags/manager-node/user/elevate-to-superuser',
    handler: [
      verifySuperUserToken,
      elevateHelper,
      asyncMiddleware(PromoteToSuperUser)
    ]
  }
]
routes.forEach(({ method, path, handler }) => {
  router[method](path, handler)
})

export default router
