

export class GLTextTexturer {
  constructor() {
    this.canvas = document.createElement("canvas")
    this.ctx = this.canvas.getContext('2d')

    this.backgroundColor = "rgb(255,255,255)"
    this.color = "rgba(0,0,0,1.0)"
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


export const createEmptyTexture = function(gl, width, height) {
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const level = 0
  const internalFormat = gl.RGBA
  const srcFormat = gl.RGBA
  const srcType = gl.UNSIGNED_BYTE
  const border = 0
  const data = null
  gl.texImage2D(
    gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, data
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

  return {texture: texture, width: width, height: height, scale: 1.0}
}


export const resizeTexture = function(gl, texture, width, height) {
  gl.bindTexture(gl.TEXTURE_2D, texture.texture);

  const level = 0
  const internalFormat = gl.RGBA
  const srcFormat = gl.RGBA
  const srcType = gl.UNSIGNED_BYTE
  const border = 0
  const data = null
  gl.texImage2D(
    gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, data
  )

  texture.width = width
  texture.height = height

  return texture
}


export const computeFontSizingForReferenceElement = function(element) {
    let style = window.getComputedStyle(element)
    let fontSize = parseInt(style.fontSize.slice(0,style.fontSize.indexOf("px")))
    let lineHeight = parseInt(style.lineHeight.slice(0,style.lineHeight.indexOf("px")))
    
    if (!isFinite(style.lineHeight)) // this one's for Chrome, which does not return a px size for line height
    {
      lineHeight = Math.round(1.2*fontSize)
    }

    return {fontSize: fontSize, lineHeight: lineHeight}
}

export const createTextTexture = function(gl, text, fontSizeRef, color) {

  let lineHeight = undefined
  if (fontSizeRef instanceof Element) {
    let style = window.getComputedStyle(fontSizeRef)
    fontSizeRef = style.fontSize
    lineHeight = style.lineHeight
  }

  let texturer = new GLTextTexturer()
  if (color)
    texturer.color = color
  texturer.drawText(text, fontSizeRef)

  let texture = createTextureFromCanvas(gl, texturer.canvas)
  texture.baseline = texturer.baselineOffset;
  texture.middle = texturer.middleOffset;
  // provide line height and font size in texture object for reference in placing it
  texture.fontSize = parseInt(fontSizeRef.slice(0,fontSizeRef.indexOf("px")))
  texture.lineHeight = parseInt(lineHeight.slice(0,lineHeight.indexOf("px")))
  return texture
}

export function createWhiteTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Because images have to be downloaded over the internet
  // they might take a moment until they are ready.
  // Until then put a single pixel in the texture so we can
  // use it immediately. When the image has finished downloading
  // we'll update the texture with the contents of the image.
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 2;
  const height = 2;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]); 
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srcType,
                pixel);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)

  return texture;
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
  if (buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, numElements, gl.FLOAT, false, 0, 0)
  }
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


const markerVertexShader = `

  attribute vec2 vertexPos;
  attribute vec2 pxVertexOffsetDirection;
  attribute float pxMarkerSizeIn;
  attribute float pxStrokeWidthIn;
  attribute vec2 texCoordIn;
  attribute vec4 fillColorIn;
  attribute vec4 strokeColorIn;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform vec2 colorMapYRange;
  uniform float markerScale;

  varying vec2 pxCenterOffset; 
  varying float pxMarkerSize;
  varying float pxStrokeWidth;
  varying vec4 fillColor;
  varying vec4 strokeColor;
  varying vec2 colorMapValue;

  void main() {

    vec2 screenSpacePos = (modelViewMatrix * vec4(vertexPos, 0.0, 1.0)).xy;


    // offset vertex by direction and size of marker
    // actual offset is 1px bigger than markerSize to leave room for AA
    vec2 pxOffset = pxVertexOffsetDirection*(0.5*pxMarkerSizeIn*markerScale + pxStrokeWidthIn + 1.0);
    screenSpacePos += pxOffset;

    // outputs
    pxCenterOffset = pxOffset;
    gl_Position = projectionMatrix * vec4(screenSpacePos, 0.0, 1.0);
    fillColor = fillColorIn;
    strokeColor = strokeColorIn;
    pxMarkerSize = pxMarkerSizeIn*markerScale;
    pxStrokeWidth = pxStrokeWidthIn;
    colorMapValue = (texCoordIn - colorMapYRange[0])/(colorMapYRange[1]-colorMapYRange[0]);
  }
`

const lineVertexShader = `

  attribute vec2 vertexPos;
  attribute vec2 pxVertexOffsetDirection;
  attribute float pxMarkerSizeIn;
  attribute float pxStrokeWidthIn;
  attribute vec2 texCoordIn;
  attribute vec4 fillColorIn;
  attribute vec4 strokeColorIn;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform vec2 colorMapYRange;
  uniform float markerScale;

  varying vec2 pxCenterOffset; 
  varying float pxMarkerSize;
  varying float pxStrokeWidth;
  varying vec4 fillColor;
  varying vec4 strokeColor;
  varying vec2 colorMapValue;

  void main() {

    vec2 screenSpacePos = (modelViewMatrix * vec4(vertexPos, 0.0, 1.0)).xy;

    // for line drawing, we have to account for non-uniform x/y scaling
    vec2 xyScale = vec2(1.0/modelViewMatrix[0][0], 1.0/modelViewMatrix[1][1]);
    float xyScaleLength = length(xyScale);
    float preLength = length(pxVertexOffsetDirection);
    vec2 vertexOffsetDirection = xyScale*pxVertexOffsetDirection;
    float postLength = length(vertexOffsetDirection);
    vertexOffsetDirection *= preLength/postLength;

    // offset vertex by direction and size of marker
    // actual offset is 1px bigger than markerSize to leave room for AA
    vec2 pxOffset = vertexOffsetDirection*(0.5*pxMarkerSizeIn*markerScale + pxStrokeWidthIn + 1.0);
    screenSpacePos += pxOffset;

    // outputs
    pxCenterOffset = pxOffset;
    gl_Position = projectionMatrix * vec4(screenSpacePos, 0.0, 1.0);
    fillColor = fillColorIn;
    strokeColor = strokeColorIn;
    pxMarkerSize = pxMarkerSizeIn*markerScale;
    pxStrokeWidth = pxStrokeWidthIn;
    colorMapValue = (texCoordIn - colorMapYRange[0])/(colorMapYRange[1]-colorMapYRange[0]);
  }
`

const markerFragmentShader = `
  precision mediump float;

  varying vec2 pxCenterOffset;
  varying float pxMarkerSize;
  varying float pxStrokeWidth;
  varying vec4 fillColor;
  varying vec4 strokeColor;
  varying vec2 colorMapValue;

  uniform sampler2D colorMapSampler;
  uniform float pixelScale;

  void main() {
    float r = length(pxCenterOffset);
    float rd = (r - 0.5*pxMarkerSize);
    float fillCoverage = clamp(0.5 - pixelScale*(rd - 0.5*pxStrokeWidth), 0.0, 1.0);
    float strokeCoverage = clamp(0.5 + pixelScale*(rd - 0.5*pxStrokeWidth), 0.0, 1.0)*clamp(0.5 - pixelScale*(rd + 0.5*pxStrokeWidth), 0.0, 1.0);
    vec4 mappedColor = texture2D(colorMapSampler, colorMapValue);
    vec4 fill = mappedColor*vec4(fillColor.rgb, fillColor.a)*fillCoverage;
    vec4 stroke = mappedColor*strokeColor*strokeCoverage;
    gl_FragColor = fill + stroke;
    // gl_FragColor = mappedColor;
    // gl_FragColor = mix(vec4(0.5,0.0,0.0,0.5), vec4(0.0,0.5,0.0,0.5), fillCoverage);
  }
`

export function createLineShader(gl) {

  let shader = initShaderProgram(
    gl, lineVertexShader, markerFragmentShader,
    {
      vertexPos: "vertexPos",
      pxVertexOffsetDirection: "pxVertexOffsetDirection",
      pxMarkerSize: "pxMarkerSizeIn",
      pxStrokeWidth: "pxStrokeWidthIn",
      texCoord: "texCoordIn",
      colorMapValue: "texCoordIn",
      fillColor: "fillColorIn",
      strokeColor: "strokeColorIn",
    },
    {
      colorMapYRange: "colorMapYRange",
      colorMapSampler: "colorMapSampler",
      markerScale: "markerScale",
      pixelScale: "pixelScale",
      modelViewMatrix: "modelViewMatrix",
      projectionMatrix: "projectionMatrix",
    },
  )

  return shader
}

export function createMarkerShader(gl) {

  let shader = initShaderProgram(
    gl, markerVertexShader, markerFragmentShader,
    {
      vertexPos: "vertexPos",
      pxVertexOffsetDirection: "pxVertexOffsetDirection",
      pxMarkerSize: "pxMarkerSizeIn",
      pxStrokeWidth: "pxStrokeWidthIn",
      texCoord: "texCoordIn",
      colorMapValue: "texCoordIn",
      fillColor: "fillColorIn",
      strokeColor: "strokeColorIn",
    },
    {
      colorMapYRange: "colorMapYRange",
      colorMapSampler: "colorMapSampler",
      markerScale: "markerScale",
      pixelScale: "pixelScale",
      modelViewMatrix: "modelViewMatrix",
      projectionMatrix: "projectionMatrix",
    },
  )

  return shader
}

export class GLCanvasBase {
  constructor(div, isAutoResizeEnabled = true) {

    this.div = div
    // div.style.width       = "100%"
    div.style.left       = "0px"
    div.style.right       = "0px"
    div.style.display       = "flex"
    div.style.flexDirection = "row"
    div.style.flexWrap      = "nowrap"
    div.style.alignItems    = "stretch"
    div.style.overflowX = "hidden"
    div.style.overflowY = "hidden"

    let heightIFrame = document.createElement("iframe")
    // heightIFrame.style.height = "100%"
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
    // widthIFrame.style.width = "100%"
    widthIFrame.style.height = "0px"
    widthIFrame.style.border = "none"
    this.widthIFrame = widthIFrame

    this.canvas = document.createElement("canvas")
    this.canvas.width = div.offsetWidth*(window.devicePixelRatio || 1.0)
    this.canvas.height = div.offsetHeight*(window.devicePixelRatio || 1.0)
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
    Call to update canvas size to match div's size for 1:1 pixel mapping. This is called when the width/height iframes notice being resized.

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
