import {
  API_CLIENT,
  runSpinner,
  Notify,
  displayLabel
} from '../lifters/works.js'
import { MAIN_PAGE } from '../pages/main_container.js'
import { LOGIN_HTML } from './login.js'

export async function UPDATE_PASSWORD_HTML () {
  let pageContent = `
    <nav class="navbar navbar-expand-lg">
    <div class="container-fluid">
        <a class="navbar-brand p-2 mb-1" href="#">
            <img src="../images/logo.png" alt="" width=40" height="40" style="border-radius: 50%;filter: gray(100%)"
                class="d-inline-block align-text-top">
        </a>
        <ul class="navbar-nav">
            <li class="nav-item">
                <a id="to_login_p" class="nav-link active text-white" aria-current="page" href="#">LOGIN</a>
            </li>
        </ul>
    </div>
  </nav>
  <main id="main__wrapper" class="container container-fluid my-10 position-relative">
    <div class="container update___password container-fluid">
        <h3 class="text-center p-3 text-white">UPDATE PASSWORD</h3>
        <form id="update_password_form" class="p-3 rounded pt-2 text-white">
            <div class="mb-3">
                <label for="userInputEmail" class="form-label">Email address</label>
                <input type="email" name="email" class="form-control" placeholder="Enter your email"
                    id="userInputEmail" aria-describedby="emailHelp" required>
                <div class="invalid-feedback">Please enter a valid email address.</div>
            </div>
            <div class="mb-3">
                <label for="exampleInputPassword1" class="form-label">New password</label>
                <input type="password" name="new_password" placeholder="Type your new password" class="form-control"
                    id="exampleInputPassword1" autocomplete="current-password webauthn"  required>
                <div class="invalid-feedback">Please enter your new password.</div>
            </div>
            <div class="mb-3">
                  <label for="vericationTokenX" class="form-label">Verification token</label>
                  <input type="text" name="verification_token" placeholder="Paste verification token here" class="form-control"
                      id="vericationTokenX" required>
                  <div class="invalid-feedback">Verification token you received in yoru email is required!</div>
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

  const navbarBrand = document.querySelector('#to_login_p')
  navbarBrand?.addEventListener('click', async () => {
    LOGIN_HTML()
  })

  const updatePasswordForm = document.querySelector('#update_password_form')

  updatePasswordForm?.addEventListener('submit', async event => {
    runSpinner(false, 'Processing')
    event.preventDefault()

    const formData = new FormData(updatePasswordForm)
    const password = formData.get('new_password')
    const verification_token = formData.get('verification_token')
    const email = formData.get('email')

    try {
      let url = '/user/update/password'
      const response = await API_CLIENT.post(url, {
        password,
        verification_token,
        email
      })
      if (response.status == 200) {
        runSpinner(true)
        const token = response.headers.authorization.split(' ')[1]
        sessionStorage.setItem('token', JSON.stringify({ token, email }))
        // Redirect to main page
        sessionStorage.setItem('redirected', true)
        //   show logout button
        displayLabel([
          'main__wrapper',
          'alert-success',
          'Password update successfull'
        ])
        setTimeout(async () => {
          runSpinner(true)
          history.pushState(null, null, '/')
          await MAIN_PAGE()
        }, 800)
      }
    } catch (error) {
      runSpinner(false, 'Failed!')
      const errorMessage = error.response.data.error || 'An error occurred.'
      Notify(`${errorMessage}.`)
      displayLabel([
        'main__wrapper',
        'alert-danger',
        'Process failed. the token can be found in your email'
      ])
      setTimeout(() => runSpinner(true), 100)
    }
  })
}
export async function passwordNotice () {
  runSpinner(false)
  const noticeHtml = `<div class="alert alert-transparent text-light" role="alert">
    You request for a password change has been received successfully.  A secret token to facilitate a password reset has been send to your email address associated with this account. Follow these steps to update your password: <br>1. Copy the token in your email.<br>2. Click on  <a id="show_html" href="#">this link</a> and fill in the form accordingly.
  </div>`

  const emailDefault = JSON.parse(sessionStorage?.getItem('token'))
  const emailValue = document.getElementById('exampleInputEmail1')?.value
  let email = emailValue || emailDefault

  try {
    let url = 'user/forgot-password'
    if (!email || email === undefined)
      return displayLabel([
        'main__wrapper',
        'alert-warning',
        'Please enter your email address...'
      ])

    const response = await API_CLIENT.post(url, { email })
    if (response.status == 200) {
      runSpinner(true)
      displayLabel(['main__wrapper', 'alert-success', 'Request accespted!'])
      setTimeout(async () => {
        runSpinner(true)
        document.querySelector('.log___in').innerHTML = noticeHtml
        await renderUpdateHTML('#show_html')
      }, 100)
    }
  } catch (error) {
    runSpinner(false)
    const errorMessage = error.response.data.error || 'An error occurred.'
    displayLabel(['main__wrapper', 'alert-danger', `YOpps: ${errorMessage}`])
    setTimeout(() => runSpinner(true), 800)
    console.log(error.message)
  } finally {
    runSpinner(true)
  }
}
export async function disableElement (isDisabled, element) {
  var targetElement = document.querySelector(element)

  if (targetElement) {
    targetElement.disabled = isDisabled
  } else {
    console.error('Element not found:', element)
  }
}
// render update function html
export async function renderUpdateHTML (element) {
  let link_element = document.querySelector(element)
  link_element?.addEventListener('click', UPDATE_PASSWORD_HTML)
}
