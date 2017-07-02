(async  function () {
  // render prompt if not using Beaker
  if (!navigator.userAgent.includes('BeakerBrowser')) {
    renderUAPrompt()
    return
  }

  // setup
  let archive, archiveInfo, input
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

  // renderers

  function renderApp () {
    // clear the prompt
    updatePrompt('')
    renderGallery()

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
    updatePrompt('<p>Sorry! This app only works in the Beaker Browser.</p><a href="https://beakerbrowser.com/install/">Install Beaker</a>')
  }

  function renderForkPrompt () {
    updatePrompt('<p>Welcome to Photos!</p><button id="fork-button">Get started</button>')
  }

  function appendImage(src) {
    if (typeof src !== 'string') return
    const img = document.createElement('img')
    img.src = src
    document.querySelector('.gallery-images').appendChild(img)
  }

  // helpers

  function updatePrompt (html) {
    if (typeof html !== 'string') return
    document.getElementById('prompt').innerHTML = html
  }

  // TODO omit?
  function createImageEl (src) {
    const img = document.createElement('img')
    img.src = src
    return img
  }
})()