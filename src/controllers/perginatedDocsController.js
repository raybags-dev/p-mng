import { DOCUMENT } from '../models/documentModel.js'

export async function paginatedDocsController (req, res) {
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
}
