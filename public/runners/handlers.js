import { LOGIN_HTML, handleCookieAcceptance } from '../pages/login.js'
import { MAIN_PAGE } from '../pages/main_container.js'

//Initializer
export async function INITIALIZE_APP () {
  const cookieConcent = await handleCookieAcceptance()
  if (!cookieConcent) return
  const token = sessionStorage.getItem('token')
  try {
    if (token) return await MAIN_PAGE()
    LOGIN_HTML()
  } catch (error) {
    console.log(error.message)
  }
}
