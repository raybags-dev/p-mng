import { ObjectId } from 'mongodb'
import { DOCUMENT } from '../models/documentModel.js'

export async function FindOneDocController (req, res) {
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
}
