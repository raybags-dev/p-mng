import { PaginateData } from '../lifters/works.js'
import {
  API_CLIENT,
  runSpinner,
  Notify,
  fetchData,
  searchDatabase,
  downloadImageById,
  displayLabel
} from '../lifters/works.js'
import {
  DisplayUserProfileHTML,
  generateSubCards,
  addCardWithDelay,
  addAdminLinkToNavbar,
  checkAdminTokenAndFetchUser,
  deleteUser
} from '../components/card.js'
import { DisplayeBigImage } from '../components/card.js'
import { logOutUser, LOGIN_HTML } from '../pages/login.js'

export async function MAIN_PAGE () {
  let pageContent = `
      <nav  class="navbar navbar-expand-lg navbar-dark glassy" style="background-color: transparent;">
      <div class="container container-fluid img__conta">
      </div>
        <div class="container-fluid">
          <a class="navbar-brand" href="https://raybags.herokuapp.com" title="see portifolio" target="_blank">
          <img src="../images/logo.png" alt="" width="40" height="40" style="border-radius:50%;">
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarScroll" aria-controls="navbarScroll" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse bg-transparent" id="navbarScroll">
              <ul id="__nav" class="navbar-nav me-auto my-2 my-lg-0 navbar-nav-scroll bg-transparent" style="--bs-scroll-height: 100px;">
                <li class="nav-item dropdown">
                  <a class="dropdown-item  dropdown-item-dark text-white bg-transparent user_profile_link"href="#">Account</a>
                </li>
                <li class="nav-item dropdown">
                  <a class="dropdown-item  dropdown-item-dark text-white bg-transparent logoutuser_link" href="#">Logout</a>
                </li>
              </ul>
            <form class="d-flex doc_s_form" style="max-height:inherit !important">
              <input id="search____input" class="form-control me-2" autocomplete="off" type="search" placeholder="Search" aria-label="Search">
            </form>
          </div>
        </div>
      </nav>
      <main id="main__wrapper" class="container my-10 position-relative">
              <div class="label_class">
                <label id="showForm" class="label"><span>+</span></label>
              </div>
        <div id="off__Container" class="row row-cols-1 row-cols-md-3" style="transition:.5s !important;">
    
        </div>
      </main>
    `
  document.getElementById('innerBody').innerHTML = pageContent
  await PaginateData()
  const uploadLabel = document.querySelector('.label_class')
  uploadLabel?.addEventListener('click', generateUploadForm)

  await genCardCarucel()
  let mySearchTimeout = null
  let searchInput = document.querySelector('#search____input')

  function debounceSearchDatabase (e) {
    if (e && e.preventDefault) e.preventDefault()

    clearTimeout(mySearchTimeout)

    mySearchTimeout = setTimeout(async () => {
      const inputValue = searchInput?.value.trim().toLowerCase()

      if (e.type === 'blur' || inputValue === '') {
        console.log(e.type)
        await PaginateData()
      } else {
        await searchDatabase()
      }
    }, 1000)
  }

  searchInput?.addEventListener('input', debounceSearchDatabase)
  const logoutLink = document.querySelector('.logoutuser_link')
  logoutLink?.addEventListener('click', async () => {
    logOutUser(true)
  })
  const userProfileLink = document.querySelector('.user_profile_link')
  userProfileLink?.addEventListener('click', async () => {
    let containerExist = document.querySelector('#carocel_big')
    let couselBig = document.querySelector('.carucel___main')
    couselBig && couselBig.remove()
    if (containerExist) return
    await DisplayUserProfileHTML()
  })
  await setUpBackToTop('off__Container')
  await animateImages()
  let cardContainerr = document.querySelector('#off__Container')
  cardContainerr?.addEventListener('click', async function (event) {
    const isCard = event.target.classList.contains('card')
    const isImg = event.target.classList.contains('card-img-top')
    const isTrashCan = event.target.classList.contains('fa-trash-can')
    const isDownloadBtn = event.target.classList.contains('download-btn')

    if ((isImg || isCard) && !isTrashCan && !isDownloadBtn) {
      const cardElement = event.target.closest('.sm-card')
      if (cardElement) {
        const dataId = cardElement.getAttribute('data-id')
        const imgElement = cardElement.querySelector('.card-img-top')
        const imgSrc = imgElement ? imgElement.getAttribute('src') : null
        const ulElement = cardElement.querySelector('.card-body ul')
        const createdAt = ulElement?.querySelector('.creat_at')?.textContent
        const desc = cardElement?.querySelector('.img__desc')?.textContent
        await DisplayeBigImage(dataId, imgSrc, createdAt, desc)

        //call elemnet to create all cards.
        Array.from(document.querySelectorAll('.main___card')).forEach(
          async (card, index) => {
            const cardDataId = card.getAttribute('data-card')
            const imgElement = card.querySelector('.card-img-top')
            const imgSrc = imgElement ? imgElement.getAttribute('src') : null
            const ulElement = card.querySelector('.card-body ul')
            const createdAt = ulElement?.querySelector('.creat_at')?.textContent
            await generateSubCards(cardDataId, imgSrc, createdAt)
          }
        )
      }
    }
  })

  addAdminLinkToNavbar()

  const m_gwa = document.querySelector('.mwesigwa_link')
  m_gwa?.addEventListener('click', async () => {
    let isContainerLoaded = await checkAdminTokenAndFetchUser()
    setupDeleteButtonListeners(isContainerLoaded)
    observeContainerChanges()
  })
}
function handleDeleteButtonClick (e) {
  const colContainer = e.target.closest('.col')

  if (colContainer) {
    const userId = colContainer.getAttribute('data-user-id')
    const cadDelId = e.target.getAttribute('cad-del-id')

    if (userId === cadDelId) {
      deleteUser(userId).then(response => {
        if (response?.status === true) {
          colContainer.classList.add('nimate-del-profile')
          setTimeout(() => colContainer.remove(), 500)
        }
      })
    }
  }
}
function setupDeleteButtonListeners (isContainerLoaded) {
  if (!isContainerLoaded) return

  const cardContainers = document.querySelectorAll('.dele_btn')
  cardContainers.forEach(btn => {
    btn.addEventListener('click', handleDeleteButtonClick)
  })
}
function handleMutations (mutationsList, observer) {
  const hasCards = document.querySelector('.col')

  if (hasCards) {
    setupDeleteButtonListeners(true)
  } else {
    observer.disconnect()
    setupDeleteButtonListeners(false)
  }
}
function observeContainerChanges () {
  const container = document.getElementById('mwesi-wrapper')
  const observer = new MutationObserver(mutationsList =>
    handleMutations(mutationsList, observer)
  )
  observer.observe(container, {
    childList: true,
    subtree: true
  })
}
export async function generateUploadForm () {
  let formIsPresent = document.querySelector('#uploadForm')

  let containerExist = document.querySelector('#carocel_big')
  let couselBig = document.querySelector('.carucel___main')
  if (containerExist || couselBig) {
    containerExist?.remove()
    couselBig?.remove()
  }

  if (!formIsPresent) {
    const uploadHTML = `
        <form id="uploadForm" class="select-img-form text-danger" enctype="multipart/form-data">
        <div class="input-group mb3 input-group-lg my_inputs">
          <input type="file" name="images" class="form-control" id="inputGroupFile04" aria-describedby="inputGroupFileAddon04" aria-label="Upload" multiple required>
          <button class="btn btn-lg  btn-outline-secondary sub__this_form" type="button" id="inputGroupFileAddon04">Submit</button>
        </div>
  
        <div class="input-group mb3 my_inputs">
          <textarea type="text" name="description" id="descriptionInput" placeholder="Type  description here..." rows="6" class="form-control" aria-label="Description"></textarea>
        </div>
      </form>`

    const container = document.querySelector('#main__wrapper')
    container?.insertAdjacentHTML('afterbegin', uploadHTML)
    // ***********
    const submit____btn = document.querySelector('.sub__this_form')
    submit____btn?.addEventListener('click', async () => {
      let hasfinishUpload = await uploadFiles()
      if (hasfinishUpload) {
        document.querySelector('#uploadForm')?.remove()
      }
    })

    // Listen for the Enter key press on the document
    document.addEventListener('keydown', async event => {
      if (event.key === 'Enter') {
        event.preventDefault()
        let hasFinishUpload = await uploadFiles()
        if (hasFinishUpload) {
          document.querySelector('#uploadForm')?.remove()
        }
      }
    })
    // ***********
  } else {
    formIsPresent?.remove()
  }
}
export async function genCardCarucel () {
  try {
    const cardContainer = document.querySelector('#off__Container')
    cardContainer?.addEventListener('click', async e => {
      //Handle file download
      const isDownloadBtnClicked = e.target.classList.contains('download-btn')
      if (isDownloadBtnClicked) {
        let imageId = e.target.id

        return imageId
          ? await downloadImageById(imageId)
          : Notify(
              'Something went wrong. Image could not be downloaded, please try again later!'
            )
      }
      const card = e.target.closest('.card')
      if (card) {
        const imgSrc = card.querySelector('img')?.getAttribute('src')
        const un_ordered_list = card.querySelector('.card-body ul')

        const liElements = un_ordered_list.querySelectorAll('li')
        const email = liElements[0]?.textContent
        const userId = liElements[1]?.textContent
        const originalName = liElements[2]?.textContent
        const fileName = liElements[3]?.textContent
        const _id = liElements[9]?.textContent
      }
    })
  } catch (e) {
    console.log('Error from genCardCarucel: ' + e.message)
  }
}
export async function uploadFiles () {
  runSpinner(false, 'Uploading...')
  try {
    const { token } = JSON.parse(sessionStorage.getItem('token'))
    const formData = new FormData()

    // Select the input elements
    const imagesInput = document.getElementById('inputGroupFile04')
    const descriptionInput = document.getElementById('descriptionInput')

    // Get the files from the input
    const files = imagesInput.files
    const description = descriptionInput.value.trim() || 'Not provided' // Use value property

    if (!token || token === undefined) {
      displayLabel([
        'main__wrapper',
        'alert-warning',
        'The current session has expired.'
      ])
      return Notify('Session terminated. Login required!')
    }

    if (!files || files.length === 0) {
      displayLabel([
        'main__wrapper',
        'alert-warning',
        'You must select a file to upload.'
      ])
      return Notify('Something went wrong.')
    }

    // Append files to FormData
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i])
    }
    formData.append('description', description)

    const response = await API_CLIENT.post('/uploader/upload', formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    })

    if (response.statusText == 'OK') {
      document.querySelector('#uploadForm')?.remove()
      runSpinner(true)
      Notify('Uploaded successfully')
      displayLabel([
        'main__wrapper',
        'alert-success',
        'File uploaded successfully'
      ])

      let form = document.querySelector('#uploadForm')
      form?.remove
      let newData = await fetchData(1)
      let container = document.querySelector('#off__Container')
      let existingData = Array.from(container.children).map(
        child => child.dataset.id
      )

      newData.forEach(async obj => {
        try {
          if (!existingData.includes(obj._id)) {
            await addCardWithDelay(obj, true)
          }
        } catch (e) {
          console.log(e.message)
        }
      })
    }
    return true
  } catch (error) {
    let form = document.querySelector('#uploadForm')
    form?.remove
    if (error.response && error.response.status == 429)
      return displayLabel([
        'main__wrapper',
        'alert-danger',
        'Max limit for test account reached.'
      ])
    if (error.response && error.response.status == 428)
      return displayLabel([
        'main__wrapper',
        'alert-danger',
        'Too many files selected for a demo account. Max is 6 '
      ])

    if (error instanceof TypeError)
      return displayLabel([
        'main__wrapper',
        'alert-danger',
        'Sorry an error occured try again later!'
      ])

    if (error.response.status === 409) {
      displayLabel(['main__wrapper', 'alert-danger', 'Duplicates detected!'])
      setTimeout(() => window.location.reload(), 2000)
      return
    }
    if (error instanceof TypeError && error.message.includes('token')) {
      Notify('Your session has expired. Please login!')
      displayLabel([
        'main__wrapper',
        'alert-warning',
        'Your session has expired. Please login!'
      ])
      await LOGIN_HTML()
    }
    if (error?.response.status == 401)
      return displayLabel([
        'main__wrapper',
        'alert-warning',
        'Your session has expired. Please login!'
      ])
    if (error?.response.status == 500)
      return displayLabel([
        'main__wrapper',
        'alert-warning',
        'Oops something went wrong. Try again later.'
      ])

    console.log('Something went wrong: ' + error.message)
  } finally {
    let form = document.querySelector('#uploadForm')
    form?.remove
    runSpinner(true)
  }
}
export async function setUpBackToTop (mainContainerId) {
  const buttonTopInnerHTML = `<a href="#" class="back-to-top" aria-label="Back to Top">&uarr;</a>`

  const mainContainer = document.getElementById(mainContainerId)
  mainContainer?.insertAdjacentHTML('beforeend', buttonTopInnerHTML)

  const backToTopButton = document.querySelector('.back-to-top')

  mainContainer?.addEventListener('scroll', function () {
    let uploadContainer = document.querySelector('#uploadForm')
    if (mainContainer.scrollTop > 0) {
      backToTopButton.classList.add('show-to-top-btn')
      uploadContainer?.remove()
    } else {
      backToTopButton.classList.remove('show-to-top-btn')
    }
  })

  backToTopButton?.addEventListener('click', function (e) {
    e.preventDefault()
    if (mainContainer) {
      mainContainer.scrollTo({ top: 0, behavior: 'smooth' })
    }
  })

  if (mainContainer && mainContainer.innerHTML.trim() === '') {
    backToTopButton?.classList.remove('show-to-top-btn')
  }
}
export async function animateImages () {
  let imageDataArray = await extractImageUrls()
  if (!imageDataArray.length) return

  const container = document.querySelector('.img__conta')
  let currentIndex = 0

  const loadImage = async () => {
    const newImageDataArray = await extractImageUrls()
    if (JSON.stringify(newImageDataArray) !== JSON.stringify(imageDataArray)) {
      imageDataArray = newImageDataArray
      container.innerHTML = '' // Clear the container
    }

    if (imageDataArray.length === 0) return
    if (currentIndex >= imageDataArray.length) currentIndex = 0

    const imageUrl = imageDataArray[currentIndex]

    if (!imageUrl || imageUrl.trim() === 'null') {
      imageUrl = '../images/bg-water.jpeg'
    }

    const existingImage = container.querySelector(`img[src="${imageUrl}"]`)

    if (existingImage) existingImage.remove()

    const img = document.createElement('img')
    img.src = imageUrl
    img.classList.add('d-block', 'w-100', 'img-fluid', 'in_image_anime')

    container?.append(img)

    setTimeout(() => {
      img.remove()
      currentIndex++
      loadImage()
    }, 4000)
  }

  loadImage()
}
export async function extractImageUrls () {
  const cards = document.querySelectorAll('#off__Container .sm-card')
  const urls = []

  if (!cards.length) return urls

  cards.forEach(card => {
    const img = card.querySelector('.img-container img')
    if (img) {
      const imageUrl = img.getAttribute('src')
      urls.push(imageUrl)
    }
  })

  const mutationObserver = new MutationObserver(() => {
    refreshImageUrls()
  })

  mutationObserver.observe(document.getElementById('off__Container'), {
    childList: true,
    subtree: true
  })
  function refreshImageUrls () {
    const updatedUrls = []
    cards.forEach(card => {
      const img = card.querySelector('.img-container img')
      if (img) {
        const imageUrl = img.getAttribute('src')
        updatedUrls.push(imageUrl)
      }
    })
  }

  return urls
}
