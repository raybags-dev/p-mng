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

import { SearchUserDocsController } from '../controllers/searchDatabaseController.js'

import { DocsUploaderController } from '../controllers/uploaderController.js'

import {
  LoginController,
  CreateUserController,
  GetAllUsersController,
  GetUserController,
  AllUserDocsController,
  UpdateSubscriptionController,
  GetSubscriptionController
} from '../controllers/userController.js'

import {
  ForgotPasswordController,
  UpdatePasswordController
} from '../controllers/passwordController.js'

import { paginatedDocsController } from '../controllers/perginatedDocsController.js'

import {
  deleteUserAndOwnDocsController,
  deleteUserDocsController,
  DeleteOneDocController
} from '../controllers/deleteUserDocsController.js'

import { FindOneDocController } from '../controllers/findOneController.js'

const routes = [
  {
    path: '/raybags/manager/create-user',
    handler: CreateUserController
  },
  {
    path: '/raybags/manager/user/login',
    handler: LoginController
  },
  {
    path: '/raybags/manager/get-users',
    handler: GetAllUsersController
  },
  {
    path: '/raybags/manager/whoami',
    handler: GetUserController
  },
  {
    path: '/raybags/manager/user-docs',
    handler: AllUserDocsController
  },
  {
    path: '/raybags/manager/user/:userId/subscription',
    handler: UpdateSubscriptionController
  },
  {
    path: '/raybags/manager/delete-user-and-docs/:userId',
    handler: deleteUserAndOwnDocsController
  },
  {
    path: '/raybags/manager/delete-user-docs/:userId',
    handler: deleteUserDocsController
  },
  {
    path: '/raybags/manager/delete-doc/:id',
    handler: DeleteOneDocController
  },
  {
    path: '/raybags/manager/entry/:id',
    handler: FindOneDocController
  },
  {
    path: '/raybags/manager/user/forgot-password',
    handler: ForgotPasswordController
  },
  {
    path: '/raybags/manager/user/update/password',
    handler: UpdatePasswordController
  },
  {
    path: '/raybags/manager/user/:userId/subscription',
    handler: GetSubscriptionController
  },
  {
    path: '/raybags/manager/search-docs',
    handler: SearchUserDocsController
  },
  {
    path: '/raybags/manager/upload',
    handler: DocsUploaderController
  },
  {
    path: '/raybags/manager/paginated-user-documents',
    handler: paginatedDocsController
  }
]

routes.forEach(route => {
  if (route.path == '/raybags/manager/create-user') {
    router.post(route.path, route.handler)
  }
  if (route.path == '/raybags/manager/user/login') {
    router.post(route.path, loginUser, route.handler)
  }
  if (route.path == '/raybags/manager/get-users') {
    router.post(
      route.path,
      authMiddleware,
      isAdmin,
      asyncMiddleware(route.handler)
    )
  }
  if (route.path == '/raybags/manager/whoami') {
    router.post(route.path, authMiddleware, asyncMiddleware(route.handler))
  }
  if (route.path == '/raybags/manager/user-docs') {
    router.post(route.path, authMiddleware, asyncMiddleware(route.handler))
  }
  if (route.path == '/raybags/manager/user/:userId/subscription') {
    router.put(
      route.path,
      authMiddleware,
      isAdmin,
      asyncMiddleware(route.handler)
    )
  }
  if (route.path == '/raybags/manager/user/:userId/subscription') {
    router.get(
      route.path,
      authMiddleware,
      isAdmin,
      asyncMiddleware(route.handler)
    )
  }
  if (route.path == '/raybags/manager/delete-doc/:id') {
    router.delete(
      route.path,
      authMiddleware,
      checkDocumentAccess,
      asyncMiddleware(route.handler)
    )
  }
  if (route.path == '/raybags/manager/entry/:id') {
    router.post(
      route.path,
      authMiddleware,
      checkDocumentAccess,
      asyncMiddleware(route.handler)
    )
  }
  if (route.path == '/raybags/manager/user/forgot-password') {
    router.post(route.path, asyncMiddleware(route.handler))
  }
  if (route.path == '/raybags/manager/user/update/password') {
    router.post(route.path, loginUser, route.handler)
  }

  if (
    route.path == '/raybags/manager/delete-user-and-docs/:userId' ||
    route.path == '/raybags/manager/delete-user-docs/:userId'
  ) {
    router.delete(route.path, authMiddleware, asyncMiddleware(route.handler))
  }

  if (route.path == '/raybags/manager/paginated-user-documents') {
    router.post(route.path, authMiddleware, asyncMiddleware(route.handler))
  }

  if (route.path == '/raybags/manager/search-docs') {
    router.post(route.path, authMiddleware, asyncMiddleware(route.handler))
  }
  if (route.path == '/raybags/manager/upload') {
    router.post(
      route.path,
      extractTokenMiddleware,
      authMiddleware,
      asyncMiddleware(route.handler)
    )
  }
})

export default router
