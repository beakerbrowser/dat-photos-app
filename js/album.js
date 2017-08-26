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
  let archive, archiveInfo
  let selectedImages = []

  const urlEl = document.getElementById('url')
  const shareBtn = document.getElementById('share-btn')
  shareBtn.addEventListener('click', onShare)

  try {
    archive = new DatArchive(window.location)
    archiveInfo = await archive.getInfo()

    // remove header if not archive owner
    if (!archiveInfo.isOwner) {
      document.body.removeChild(document.querySelector('header'))
    }

    // Write album title and description if set
    // TODO allow user to edit this after creating the album
    document.title = archiveInfo.title || 'Untitled'
    if (archiveInfo.description) document.title += `- ${archiveInfo.description}`

    document.querySelector('h1').innerHTML = archiveInfo.title || '<em>Untitled</em>'
    document.querySelector('.desc').innerText = archiveInfo.description || ''

    // set value of hidden textarea to album's URL
    urlEl.innerHTML = archive.url
  } catch (err) {
    updatePrompt('<p>Something went wrong.</p><a href="https://github.com/taravancil/p2p-photo-gallery">Report an issue</a>')
  }

  renderApp()

  // events

  function onShare () {
    urlEl.select()
    document.execCommand('copy')
    updatePrompt(`<div id="close-prompt">Close</div><p>Share your photo album's secret URL:</p><p><code>${archive.url}</code></p><p><em>URL copied to clipboard</em></p>`)

    const closePromptBtn = document.getElementById('close-prompt')
    closePromptBtn.addEventListener('click', function () {
      updatePrompt('')
    })
  }

  function onToggleSelected (e) {
    e.target.parentNode.classList.toggle('selected')

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
      document.querySelector(`[src='${path}']`).parentNode.remove()

      // remove from archive
      await archive.unlink(selectedImages[i])
    }
    await archive.commit()
  }

  function onEditInfo () {
    // TODO
    // replace the h1 and description with inputs

    // add a save button

    // add an event listener to the save button
  }

  // renderers

  function renderApp () {
    // clear the prompt
    updatePrompt('')
    renderAlbum()

    document.getElementById('more-btn').addEventListener('click', function (e) {
      document.querySelector('.more-dropdown').classList.toggle('visible')
    })

    // TODO
    // document.getElementById('edit-info').addEventListener('click', onEditInfo)
    document.getElementById('delete-selected').addEventListener('click', onDeleteSelected)

    document.querySelector('input[type="file"]').addEventListener('change', function (e) {
      if (e.target.files) {
        const {files} = e.target
        readFiles(files)
      }
    })

    document.addEventListener('dragover', function (e) {
      document.body.style.opacity = 0.4
      e.preventDefault()
    }, false)

    document.addEventListener('dragleave', function (e) {
      document.body.style.opacity = 1.0
    }, false)

    document.addEventListener('drop', function (e) {
      e.stopPropagation()
      e.preventDefault()

      const files = e.dataTransfer.files
      readFiles(files)

      document.body.style.opacity = 1.0
      return false
    }, false)
  }

  function readFiles (files) {
    for (let i = 0; i < files.length; i += 1) {
      const reader = new FileReader()
      const file = files[i]

      reader.onload = async function () {
        const path = `/images/${file.name}`
        const orientation = readOrientationMetadata(reader.result)

        // write the orientiation metadata to localStorage
        window.localStorage.setItem(`${archive.url}${path}`, orientation)

        // only write the file if it doesn't already exist
        try {
          await archive.stat(path)
        } catch (e) {
          await archive.writeFile(path, reader.result)
          await archive.commit()
          appendImage(path, orientation)
        }
      }

      if (file.type.match(/image.*/)) {
        reader.readAsArrayBuffer(file)
      }
    }
  }

  async function renderAlbum () {
    try {
      const paths = await archive.readdir('images')

      // TODO sort by ctime or mtime
      for (let i = 0; i < paths.length; i++) {
        const path = `/images/${paths[i]}`
        const orientation = window.localStorage.getItem(`${archive.url}${path}`)
        appendImage(path, orientation)
      }
    } catch (err) {
      updatePrompt('<p>Something went wrong</p>')
      console.error(err)
    }
  }

  function renderUAPrompt () {
    updatePrompt('<p>Sorry >.< This app only works in the Beaker Browser.</p><a class="btn primary" href="https://beakerbrowser.com/docs/install/">Install Beaker</a>')
  }

  function appendImage (src, orientation = 1) {
    if (typeof src !== 'string') return

    const el = document.createElement('div')
    el.classList.add('img-container')

    const img = document.createElement('img')
    img.src = src
    img.style.transform = IMAGE_ROTATION[orientation]
    img.addEventListener('click', onToggleSelected)

    el.appendChild(img)
    document.querySelector('.album-images').appendChild(el)
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

  function readOrientationMetadata (buf) {
    const scanner = new DataView(buf)
    let idx = 0
    let value = 1 // Non-rotated is the default

    if (buf.length < 2 || scanner.getUint16(idx) !== 0xFFD8) {
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
