import { randomBytes } from 'crypto'

export const genVerificationToken = async () => {
  const token = randomBytes(64).toString('hex')
  const secretToken = token
  return secretToken
}
