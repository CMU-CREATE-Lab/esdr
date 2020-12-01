

export class GLTextTexturer {
  constructor() {
    this.canvas = document.createElement("canvas")
    this.ctx = this.canvas.getContext('2d')

    this.backgroundColor = "rgb(0,255,0)"
    this.color = "rgba(0,0,255,1.0)"
    this.fontFamily = "sans-serif"
  }


  /**
    Draw text with a given optional font size

    @param {string} text - string to draw
    @param {string} fontSize - CSS font size specifier
  */
  drawText(text, fontSize = "100%") {
    let ctx = this.ctx

    this.text = text

    // let fontSize = this.getFontSizeInPx('medium sans-serif');
    let pixelScale = window.devicePixelRatio || 1.0

    let font = `calc(${pixelScale} * ${fontSize}) ${this.fontFamily}`
    ctx.font = font
    ctx.textBaseline = "middle"
    let textMetric = ctx.measureText(text)

    // draw with 1px margins so that when the texture is mapped onto bigger geometry, the edge pixels don't bleed

    this.baselineOffset = 1 + -textMetric.alphabeticBaseline + textMetric.actualBoundingBoxAscent
    this.middleOffset = 1 + textMetric.actualBoundingBoxAscent

    this.canvas.width = 2 + Math.ceil(textMetric.actualBoundingBoxRight) - Math.floor(textMetric.actualBoundingBoxLeft)
    this.canvas.height = 2 + Math.ceil(textMetric.actualBoundingBoxDescent) + Math.ceil(textMetric.actualBoundingBoxAscent)

    ctx.fillStyle = this.backgroundColor
    ctx.fillRect(0,0, this.canvas.width, this.canvas.height)

    ctx.font = font
    ctx.textBaseline = "middle"

    ctx.fillStyle = this.color
    ctx.fillText(text, 1 + textMetric.actualBoundingBoxLeft, 1 + textMetric.actualBoundingBoxAscent)
  }

  /**
    @return text width and height in CSS pixels
  */
  computeTextSize(text, fontSize = "100%") {
    let ctx = this.ctx
    let font = `calc(${fontSize}) ${this.fontFamily}`
    ctx.font = font
    ctx.textBaseline = "top"
    let textMetric = ctx.measureText(text)

    let textWidth = Math.ceil(textMetric.actualBoundingBoxRight) - Math.floor(textMetric.actualBoundingBoxLeft)
    let textHeight = Math.ceil(textMetric.actualBoundingBoxDescent) + Math.ceil(textMetric.actualBoundingBoxAscent)

    return {textWidth: textWidth, textHeight: textHeight}
  }

}


/**
  Create an OpenGL texture from the contents of the canvas
  @param {WebGLRenderingContext} gl - WebGL rendering context to create the texture for
  @param {Canvas} canvas - canvas to create texture from.

  @return {Object} Information about the created texture
*/
export const createTextureFromCanvas = function(gl, canvas) {
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const level = 0;
  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  gl.texImage2D(
    gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, canvas
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

  let pixelScale = window.devicePixelRatio || 1.0

  return {texture: texture, width: canvas.width, height: canvas.height, scale: pixelScale}
}


export const computeFontSizingForReferenceElement = function(element) {
    let style = window.getComputedStyle(element)
    let fontSize = parseInt(style.fontSize.slice(0,style.fontSize.indexOf("px")))
    let lineHeight = parseInt(style.lineHeight.slice(0,style.lineHeight.indexOf("px")))
    return {fontSize: fontSize, lineHeight: lineHeight}
}

export const createTextTexture = function(gl, text, fontSizeRef) {

  let lineHeight = undefined
  if (fontSizeRef instanceof Element) {
    let style = window.getComputedStyle(fontSizeRef)
    fontSizeRef = style.fontSize
    lineHeight = style.lineHeight
  }

  let texturer = new GLTextTexturer()
  texturer.drawText(text, fontSizeRef)

  let texture = createTextureFromCanvas(gl, texturer.canvas)
  texture.baseline = texturer.baselineOffset;
  texture.middle = texturer.middleOffset;
  // provide line height and font size in texture object for reference in placing it
  texture.fontSize = parseInt(fontSizeRef.slice(0,fontSizeRef.indexOf("px")))
  texture.lineHeight = parseInt(lineHeight.slice(0,lineHeight.indexOf("px")))
  return texture
}


export const resizeArrayBuffer = function(gl, buffer, numVertices, numElements, hint = gl.STATIC_DRAW) {
    buffer = buffer || gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, numVertices*numElements*Float32Array.BYTES_PER_ELEMENT, gl.STATIC_DRAW)
    return buffer
}


export const resizeElementArrayBuffer = function(gl, buffer, numElements, hint = gl.STATIC_DRAW) {
    buffer = buffer || gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, numElements*Uint32Array.BYTES_PER_ELEMENT, gl.STATIC_DRAW)
    return buffer
}


export const bindArrayBuffer = function(gl, buffer, loc, numElements) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, numElements, gl.FLOAT, false, 0, 0)
}


export const loadShader = function(gl, type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);

  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    throw "Unable to compile shader."
    return undefined;
  }

  return shader;
}


/**
  Compile and link a shader program, and get its attribute and uniform locations.
  @param {WebGLRenderingContext} gl
  @param {string} vsSource - Vertex shader source.
  @param {string} fsSource - Fragment shader source.
  @param {Object} attributes - Shader attribute name mapping.
  @param {Object} uniforms - Shader uniform name mapping.
  @return {Object} returns {shaderProgram, attribLocations, uniformLocations}
*/
export const initShaderProgram = function(gl, vsSource, fsSource, attributes, uniforms) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource)
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource)

  const shaderProgram = gl.createProgram()
  gl.attachShader(shaderProgram, vertexShader)
  gl.attachShader(shaderProgram, fragmentShader)
  gl.linkProgram(shaderProgram)

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram))
    gl.deleteProgram(shaderProgram)
    throw "Unable to link shader program."
    return undefined
  }

  for (let name in attributes) {
    attributes[name] = gl.getAttribLocation(shaderProgram, attributes[name])
  }
  for (let name in uniforms) {
    uniforms[name] = gl.getUniformLocation(shaderProgram, uniforms[name])
  }

  return {shaderProgram: shaderProgram, attribLocations: attributes, uniformLocations: uniforms}
}


export class GLCanvasBase {
  constructor(div, isAutoResizeEnabled = true) {

    this.div = div
    div.style.display       = "flex"
    div.style.flexDirection = "row"
    div.style.flexWrap      = "nowrap"
    div.style.alignItems    = "stretch"

    let heightIFrame = document.createElement("iframe")
    heightIFrame.style.height = "100%"
    heightIFrame.style.width = "0px"
    heightIFrame.style.border = "none"
    this.heightIFrame = heightIFrame

    this.vdiv = document.createElement("div")
    // this.vdiv.width = "100%"
    this.vdiv.style.display       = "flex"
    this.vdiv.style.flexDirection = "column"
    this.vdiv.style.flexWrap      = "nowrap"
    this.vdiv.style.alignItems    = "stretch"

    let widthIFrame = document.createElement("iframe")
    widthIFrame.style.width = "100%"
    widthIFrame.style.height = "0px"
    widthIFrame.style.border = "none"
    this.widthIFrame = widthIFrame

    this.canvas = document.createElement("canvas")
    this.canvas.style.width = "100%"
    this.canvas.style.height = "100%"

    this.vdiv.appendChild(widthIFrame)
    this.vdiv.appendChild(this.canvas)

    div.appendChild(heightIFrame)
    div.appendChild(this.vdiv)

    this.resizeEventListener = () => this.updateCanvasSize()

    this.enableAutoResize(isAutoResizeEnabled)
  }

  enableAutoResize(isEnabled) {

    if (isEnabled) {
      this.heightIFrame.contentWindow.addEventListener('resize', this.resizeEventListener)
      this.widthIFrame.contentWindow.addEventListener('resize', this.resizeEventListener)
    }
    else {
      this.heightIFrame.contentWindow.removeEventListener('resize', this.resizeEventListener)
      this.widthIFrame.contentWindow.removeEventListener('resize', this.resizeEventListener)
    }

  }

  /**
    call to update canvas size to match div's size for 1:1 pixel mapping
  */
  updateCanvasSize() {
    let pixelScale = window.devicePixelRatio || 1.0

    let clientBounds = this.div.getBoundingClientRect()
    this.canvas.width = clientBounds.width*pixelScale
    this.canvas.height = clientBounds.height*pixelScale
  }


  /**
    Initializes WebGL context for use
    @return {WebGLRenderingContext} WebGL context
  */
  initGlBase() {
    const gl = this.canvas.getContext("webgl")

    if (gl == null) {
      alert("Cannot initialize WebGL.")
      return undefined
    }


    // check that element indices can be UINT32, for we would like to address more than 65k vertices at a time
    var ext = gl.getExtension('OES_element_index_uint');
    if (!ext) {
      alert("OES_element_index_uint is not supported.")
      return undefined
    }

    // if WebGL context has been successfully setup, assign it to an ivar for later use
    this.gl = gl
    return gl
  }
}
