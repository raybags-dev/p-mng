import { USER_MODEL, USER_ID_MODEL } from '../models/user.js'
import { sendEmail } from '../../middleware/emailer.js'
import { DOCUMENT } from '../models/documentModel.js'
import { config } from 'dotenv'
config()

const {
  RECIPIENT_EMAIL,
  AWS_BUCKET_NAME,
  AWS_REGION,
  SECRET_ADMIN_TOKEN,
  SUPER_USER_TOKEN
} = process.env

export async function CreateUserController (req, res) {
  try {
    const { name, email, password, isAdmin, secret, superUserToken } = req.body
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
      body: `A user:\n${user}\n has successfully been created in your S3 bucket: "${AWS_BUCKET_NAME}" in: ${AWS_REGION}.`
    }
    await sendEmail(createUserEmailData, RECIPIENT_EMAIL)

    res
      .status(201)
      .send({ user: { name, email, isAdmin: user.isAdmin }, token })
  } catch (error) {
    console.error('Error processing request:', error.message)
    res.status(400).send({ error: error.message })
  }
}
export async function LoginController (req, res) {
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
}
export async function GetUserController (req, res) {
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
}
export async function GetAllUsersController (req, res) {
  try {
    const isSuperUser = await USER_MODEL.isSuperUser(
      req.locals.user.superUserToken
    )
    if (!isSuperUser)
      return res.status(401).json({ error: 'Unauthorized - Not a super user' })

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
}
export async function AllUserDocsController (req, res) {
  try {
    const { isAdmin, _id: userId } = req.user

    await DOCUMENT.validateDocumentOwnership(req, res, async () => {
      let query, count

      if (isAdmin) {
        query = DOCUMENT.find({}, { token: 0 }).sort({ createdAt: -1 })
        count = await DOCUMENT.countDocuments({})
      } else {
        // filter documents only owned by the user
        query = DOCUMENT.find({ $or: [{ user: userId }] }, { token: 0 }).sort({
          createdAt: -1
        })

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
}
//***************==========
export async function UpdateSubscriptionController (req, res) {
  try {
    const isSuperUser = await USER_MODEL.isSuperUser(
      req.locals.user.superUserToken
    )

    if (!isSuperUser) {
      return res.status(401).json({ error: 'Unauthorized - Action forbidden!' })
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
}
//***************==========
export async function GetSubscriptionController (req, res) {
  try {
    const isSuperUser = await USER_MODEL.isSuperUser(
      req.locals.user.superUserToken
    )
    if (!isSuperUser) {
      return res.status(401).json({ error: 'Unauthorized - action forbidden!' })
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
}
