import { sendEmail } from '../../middleware/emailer.js'
import { ObjectId } from 'mongodb'
import { DOCUMENT } from '../models/documentModel.js'
import { USER_MODEL, USER_ID_MODEL } from '../models/user.js'

import { v4 as uuidv4 } from 'uuid'
import { genVerificationToken } from '../../middleware/generateToken.js'

import { config } from 'dotenv'
config()

const { RECIPIENT_EMAIL, SECRET_ADMIN_TOKEN, SUPER_USER_TOKEN } = process.env

const fallbackPagePath = new URL(
  '../../errorPage/noConnection.html',
  import.meta.url
).pathname

const ControllerRegistry = {
  deleteUserAndOwnDocsController: async function (req, res) {
    const userId = req.params.userId
    const loggedInUserId = req.locals.user._id

    try {
      const userToDelete = await USER_MODEL.findById(
        { _id: userId },
        { isAdmin: 0, password: 0, _id: 0 }
      )

      if (!userToDelete) {
        return res.status(404).json({ error: 'User not found' })
      }

      const isSuperUser = await USER_MODEL.isSuperUser(
        req.locals.superUserToken
      )
      const isAdmin = req.locals.user.isAdmin
      const isAdminUser = USER_MODEL.isAdminUser(
        req.locals.user.isAdmin,
        req.locals.user.isSuperUser
      )

      const isOwner = await USER_MODEL.isOwner(loggedInUserId, userId)

      if (!isSuperUser && !isAdmin && !isAdminUser && !isOwner) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      if (isSuperUser) {
        // Super user logic
        if (userToDelete) await DOCUMENT.deleteMany({ user: userId })
        await USER_ID_MODEL.deleteOne({ _id: userToDelete.userId.toString() })

        const { acknowledged } = await USER_MODEL.deleteOne({ _id: userId })

        const { name, email, createdAt } = userToDelete
        return res.status(200).json({
          status: acknowledged,
          user_profile: { username: name, user_email: email, createdAt },
          message: `User profile ${userId}, and all related documents have been deleted`
        })
      }

      // Non-super user logic (if not a super user)
      if (userToDelete) await DOCUMENT.deleteMany({ user: userId })
      await USER_ID_MODEL.deleteOne({ _id: userToDelete.userId.toString() })

      // Delete the user
      const { acknowledged } = await USER_MODEL.deleteOne({ _id: userId })

      const { name, email, createdAt } = userToDelete
      res.status(200).json({
        status: acknowledged,
        user_profile: { username: name, user_email: email, createdAt },
        message: `User profile ${userId}, and all related documents have been deleted`
      })
    } catch (error) {
      console.error('Error deleting user:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
  deleteUserDocsController: async function (req, res) {
    const userId = req.params.userId
    const user = await USER_MODEL.findById(
      { _id: userId },
      { isAdmin: 0, password: 0, _id: 0, userId: 0 }
    )
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const documents = await DOCUMENT.find({ user: userId })
    if (documents.length === 0) {
      return res
        .status(200)
        .json({ message: 'User has no documents to delete' })
    }
    for (const document of documents) {
      await document.delete()
    }
    const deleteUserDocsEmailData = {
      title: 'User documents deleted!',
      body: `All user documents '${documents.length}', have been deleted`
    }
    await sendEmail(deleteUserDocsEmailData, RECIPIENT_EMAIL)

    const { name, email, createdAt } = user
    res.status(200).json({
      message: 'User documents deleted',
      user_profile: { username: name, user_email: email, createdAt }
    })
  },
  DeleteOneDocController: async function (req, res) {
    try {
      const itemId = req.params.id
      const { isAdmin } = req.user
      let item = await DOCUMENT.findOne({ _id: new ObjectId(itemId) })

      if (!item) {
        return res.status(404).json('Document could not be found')
      }

      // Call the static method directly
      const isDocumentOwner = await DOCUMENT.isDocumentOwner(req)

      // If the user created the document or is an admin, they can delete it
      if (isDocumentOwner || isAdmin) {
        await item.delete()

        return res.status(200).json({
          message: 'Document deleted',
          deletedDocument: {
            filename: item.filename,
            _id: item._id,
            deletedAt: new Date().toISOString()
          }
        })
      }

      return res
        .status(401)
        .json({ message: 'You are not authorized to delete this Document' })
    } catch (error) {
      console.error('Error in DeleteOneDocController:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
  FindOneDocController: async function (req, res) {
    try {
      const itemId = req.params.id
      const userId = req.user.data._id

      const document = await DOCUMENT.findOne({ _id: new ObjectId(itemId) })
      if (document.user.toString() === userId.toString()) {
        const updatedDoc = null
        return res.status(200).json({ message: 'Success', ...updatedDoc })
      }

      res.status(403).json({ message: 'Access denied' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Server error' })
    }
  },
  ForgotPasswordController: async function (req, res) {
    const { email } = req.body
    const the_user = await USER_MODEL.findOne({ email: req.body.email })

    if (!the_user) {
      return res.status(409).send({
        error:
          'The account associated with the email address provided could not be found.'
      })
    }

    const resetToken = await the_user.setPasswordResetToken()
    // send email to user for token.
    const emailData = {
      title: 'Important: Request to update password',
      body: `A request to update the password for this account was received successfully. This is your token to update your password.\nVerification Token: ${resetToken}\n\nUsage: Copy the token string and paste it in the appropriate field. \nThe Token will remain active for only 24hrs.`
    }

    try {
      await sendEmail(emailData, email, resetToken)
      res.status(200).json({ message: 'Password reset email sent.' })
    } catch (error) {
      console.error('Error generating verification token:', error)
      res.status(500).json({ error: 'Error generating verification token.' })
    }
  },
  UpdatePasswordController: async function (req, res) {
    try {
      const user = await USER_MODEL.findOne({ email: req.body.email })
      const token = user.generateAuthToken()
      const userObject = user.toObject()
      delete userObject.password
      res.status(200).json({ user: userObject, token })
    } catch (error) {
      console.log(error.message)
      res.status(500).json({ error: 'Server error' })
    }
  },
  paginatedDocsController: async function (req, res) {
    try {
      // Validate document ownership using the middleware
      await DOCUMENT.validateDocumentOwnership(req, res, async () => {
        const { _id: userId } = await req.user
        const query = DOCUMENT.find({ user: userId }, { token: 0 }).sort({
          createdAt: -1
        })

        const countQuery = query.model.find(query.getFilter())
        const count = await countQuery.countDocuments()
        let page = parseInt(req.query.page) || 1
        let perPage = parseInt(req.query.perPage) || 10
        let totalPages = Math.ceil(count / perPage)
        const skip = (page - 1) * perPage
        const response = await query.skip(skip).limit(perPage)

        if (response.length === 0)
          return res.status(404).json({
            message: 'Nothing found',
            totalCount: count,
            data: response
          })

        const updatedDocs = null
        res.status(200).json({
          totalPages: totalPages,
          totalCount: count,
          data: updatedDocs
        })
      })
    } catch (error) {
      console.error('Error in paginatedDocsController:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
  SearchUserDocsController: async function (req, res) {
    const { searchQuery } = req.body
    const { _id: userId, isAdmin } = req.user
    console.log(userId)

    let query, count

    if (!searchQuery) {
      return res.status(400).json('Search query is required.')
    }

    if (isAdmin) {
      query = DOCUMENT.find(
        { $text: { $search: searchQuery } },
        { token: 0 }
      ).sort({ createdAt: -1 })
      count = await DOCUMENT.countDocuments({
        $text: { $search: searchQuery }
      })
    } else {
      query = DOCUMENT.find(
        { user: userId, $text: { $search: searchQuery } },
        { token: 0 }
      ).sort({ createdAt: -1 })
      count = await DOCUMENT.countDocuments({
        user: userId,
        $text: { $search: searchQuery }
      })
    }

    const response = await query

    if (response.length === 0) return res.status(404).json('Nothing found!')

    res.status(200).json({ count, documents: null })
  },
  DocsUploaderController: async function (req, res) {
    try {
      return null
    } catch (error) {
      console.log(error)
      if (error.name === 'ValidationError') {
        if (error.errors.question) {
          return res.status(400).json({
            status: 'Bad request!',
            message: error.errors.question.message
          })
        }
        if (error.errors.response) {
          return res.status(400).json({
            status: 'Error',
            message: error.errors.response.message
          })
        }
        if (error.errors.user) {
          return res.status(400).json({
            status: 'Error',
            message: error.errors.user.message
          })
        }
      }

      return res.status(500).json({
        status: 'Error',
        message: 'An internal error occurred:  ' + error.message
      })
    }
  },
  CreateUserController: async function (req, res) {
    try {
      const { name, email, password, isAdmin, secret, superUserToken } =
        req.body
      const isAdminUser = secret === `${SECRET_ADMIN_TOKEN}`
      const userIsAdmin = isAdmin && isAdminUser

      const isSuperUser = superUserToken === `${SUPER_USER_TOKEN}`

      if (isAdmin && !isAdminUser) {
        return res
          .status(400)
          .send({ error: 'Unauthorized - This action is forbidden!' })
      }

      const existingUser = await USER_MODEL.findOne({ email })
      if (existingUser) {
        return res.status(409).send({ error: 'User already exists' })
      }

      const newUserId = await USER_ID_MODEL.create({})
      const userId = newUserId._id

      let user
      const isSubscribed = false

      if (isSuperUser) {
        user = new USER_MODEL({
          name,
          email,
          password,
          userId,
          isAdmin: userIsAdmin,
          superUserToken,
          isSuperUser: true,
          isSubscribed: true
        })
        await user.save()
      } else {
        user = new USER_MODEL({
          name,
          email,
          password,
          userId,
          isAdmin: userIsAdmin,
          isSubscribed: isSubscribed
        })
        await user.save()
      }

      const token = user.generateAuthToken()

      const createUserEmailData = {
        title: 'User account created successfully',
        body: `A user:\n${user}\n has successfully been created`
      }
      await sendEmail(createUserEmailData, RECIPIENT_EMAIL)

      res
        .status(201)
        .send({ user: { name, email, isAdmin: user.isAdmin }, token })
    } catch (error) {
      console.error('Error processing request:', error.message)
      res.status(400).send({ error: error.message })
    }
  },
  LoginController: async function (req, res) {
    try {
      const user = await USER_MODEL.findOne({ email: req.body.email })
      const token = user.generateAuthToken()

      const userObject = user.toObject()
      delete userObject.password
      res.status(200).json({ user: userObject, token })
    } catch (error) {
      console.log(error.message)
      res.status(500).json({ error: 'Server error' })
    }
  },
  GetUserController: async function (req, res) {
    try {
      const email = req.locals.user.email
      const isSuperUser = await USER_MODEL.isSuperUser(
        req.locals.user.superUserToken
      )
      let user = {}
      let updatedUser = {}
      let count
      if (isSuperUser) {
        user = await USER_MODEL.findOne({ email })
        if (!user) return res.status(404).json('User not found!')

        count = await DOCUMENT.countDocuments({ user: user._id })
        updatedUser = {
          ...user.toObject(),
          DocumentCount: count
        }

        res.status(200).json(updatedUser)
        return
      }
      user = await USER_MODEL.findOne(
        { email },
        {
          token: 0,
          password: 0,
          isAdmin: 0,
          version: 0,
          __v: 0,
          superUserToken: 0,
          isSuperUser: 0
        }
      )
      if (!user) return res.status(404).json('User not found!')

      count = await DOCUMENT.countDocuments({ user: user._id })
      updatedUser = {
        ...user.toObject(),
        DocumentCount: count
      }
      res.status(200).json(updatedUser)
    } catch (e) {
      console.log(e)
    }
  },
  GetAllUsersController: async function (req, res) {
    try {
      const isSuperUser = await USER_MODEL.isSuperUser(
        req.locals.user.superUserToken
      )
      if (!isSuperUser)
        return res
          .status(401)
          .json({ error: 'Unauthorized - Not a super user' })

      const currentUser = req.locals.user
      const perPage = 10
      let page = parseInt(req.query.page) || 1

      const skip = (page - 1) * perPage

      const users = await USER_MODEL.aggregate([
        {
          $match: {
            _id: { $ne: currentUser._id }
          }
        },
        {
          $lookup: {
            from: 'documents',
            localField: '_id',
            foreignField: 'user',
            as: 'documents'
          }
        },
        {
          $addFields: {
            totalDocumentsOwned: { $size: '$documents' }
          }
        },
        {
          $project: {
            documents: 0,
            password: 0,
            token: 0,
            __v: 0
          }
        },
        {
          $sort: { totalDocumentsOwned: -1 } // sorting by totalDocumentsOwned in DESC order
        },
        {
          $skip: skip
        },
        {
          $limit: perPage
        }
      ])

      const totalUserCount = await USER_MODEL.countDocuments({
        _id: { $ne: currentUser._id }
      })

      if (users.length === 0) {
        return res.status(404).json({
          profile_count: 0,
          current_page: page,
          next_page: null,
          page_count: 0,
          user_profiles: []
        })
      }

      const pageCount = Math.ceil(totalUserCount / perPage)
      const currentPageCount = users.length
      const hasMore = totalUserCount > skip + perPage
      let nextPage = null
      if (hasMore) {
        nextPage = page + 1
      }

      res.status(200).json({
        profile_count: totalUserCount,
        current_page: page,
        next_page: nextPage,
        page_count: pageCount,
        current_page_count: currentPageCount,
        user_profiles: users
      })
    } catch (error) {
      console.error('Error getting all users:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
  AllUserDocsController: async function (req, res) {
    try {
      const { isAdmin, _id: userId } = req.user

      await DOCUMENT.validateDocumentOwnership(req, res, async () => {
        let query, count

        if (isAdmin) {
          query = DOCUMENT.find({}, { token: 0 }).sort({ createdAt: -1 })
          count = await DOCUMENT.countDocuments({})
        } else {
          // filter documents only owned by the user
          query = DOCUMENT.find({ $or: [{ user: userId }] }, { token: 0 }).sort(
            {
              createdAt: -1
            }
          )

          count = await DOCUMENT.countDocuments({ user: userId })
        }
        const response = await query

        if (response.length === 0) return res.status(404).json('Nothing found!')

        // Filter documents based on ownership using the isOwner method
        const ownedDocuments = response.filter(async doc => {
          return await USER_MODEL.isOwner(userId, doc.user.toString())
        })

        // Use the checkAndUpdateDocumentUrls function to update document URLs
        const updatedDoc = null
        res.status(200).json({ count: count, documents: updatedDoc })
      })
    } catch (error) {
      console.error('Error in AllUserDocsRouter:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
  UpdateSubscriptionController: async function (req, res) {
    try {
      const isSuperUser = await USER_MODEL.isSuperUser(
        req.locals.user.superUserToken
      )

      if (!isSuperUser) {
        return res
          .status(401)
          .json({ error: 'Unauthorized - Action forbidden!' })
      }

      const userIdToUpdate = req.params.userId
      const user = await USER_MODEL.findById(userIdToUpdate)

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }
      user.isSubscribed = !user.isSubscribed
      await user.save()

      res.status(200).json({
        state: 'Success',
        message: 'Subscription status updated!',
        isSubscribed: user.isSubscribed
      })
    } catch (error) {
      console.error('Error updating subscription status:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
  GetSubscriptionController: async function (req, res) {
    try {
      const isSuperUser = await USER_MODEL.isSuperUser(
        req.locals.user.superUserToken
      )
      if (!isSuperUser) {
        return res
          .status(401)
          .json({ error: 'Unauthorized - action forbidden!' })
      }

      const userIdToUpdate = req.params.userId
      const user = await USER_MODEL.findById(userIdToUpdate)
      const subStatus = await USER_MODEL.getSubscriptionStatus(userIdToUpdate)

      if (subStatus === null) {
        return res.status(404).json({ error: 'Status could not be retrieved' })
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      res.status(200).json({
        _id: userIdToUpdate,
        message: 'Success, subscription status retrieved!',
        isSubscribed: subStatus
      })
    } catch (error) {
      console.error('Error toggling subscription status:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  },
  NotSupportedRouter: async function (req, res) {
    res.status(502).sendFile(fallbackPagePath)
  }
}

export default ControllerRegistry
