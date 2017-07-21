(async  function () {
  // render prompt if not using Beaker
  if (!navigator.userAgent.includes('BeakerBrowser')) {
    renderUAPrompt()
    return
  }

  // setup
  let archive, archiveInfo, albums
  let selectedImages = []

  const urlEl = document.getElementById('url')
  const shareBtn = document.getElementById('share-btn')
  shareBtn.addEventListener('click', onShare)

  try {
    archive = new DatArchive(window.location)
    archiveInfo = await archive.getInfo()

    // Write album title and description if set
    // TODO allow user to edit this after creating the album
    document.querySelector('h1').innerHTML = archiveInfo.title || '<em>Untitled</em>'
    document.querySelector('.desc').innerText = archiveInfo.description || ''

    // set value of hidden textarea to album's URL
    urlEl.innerHTML = archive.url
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

  function onShare () {
    urlEl.select()
    document.execCommand('copy')
    updatePrompt(`<p>Share your photo album's secret URL:</p><p><code>${archive.url}</code></p><p><em>URL copied to clipboard</em></p>`)
  }

  function onToggleSelected (e) {
    e.target.classList.toggle('selected')

    // full src is dat://{key}/{path}, so strip dat://{key}
    const path = e.target.src.slice('dat://'.length + 64)
    const idx = selectedImages.indexOf(path)

    // either add or remove the path to selectedImages
    if (idx === -1) selectedImages.push(path)
    else selectedImages.splice(idx, 1)
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
    renderAlbum()

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

  async function appendAlbum (album) {
    const info = await album.getInfo()
    let albumHTML = ''

    // get the count of images in the album
    const images = await album.readdir('/images')

    // create the album element
    const el = document.createElement('div')
    el.classList.add('album')

    if (!images.length) {
      el.classList.add('empty')
      albumHTML += '<div class="placeholder">No photos</div>'
    } else {
      // add the first image to the album preview
      albumHTML += `<img src="dat://${album.url}${images[0]}"/>`
    }

    // add the title
    albumHTML += `<div class="title">${info.title || '<em>Untitled</em>'}</div>`

    // add the image count to the HTML
    albumHTML += `<div class="photo-count">${images.length} photos</div>`

    el.innerHTML = albumHTML

    document.querySelector('.albums-container').appendChild(el)
  }

  async function renderAlbum () {
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

  function appendImage(src) {
    if (typeof src !== 'string') return

    const img = document.createElement('img')
    img.src = src
    img.addEventListener('click', onToggleSelected)
    document.querySelector('.album-images').appendChild(img)
  }

  function renderUAPrompt () {
    updatePrompt('<p>Sorry >.< This app only works in the Beaker Browser.</p><a class="btn primary" href="https://beakerbrowser.com/docs/install/">Install Beaker</a>')
  }

  function appendImage(src) {
    if (typeof src !== 'string') return

    const img = document.createElement('img')
    img.src = src
    img.addEventListener('click', onToggleSelected)
    document.querySelector('.album-images').appendChild(img)
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
})()