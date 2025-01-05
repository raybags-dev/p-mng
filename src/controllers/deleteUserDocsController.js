import { sendEmail } from '../../middleware/emailer.js'
import { ObjectId } from 'mongodb'
import { DOCUMENT } from '../models/documentModel.js'
import { USER_MODEL, USER_ID_MODEL } from '../models/user.js'

const { RECIPIENT_EMAIL, AWS_BUCKET_NAME, AWS_REGION } = process.env

export async function deleteUserAndOwnDocsController (req, res) {
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

    const isSuperUser = await USER_MODEL.isSuperUser(req.locals.superUserToken)
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
}
export async function deleteUserDocsController (req, res) {
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
    return res.status(200).json({ message: 'User has no documents to delete' })
  }
  for (const document of documents) {
    await document.delete()
  }
  const deleteUserDocsEmailData = {
    title: 'User documents deleted!',
    body: `All user documents '${documents.length}', have been deleted from your S3 bucket: "${AWS_BUCKET_NAME}" in: ${AWS_REGION}.`
  }
  await sendEmail(deleteUserDocsEmailData, RECIPIENT_EMAIL)

  const { name, email, createdAt } = user
  res.status(200).json({
    message: 'User documents deleted',
    user_profile: { username: name, user_email: email, createdAt }
  })
}
export async function DeleteOneDocController (req, res) {
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
}
