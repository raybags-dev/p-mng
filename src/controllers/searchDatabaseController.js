import { DOCUMENT } from '../models/documentModel.js'

export async function SearchUserDocsController (req, res) {
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
}
