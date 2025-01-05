import { USER_MODEL } from '../models/user.js'
import { sendEmail } from '../../middleware/emailer.js'

export async function ForgotPasswordController (req, res) {
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
}
export async function UpdatePasswordController (req, res) {
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
