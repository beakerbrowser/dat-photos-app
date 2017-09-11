(async function () {
  // render prompt if not using Beaker
  if (!navigator.userAgent.includes('BeakerBrowser')) {
    renderUAPrompt()
    return
  }

  const IMAGE_ROTATION = {
    1: 'rotate(0deg)',
    3: 'rotate(180deg)',
    6: 'rotate(90deg)',
    8: 'rotate(270deg)'
  }

  // setup
  let archive, archiveInfo, albums
  let selectedImages = []

  try {
    archive = new DatArchive(window.location)
    archiveInfo = await archive.getInfo()
    document.title = archiveInfo.title
  } catch (err) {
    updatePrompt('<p>Something went wrong.</p><a href="https://github.com/taravancil/p2p-photo-gallery">Report an issue</a>')
  }

  const albumsData = window.localStorage.getItem('albums')
  if (albumsData) {
    albums = JSON.parse(albumsData)
  } else {
    albums = []
    window.localStorage.setItem('albums', '[]')
  }

  renderApp()

  // events

  async function onCreateAlbum (e) {
    // create a new Dat archive
    const album = await DatArchive.create()

    // create the /images directory
    await album.mkdir('/images')

    // write the album's URL to localStorage
    albums.push(album.url)
    window.localStorage.setItem('albums', JSON.stringify(albums))

    // write the album's assets
    const html = await archive.readFile('album.html')
    html2 = html.replace(/{{DAT_ARCHIVE_URL}}/g, archive.url)
    await album.writeFile('index.html', html2)
    await album.commit()

    // go to the new archive
    window.location = album.url
  }

  async function onDeleteAlbum (e) {
    e.preventDefault()
    e.stopPropagation()

    const url = e.target.dataset.album

    // remove the album element from DOM
    document.querySelector('.albums-container').removeChild(document.querySelector(`a.album[href="${url}"]`))

    // remove album URL from storage
    albums.splice(albums.indexOf(url), 1)
    window.localStorage.setItem('albums', JSON.stringify(albums))
  }

  // renderers

  function renderApp () {
    // clear the prompt
    updatePrompt('')

    document.querySelectorAll('.create-album').forEach(el => el.addEventListener('click', onCreateAlbum))

    renderAlbums()
  }

  function renderAlbums () {
    for (let i = 0; i < albums.length; i++) {
      appendAlbum(new DatArchive(albums[i]))
    }
  }

  async function appendAlbum (album) {
    const info = await album.getInfo()
    let albumHTML = ''

    // get all of the images in the album
    const images = await album.readdir('/images')

    // create the album element
    const el = document.createElement('a')
    el.classList.add('album')
    el.href = album.url

    albumHTML += `
      <div class="dropdown" data-album="${album.url}">
        <div class="delete-album-btn" data-album="${album.url}">Delete album</div>
      </div>
    `

    if (!images.length) {
      el.classList.add('empty')
      albumHTML += '<div class="placeholder">No photos</div>'
    } else {
      // use a random image for the album preview
      const idx = Math.floor(Math.random() * images.length)

      const imgPath = `${album.url}/images/${images[idx]}`

      // get the orientation of the image to preview
      let orientation = window.localStorage.getItem(imgPath)
      if (!orientation) {
        // TODO why isn't this returning an ArrayBuffer?
        let buf = await album.readFile(`/images/${images[idx]}`, 'binary')
        if (buf instanceof Uint8Array) {
          buf = buf.buffer
        }
        orientation = readOrientationMetadata(buf)

        // cache the image's orientation
        window.localStorage.setItem(imgPath, orientation)
      }

      albumHTML += `<img style="transform: ${IMAGE_ROTATION[orientation]};" src="${imgPath}"/>`
    }

    // add the title
    albumHTML += `<div class="title">${info.title || '<em>Untitled</em>'}</div>`

    // add the image count to the HTML
    let pluralize = ''
    if (images.length !== 1) pluralize = 's'
    albumHTML += `<div class="photo-count">${images.length} photo${pluralize}</div>`

    el.innerHTML += albumHTML

    // create dropdown button
    const dropdownBtn = document.createElement('span')
    dropdownBtn.classList.add('dropdown-btn')
    dropdownBtn.title = 'Show album menu'
    dropdownBtn.dataset.album = album.url
    dropdownBtn.innerText = '▾'
    dropdownBtn.addEventListener('click', toggleAlbumDropdown)
    el.appendChild(dropdownBtn)

    document.querySelector('.albums-container').appendChild(el)

    document.querySelectorAll('.delete-album-btn').forEach(function (el) {
      el.addEventListener('click', onDeleteAlbum)
    })
  }

  function renderUAPrompt () {
    updatePrompt('<p>Sorry >.< This app only works in the Beaker Browser.</p><a class="btn primary" href="https://beakerbrowser.com/docs/install/">Install Beaker</a>')
  }

  // helpers

  function toggleAlbumDropdown (e) {
    e.preventDefault()
    e.stopPropagation()
    console.log(e.target.dataset.album)
    document.querySelector(`.dropdown[data-album="${e.target.dataset.album}"]`).classList.toggle('visible')
  }

  function updatePrompt (html) {
    if (typeof html !== 'string') return
    if (html.length) {
      document.querySelector('#prompt').innerHTML = `<div class="content">${html}</div>`
    } else {
      document.querySelector('#prompt').innerHTML = html
    }
  }

  function readOrientationMetadata (buf) {
    console.log(buf)
    const scanner = new DataView(buf)
    let idx = 0
    let value = 1 // Non-rotated is the default

    if (buf.length < 2 || scanner.getUint16(idx) != 0xFFD8) {
      // not a JPEG
      return
    }

    idx += 2

    let maxBytes = scanner.byteLength
    while (idx < maxBytes - 2) {
      let uint16 = scanner.getUint16(idx)
      idx += 2
      switch (uint16) {
        case 0xFFE1: // Start of EXIF
          var exifLength = scanner.getUint16(idx)
          maxBytes = exifLength - idx
          idx += 2
          break
        case 0x0112: // Orientation tag
          // Read the value, its 6 bytes further out
          // See page 102 at the following URL
          // http://www.kodak.com/global/plugins/acrobat/en/service/digCam/exifStandard2.pdf
          value = scanner.getUint16(idx + 6, false)
          maxBytes = 0 // Stop scanning
          break
      }
    }
    return value
  }
})()
