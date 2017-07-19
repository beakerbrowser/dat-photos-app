(async  function () {
  // render prompt if not using Beaker
  if (!navigator.userAgent.includes('BeakerBrowser')) {
    renderUAPrompt()
    return
  }

  // setup
  let archive, archiveInfo, input
  let selectedImages = []

  const shareBtn = document.getElementById('share-btn')
  shareBtn.addEventListener('click', onShare)

  try {
    input = document.querySelector('input[type="file"]')
    archive = new DatArchive(window.location)
    archiveInfo = await archive.getInfo()
  } catch (err) {
    renderPrompt('<p>Something went wrong.</p><a href="https://github.com/taravancil/p2p-photo-gallery">Report an issue</a>')
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

  function onSelectImage (e) {
    e.target.classList.add('selected')
    shareBtn.disabled = false

    // full src is dat://{key}/{path}, so strip dat://{key}
    selectedImages.push(e.target.src.slice('dat://'.length + 64))
  }

  function onToggleSelected (e) {
    e.target.classList.toggle('selected')

    // full src is dat://{key}/{path}, so strip dat://{key}
    const path = e.target.src.slice('dat://'.length + 64)
    const idx = selectedImages.indexOf(path)

    // either add or remove the path to selectedImages
    if (idx === -1) selectedImages.push(path)
    else selectedImages.splice(idx, 1)

    if (selectedImages.length) shareBtn.disabled = false
    else shareBtn.disabled = true
  }

  async function onShare () {
    // create a new Dat archive
    const newArchive = await DatArchive.create()

    // get info
    const info = await newArchive.getInfo()

    let imagesHTML = ''

    const styles = '<style>body{font-family:BlinkMacSystemFont;}img{max-width: 225px; margin-right: 10px;}</style>'

    for (let i = 0; i < selectedImages.length; i++) {
      const path = selectedImages[i].slice('images/'.length)
      const data = await archive.readFile(selectedImages[i], 'binary')
      imagesHTML += `<img src='${path}'/>`
      await newArchive.writeFile(path, data)
    }

    // write the index.html preview
    await newArchive.writeFile('index.html', `<html>${styles}<h1>${info.title || ''}</h1><p>${info.description || ''}</p>${imagesHTML}</html>`)
    await newArchive.commit()

    // go to the new archive
    window.location = newArchive.url
  }

  async function onDeleteSelected () {
    for (let i = 0; i < selectedImages.length; i++) {
      const path = selectedImages[i]

      // remove from DOM
      document.querySelector(`[src='${path}']`).remove()

      // remove from archive
      await archive.unlink(selectedImages[i], 'binary')
    }
    await archive.commit()
  }

  // renderers

  function renderApp () {
    // clear the prompt
    updatePrompt('')
    renderGallery()

    document.getElementById('more-btn').addEventListener('click', function (e) {
      document.querySelector('.more-dropdown').classList.toggle('visible')
    })

    document.getElementById('delete-selected').addEventListener('click', onDeleteSelected)

    document.querySelector('input[type="file"]').addEventListener('change', function (e) {
      if (e.target.files) {
        const {files} = e.target

        for (let i = 0; i < files.length; i += 1) {
          const reader = new FileReader()
          const file = files[i]

          reader.onload = async function () {
            const path = `/images/${file.name}`

            // only write the file if it doesn't already exist
            try {
              await archive.stat(path)
            } catch (e) {
              await archive.writeFile(path, reader.result)
              await archive.commit()
              appendImage(path)
            }
          }

          reader.readAsArrayBuffer(file)
        }
      }
    })
  }

  async function renderGallery () {
    try {
      const paths = await archive.readdir('images')

      // TODO sort by ctime or mtime
      for (let i = 0; i < paths.length; i++) {
        appendImage(`/images/${paths[i]}`)
      }
    } catch (err) {
      updatePrompt('<p>Something went wrong</p>')
      console.error(err)
    }
  }

  function renderUAPrompt () {
    updatePrompt('<p>Sorry >.< This app only works in the Beaker Browser.</p><a class="btn primary" href="https://beakerbrowser.com/docs/install/">Install Beaker</a>')
  }

  function renderForkPrompt () {
    updatePrompt('<p>Welcome to Photos!</p><button id="fork-button" class="btn primary">Get started</button>')
  }

  function appendImage(src) {
    if (typeof src !== 'string') return

    const img = document.createElement('img')
    img.src = src
    img.addEventListener('click', onToggleSelected)
    document.querySelector('.gallery-images').appendChild(img)
  }

  // helpers

  function updatePrompt (html) {
    if (typeof html !== 'string') return
    if (html.length) {
      document.querySelector('#prompt').innerHTML = `<div class="content">${html}</div>`
    } else {
      document.querySelector('#prompt').innerHTML = html
    }
  }

  // TODO omit?
  function createImageEl (src) {
    const img = document.createElement('img')
    img.src = src
    return img
  }
})()