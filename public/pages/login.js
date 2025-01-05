import { SIGNUP_HTML } from '../pages/signup.js'
import { passwordNotice, disableElement } from '../pages/update.js'
import {
  API_CLIENT,
  runSpinner,
  Notify,
  displayLabel
} from '../lifters/works.js'
import { MAIN_PAGE } from '../pages/main_container.js'

export async function LOGIN_HTML () {
  let pageContent = `
    <nav class="navbar navbar-expand-lg">
    <div class="container-fluid">
        <a class="navbar-brand p-2 mb-1" href="#">
            <img src="../images/logo.png" alt="" width=40" height="40" style="border-radius: 50%;filter: gray(100%)"
                class="d-inline-block align-text-top">
        </a>
  
        <ul class="navbar-nav">
            <li class="nav-item">
                <a id="to_sigup_p" class="nav-link active text-white" aria-current="page" href="#">SIGNUP</a>
            </li>
        </ul>
    </div>
  </nav>
  <main id="main__wrapper" class="container container-fluid my-10 position-relative">
    <div class="container log___in container-fluid">
        <h3 class="text-center p-3 text-white">LOGIN</h3>
        <form id="login___form" class=" p-3 rounded pt-2 text-white container-fluid">
            <div class="mb-3">
                <label for="exampleInputEmail1" class="form-label">Email address</label>
                <input type="email" name="email" class="form-control" placeholder="Enter your email"
                    id="exampleInputEmail1" aria-describedby="emailHelp" required>
                <div class="invalid-feedback">Please enter a valid email address.</div>
            </div>
            <div class="mb-3">
                  <label for="exampleInputPassword1" class="form-label">Password</label>
                  <input type="password" name="password" placeholder="Enter your password" class="form-control"
                      id="exampleInputPassword1" autocomplete="current-password webauthn"  required>
                  <div class="invalid-feedback">Please enter your password.</div>
            </div>
            <div id="checker" class="form-check form-switch mt-3 mb-3 hide_2">
                      <input class="form-check-input"  type="checkbox" role="switch" id="flexSwitchCheckDefault">
                      <label class="form-check-label" for="flexSwitchCheckDefault">Forgot password</label>
            </div>
            <div class="d-grid gap-2">
                <button type="submit" style="box-shadow: inset 0 -3em 3em rgba(0, 0, 0, 0.1), 0 0 0 2px rgb(255, 255, 255, .4),
                0.3em 0.3em 1em rgba(0, 0, 0, 0.3);" class="btn btn-transparent login_btn text-white">SUBMIT</button>
            </div>
        </form>
    </div>
  </main>
      `
  document.getElementById('innerBody').innerHTML = pageContent

  const navbarBrand = document.querySelector('#to_sigup_p')
  navbarBrand?.addEventListener('click', async () => {
    SIGNUP_HTML()
  })
  // if checked, render password update component
  const change__checkbox = document.getElementById('flexSwitchCheckDefault')
  change__checkbox.addEventListener('change', async function () {
    if (change__checkbox.checked) {
      await disableElement(true, '.login_btn')
      await disableElement(true, '#exampleInputPassword1')
      setTimeout(async () => await passwordNotice(), 80)
    } else {
      await disableElement(false, '.login_btn')
      await disableElement(false, '#exampleInputPassword1')
    }
  })

  const loginForm = document.querySelector('#login___form')
  loginForm?.addEventListener('submit', async event => {
    runSpinner(false, 'Processing')
    event.preventDefault()
    const formData = new FormData(loginForm)
    const email = formData.get('email')
    const password = formData.get('password')

    try {
      let url = '/user/login'
      const response = await API_CLIENT.post(url, { email, password })
      if (response.status == 200) {
        runSpinner(true)
        const token = response.headers.authorization.split(' ')[1]
        const admin_token = response.headers['admin-token']

        sessionStorage.setItem(
          'token',
          JSON.stringify({ token, email, admin_token })
        )
        // Redirect to main page
        sessionStorage.setItem('redirected', true)
        //   show logout button
        displayLabel(['main__wrapper', 'alert-success', 'Loginsuccessfull 😀'])
        setTimeout(async () => {
          runSpinner(true)
          history.pushState(null, null, '/')
          await MAIN_PAGE()
        }, 800)
      }
    } catch (error) {
      runSpinner(false, 'Failed!')
      const errorMessage = error.response.data.error || 'An error occurred.'
      displayLabel(['main__wrapper', 'alert-danger', `${errorMessage}`])
      if (errorMessage.includes('Unauthorized')) {
        document.querySelector('#checker').classList.add('hide_2')
      }
      if (errorMessage.trim() === 'Invalid email or password') {
        document.querySelector('#checker').classList.remove('hide_2')
      }
      setTimeout(() => runSpinner(true), 100)
    }
  })
}
export async function loginUser (user) {
  const cookieRef = await handleCookieAcceptance()
  if (!cookieRef) return
  runSpinner(false, 'On it')
  const email = user.email
  const password = user.password

  try {
    let url = '/user/login'
    const response = await API_CLIENT.post(url, { email, password })
    if (response.status == 200) {
      await displayLabel([
        'main__wrapper',
        'alert-success',
        'Login successful...'
      ])
      runSpinner(true)
      const token = response.headers.authorization.split(' ')[1]
      const admin_token = response.headers['admin-token']

      sessionStorage.setItem(
        'token',
        JSON.stringify({ token, email, admin_token })
      )
      // Redirect to main page
      sessionStorage.setItem('redirected', true)
      Notify(`Login successful`)
      setTimeout(async () => {
        runSpinner(true)
        await MAIN_PAGE()
      }, 800)
    }
  } catch (error) {
    console.log(passwordsuggest)
    runSpinner(false, 'Failed!')
    const errorMessage = error.response.data.error || 'An error occurred.'
    displayLabel([
      'main__wrapper',
      'alert-danger',
      `Session error: ${errorMessage}`
    ])
    setTimeout(() => runSpinner(true), 800)
    console.log(error)
  } finally {
    runSpinner(true)
  }
}
export async function logOutUser (isLogout) {
  const cookieRef = await handleCookieAcceptance()
  if (!cookieRef) return

  if (isLogout) {
    const sessionToken = sessionStorage.getItem('token')
    if (sessionToken) {
      Notify(`Logout successful!`)
      displayLabel(['main__wrapper', 'alert-secondary', 'Logout successful!'])
      //   hide logout btn
      setTimeout(() => {
        sessionStorage.removeItem('token')
        sessionStorage.removeItem('redirected')
      }, 500)
    }
    await LOGIN_HTML()
  }
}
export async function handleCookieAcceptance () {
  try {
    const isCookiesAccepted = localStorage.getItem('isCookiesAccepted')

    if (isCookiesAccepted === 'false' || isCookiesAccepted === null) {
      const modalHTML = `
          <div class="modal fade text-dark" id="cookieModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-labelledby="cookieModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content bg-dark">
              <div class="modal-header">
                <h1 class="modal-title fs-5 text-light" id="cookieModalLabel">Cookie Policy</h1>
                <button type="button" class="btn-close text-light c--iie-c-btn" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p class="text-light">This website uses cookies to enhance the user experience. By accepting cookies, you agree to our <a href="#" class="text-primary">Terms of Service</a> and <a href="#" class="text-primary">Privacy Policy</a>.</p>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-lg btn-outline-secondary" id="rejectCookies" data-bs-dismiss="modal">Reject</button>
                <button type="button" class="btn btn-lg btn-outline-primary" id="acceptCookies">Accept</button>
              </div>
            </div>
          </div>
        </div>
      `

      document.body.insertAdjacentHTML('beforeend', modalHTML)
      const cookieModal = new bootstrap.Modal(
        document.getElementById('cookieModal')
      )
      cookieModal.show()

      document.getElementById('acceptCookies').addEventListener('click', () => {
        localStorage.setItem('isCookiesAccepted', 'true')
        localStorage.setItem('userGuideShown', 'false')
        cookieModal.hide()
        window.location.reload()
      })

      document.getElementById('rejectCookies').addEventListener('click', () => {
        localStorage.setItem('isCookiesAccepted', 'false')
        displayLabel([
          'body',
          'alert-danger',
          "Unfortunately, you can't use this application without consenting to the Terms of Service."
        ])
        cookieModal.hide()
        setTimeout(() => window.location.reload(), 5000)
      })

      document.querySelector('.c--iie-c-btn').addEventListener('click', () => {
        localStorage.setItem('isCookiesAccepted', 'false')
        displayLabel([
          'body',
          'alert-danger',
          "Unfortunately, you can't use this application without consenting to the Terms of Service."
        ])
        cookieModal.hide()
        setTimeout(() => window.location.reload(), 5000)
      })
    }
    return localStorage.getItem('isCookiesAccepted') === 'true'
  } catch (e) {
    console.log(e.message)
  }
}
