'use strict'

import { Jbig2Image } from './pdfjs/core/jbig2.js'

// jbig2ImageData :: ({buffer: Uint8Array, currentPageInfo: {}, pageAssociation: Number}) -> ImageData
function jbig2ImageData (parsedImg) {
  let buffer = parsedImg.buffer
  let imgWidth = parsedImg.currentPageInfo.width
  let imgHeight = parsedImg.currentPageInfo.height
  let imgArr = new Uint8ClampedArray(imgWidth * imgHeight * 4) // For RGBA initialized with 0s
  let rowSize = (imgWidth + 7) >> 3
  let offset0 = 0
  let i, j, mask, offset, rowOffset, imgOffset
  for (i = 0; i < imgHeight; i++) {
    mask = 128
    offset = offset0
    rowOffset = i * imgWidth
    for (j = 0; j < imgWidth; j++) {
      imgOffset = (rowOffset + j) * 4
      if ((buffer[offset] & mask) === 0) {
        imgArr[imgOffset] =
          imgArr[imgOffset + 1] =
          imgArr[imgOffset + 2] = 255 // White
      }
      imgArr[imgOffset + 3] = 255 // (Always) opaque

      mask >>= 1
      if (mask === 0) {
        mask = 128
        offset++
      }
    }
    offset0 += rowSize
  }

  let imageData = new ImageData(imgArr, imgWidth, imgHeight)
  imageData.pageAssociation = parsedImg.pageAssociation
  return imageData
}

// decodeJbig2 :: (Uint8Array) -> [() -> {buffer: Uint8Array, currentPageInfo: {}, pageAssociation: Number}]
function decodeJbig2 (data) {
  let parsedImgs = new Jbig2Image().parseJbig2(data, 0, data.byteLength)
  let numImgs = parsedImgs.length
  let output = new Array(numImgs)

  for (let i = 0; i < numImgs; i++) {
    output[i] = jbig2ImageData(parsedImgs[i])
  }
  return output
}

// createBitmap :: (ImageData) -> HTMLCanvasElement
function createBitmap (drawable) {
  let bitmap = document.createElement('canvas')
  bitmap.width = drawable.width
  bitmap.height = drawable.height
  bitmap.getContext('2d').putImageData(drawable, 0, 0)
  return bitmap
}

// drawToCanvas :: (HTMLCanvasElement, ImageData, {scale?: Number, maxWidth?: Number, upsample?: Number})
function drawToCanvas (canvas, drawable, options) {
  options = Object.assign({
    scale: 1.0,
    maxWidth: 1200,
    upsample: 1
  }, options)

  // Create drawable bitmap from ImageData
  let bitmap = createBitmap(drawable)

  let ctx = canvas.getContext('2d')
  // Calculate scale/pixel density
  let scale = Math.min(options.scale, options.maxWidth / bitmap.width)
  let devicePixelRatio = window.devicePixelRatio || 1
  let backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
                          ctx.mozBackingStorePixelRatio ||
                          ctx.msBackingStorePixelRatio ||
                          ctx.oBackingStorePixelRatio ||
                          ctx.backingStorePixelRatio || 1
  let fullScale = scale * (devicePixelRatio / backingStoreRatio) * options.upsample
  // Actual size
  ctx.canvas.width = Math.floor(bitmap.width * fullScale)
  ctx.canvas.height = Math.floor(bitmap.height * fullScale)
  // Visual Size
  ctx.canvas.style.width = `${Math.floor(bitmap.width * scale)}px`
  ctx.canvas.style.height = `${Math.floor(bitmap.height * scale)}px`
  // Scale and draw
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.scale(fullScale, fullScale)
  ctx.drawImage(bitmap, 0, 0)
}

export {
  decodeJbig2,
  drawToCanvas
}
