(async  function () {
  // render prompt if not using Beaker
  if (!navigator.userAgent.includes('BeakerBrowser')) {
    renderUAPrompt()
    return
  }

  // setup
  let archive, archiveInfo, albums
  let selectedImages = []

  try {
    archive = new DatArchive(window.location)
    archiveInfo = await archive.getInfo()
    albums = JSON.parse(window.localStorage.getItem(`${archiveInfo.key}-albums`)) || []
  } catch (err) {
    updatePrompt('<p>Something went wrong.</p><a href="https://github.com/taravancil/p2p-photo-gallery">Report an issue</a>')
  }

  // render fork prompt if user is not owner
  if (!archiveInfo.isOwner) {
    renderForkPrompt()
    document.getElementById('fork-button').addEventListener('click', onForkApp)
    return
  }

  renderApp()

  // events

  async function onForkApp () {
    // Wait for the archive's files to download
    // TODO handle timeout
    await archive.download('/')

    // Fork the app and open the forked version
    myApp = await DatArchive.fork(archive, {title: 'My Photos'})
    window.location = myApp.url
  }

  async function onCreateAlbum (e) {
    // create a new Dat archive
    const album = await DatArchive.create()
    const info = await album.getInfo()

    // create the /images and /css directories
    await album.mkdir('/images')

    // write the album's URL to localStorage
    albums.push(album.url)
    window.localStorage.setItem(`${archiveInfo.key}-albums`, JSON.stringify(albums))


    // write the album's assets
    const html = await archive.readFile('album.html')
    await album.writeFile('index.html', html)
    await album.commit()

    // go to the new archive
    window.location = album.url
  }

  async function onDeleteAlbum () {
    // TODO
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

    // get the count of images in the album
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
      // TODO why isn't this returning an ArrayBuffer?
      // const buf = await album.readFile(`/images/${images[idx]}`, 'binary')

      // get the orientation of the image to preview
      // const orientation = readOrientationMetadata(buf)
      // albumHTML += `<img style="transform: ${IMAGE_ROTATION[orientation]};" src="${imgPath}"/>`
      albumHTML += `<img src="${imgPath}"/>`
    }

    // add the title
    albumHTML += `<div class="title">${info.title || '<em>Untitled</em>'}</div>`

    // add the image count to the HTML
    albumHTML += `<div class="photo-count">${images.length} photos</div>`

    el.innerHTML += albumHTML

    // create dropdown button
    const dropdownBtn = document.createElement('span')
    dropdownBtn.classList.add('dropdown-btn')
    dropdownBtn.title = 'Show album menu'
    dropdownBtn.dataset.album = album.url
    dropdownBtn.innerText = '▾'
    dropdownBtn.addEventListener('click', toggleAlbumDropdown)
    el.appendChild(dropdownBtn)

    document.querySelectorAll('.delete-album-btn').forEach(function (el) {
      el.addEventListener('click', deleteAlbum)
    })

    document.querySelector('.albums-container').appendChild(el)
  }

  function renderUAPrompt () {
    updatePrompt('<p>Sorry >.< This app only works in the Beaker Browser.</p><a class="btn primary" href="https://beakerbrowser.com/docs/install/">Install Beaker</a>')
  }

  function renderForkPrompt () {
    updatePrompt('<p>Welcome to Photos!</p><button id="fork-button" class="btn primary">Get started</button>')
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
})()