import express from 'express'
const router = express.Router()

import { asyncMiddleware } from '../../middleware/asyncErros.js'
import {
  loginHelper,
  logoutHelper,
  updateHelper,
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
  Login,
  Logout,
  GetUser,
  UpdateUser,
  CreateUser,
  DeleteUser,
  GetCurrentUser,
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
  },
  {
    method: 'get',
    path: '/ray-bags/manager-node/user/:id',
    handler: [authenticateUser, isSuperUser, asyncMiddleware(GetUser)]
  },
  {
    method: 'put',
    path: '/ray-bags/manager-node/user/update/:id?',
    handler: [authenticateUser, updateHelper, asyncMiddleware(UpdateUser)]
  }
]
routes.forEach(({ method, path, handler }) => {
  router[method](path, handler)
})

export default router
