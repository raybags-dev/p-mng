import express from 'express'
const router = express.Router()

import { asyncMiddleware } from '../../middleware/asyncErros.js'
import {
  loginHelper,
  logoutHelper,
  elevatePrevilageHelper
} from '../../middleware/auth.js'
import {
  isAdmin,
  isSuperUser,
  authenticateUser,
  extractAndValidateToken
} from '../../utils/tokenUtils.js'

import ControllerRegistry from '../controllers/controllerRegistry.js'

const {
  CreateUser,
  Login,
  Logout,
  GetCurrentUser,
  DeleteUser,
  PromoteToSuperUser
} = ControllerRegistry

const routes = [
  {
    method: 'post',
    path: '/ray-bags/manager-node/create-user',
    handler: asyncMiddleware(CreateUser)
  },
  {
    method: 'post',
    path: '/ray-bags/manager-node/user/login',
    handler: [asyncMiddleware(loginHelper), asyncMiddleware(Login)]
  },
  {
    method: 'post',
    path: '/ray-bags/manager-node/user/logout',
    handler: [
      extractAndValidateToken,
      asyncMiddleware(logoutHelper),
      asyncMiddleware(Logout)
    ]
  },
  {
    method: 'post',
    path: '/ray-bags/manager-node/user/me',
    handler: [extractAndValidateToken, asyncMiddleware(GetCurrentUser)]
  },
  {
    method: 'delete',
    path: '/ray-bags/manager-node/user/delete',
    handler: [authenticateUser, isAdmin, asyncMiddleware(DeleteUser)]
  },
  {
    method: 'delete',
    path: '/ray-bags/manager-node/user/delete/:id',
    handler: [authenticateUser, isSuperUser, asyncMiddleware(DeleteUser)]
  },
  {
    method: 'post',
    path: '/ray-bags/manager-node/user/elevate-to-superuser',
    handler: [
      authenticateUser,
      isAdmin,
      asyncMiddleware(elevatePrevilageHelper),
      asyncMiddleware(PromoteToSuperUser)
    ]
  }
]
routes.forEach(({ method, path, handler }) => {
  router[method](path, handler)
})

export default router
