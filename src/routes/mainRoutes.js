import express from 'express'
const router = express.Router()

import { asyncMiddleware } from '../../middleware/asyncErros.js'

import {
  authMiddleware,
  extractTokenMiddleware,
  checkDocumentAccess,
  loginUser,
  isAdmin
} from '../../middleware/auth.js'

import ControllerRegistry from '../controllers/controllerRegistry.js'

const {
  SearchUserDocsController,
  FindOneDocController,
  deleteUserDocsController,
  LoginController,
  CreateUserController,
  GetAllUsersController,
  DocsUploaderController,
  GetUserController,
  AllUserDocsController,
  GetSubscriptionController,
  DeleteOneDocController,
  paginatedDocsController,
  ForgotPasswordController,
  UpdatePasswordController,
  UpdateSubscriptionController,
  deleteUserAndOwnDocsController
} = ControllerRegistry

const routes = [
  {
    method: 'post',
    path: '/raybags/manager/create-user',
    handler: CreateUserController
  },
  {
    method: 'post',
    path: '/raybags/manager/user/login',
    middleware: [loginUser],
    handler: LoginController
  },
  {
    method: 'post',
    path: '/raybags/manager/get-users',
    middleware: [authMiddleware, isAdmin],
    handler: GetAllUsersController
  },
  {
    method: 'post',
    path: '/raybags/manager/whoami',
    middleware: [authMiddleware],
    handler: GetUserController
  },
  {
    method: 'post',
    path: '/raybags/manager/user-docs',
    middleware: [authMiddleware],
    handler: AllUserDocsController
  },
  {
    method: 'put',
    path: '/raybags/manager/user/:userId/subscription',
    middleware: [authMiddleware, isAdmin],
    handler: UpdateSubscriptionController
  },
  {
    method: 'get',
    path: '/raybags/manager/user/:userId/subscription',
    middleware: [authMiddleware, isAdmin],
    handler: GetSubscriptionController
  },
  {
    method: 'delete',
    path: '/raybags/manager/delete-user-and-docs/:userId',
    middleware: [authMiddleware],
    handler: deleteUserAndOwnDocsController
  },
  {
    method: 'delete',
    path: '/raybags/manager/delete-doc/:id',
    middleware: [authMiddleware, checkDocumentAccess],
    handler: DeleteOneDocController
  },
  {
    method: 'post',
    path: '/raybags/manager/entry/:id',
    middleware: [authMiddleware, checkDocumentAccess],
    handler: FindOneDocController
  },
  {
    method: 'post',
    path: '/raybags/manager/user/forgot-password',
    handler: ForgotPasswordController
  },
  {
    method: 'post',
    path: '/raybags/manager/user/update/password',
    middleware: [loginUser],
    handler: UpdatePasswordController
  },
  {
    method: 'post',
    path: '/raybags/manager/paginated-user-documents',
    middleware: [authMiddleware],
    handler: paginatedDocsController
  },
  {
    method: 'post',
    path: '/raybags/manager/search-docs',
    middleware: [authMiddleware],
    handler: SearchUserDocsController
  },
  {
    method: 'post',
    path: '/raybags/manager/upload',
    middleware: [extractTokenMiddleware, authMiddleware],
    handler: DocsUploaderController
  }
]

routes.forEach(({ method, path, handler, middleware = [] }) => {
  router[method](
    path,
    ...middleware.map(m => asyncMiddleware(m)),
    asyncMiddleware(handler)
  )
})

export default router
