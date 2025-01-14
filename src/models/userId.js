import mongoose from 'mongoose'

const userIdSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    id: {
      type: String,
      required: true,
      unique: true
    }
  },
  { timestamps: true }
)

export { userIdSchema }
