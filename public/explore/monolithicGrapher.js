

import * as gltools from "./webgltools.js"

export class GLGrapher extends gltools.GLCanvasBase {
  constructor(div) {
    super(div)

    this.NUM_POSITION_ELEMENTS    = 2
    this.NUM_TEXCOORD_ELEMENTS    = 2
    this.NUM_FILLCOLOR_ELEMENTS   = 4
    this.NUM_VERTICES   = 4
    this.NUM_INDICES    = 6

    this.canvas.addEventListener("mousedown", (event) => this.onMouseDown(event) )
    
    this.onMouseUpListener = (event) => this.onMouseUp(event)
    this.onMouseDraggedListener = (event) => this.onMouseDragged(event)

    this.updateCanvasSize()
  }


  _initGl() {
    let gl = this.initGlBase()


    const vertexShader = `
      attribute vec2 vertexPos;
      attribute vec2 texCoordIn;
      attribute vec4 colorIn;

      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;

      varying vec4 color;
      varying vec2 texCoord;

      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPos, 0.0, 1.0);
        // gl_Position = vec4(vertexPos, 0.0, 1.0);
        color = colorIn;
        texCoord = texCoordIn;
      }
    `
    const fragmentShader = `
      precision mediump float;

      varying vec4 color;
      varying vec2 texCoord;
      uniform sampler2D texture;

      void main() {
        vec4 texColor = texture2D(texture, texCoord);
        gl_FragColor = texColor;
        // gl_FragColor = color;
        // gl_FragColor = vec4(1.0,1.0,1.0,1.0);
      }
    `
    this.simpleShader = this.initShaderProgram(
      gl, vertexShader, fragmentShader, 
      {
        vertexPos: "vertexPos",
        texCoord: "texCoordIn", 
        color: "colorIn"
      },
      {
        modelViewMatrix: "modelViewMatrix", 
        projectionMatrix: "projectionMatrix", 
        texture: "texture"
      },
    )

    this.glBuffers = {}

    this.allocateGlBuffers(gl)

  }

  onMouseDown(event) {
    console.log("mouse down", event)
    this.mouseDownLocation = {x: event.screenX, y: event.screenY}
    this.mouseLastLocation = {x: event.screenX, y: event.screenY}
    document.addEventListener("mouseup", this.onMouseUpListener)
    document.addEventListener("mousemove", this.onMouseDraggedListener)
  }

  onMouseDragged(event) {
    let loc = {x: event.screenX, y: event.screenY}
    let delta = {x: this.mouseLastLocation.x}

    this.mouseLastLocation = loc

    console.log("mouse draggered", event)
  }

  onMouseUp(event) {
    console.log("mouse up", event)
    this.mouseDownLocation = undefined
    document.removeEventListener("mouseup", this.onMouseUpListener)
    document.removeEventListener("mousemove", this.onMouseDraggedListener)
  }

  allocateGlBuffers(gl) {
    let buffers = this.glBuffers

    buffers.positionBuffer = buffers.positionBuffer || gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.NUM_VERTICES*this.NUM_POSITION_ELEMENTS*Float32Array.BYTES_PER_ELEMENT, gl.STATIC_DRAW)

    buffers.texCoordBuffer = buffers.texCoordBuffer || gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.NUM_VERTICES*this.NUM_TEXCOORD_ELEMENTS*Float32Array.BYTES_PER_ELEMENT, gl.STATIC_DRAW)

    buffers.fillColorBuffer = buffers.fillColorBuffer || gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.fillColorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.NUM_VERTICES*this.NUM_FILLCOLOR_ELEMENTS*Float32Array.BYTES_PER_ELEMENT, gl.STATIC_DRAW)

    buffers.indexBuffer = buffers.indexBuffer || gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.NUM_INDICES*Uint32Array.BYTES_PER_ELEMENT, gl.STATIC_DRAW)
  }

  bindGlBuffers(gl, shader) {
    let buffers = this.glBuffers


    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
    gl.enableVertexAttribArray(shader.attribLocations.vertexPos)
    gl.vertexAttribPointer(shader.attribLocations.vertexPos, this.NUM_POSITION_ELEMENTS, gl.FLOAT, false, 0, 0)


    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoordBuffer)
    gl.enableVertexAttribArray(shader.attribLocations.texCoord)
    gl.vertexAttribPointer(shader.attribLocations.texCoord, this.NUM_TEXCOORD_ELEMENTS, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.fillColorBuffer)
    gl.enableVertexAttribArray(shader.attribLocations.color)
    gl.vertexAttribPointer(shader.attribLocations.color, this.NUM_FILLCOLOR_ELEMENTS, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)

  }

  _updateGlBuffers(gl) {
    let buffers = this.glBuffers

    if (this.textTexture !== undefined)
      gl.deleteTexture(this.textTexture.texture)

    // let texturer = new GLTextTexturer()
    // texturer.drawText("foÓbary", window.getComputedStyle(this.div).fontSize)

    this.textTexture = gltools.createTextTexture(gl, "foÓbary", this.div)

    let h = this.textTexture.height/this.textTexture.scale
    let w = this.textTexture.width/this.textTexture.scale

    let positions = [
      [0,h],
      [0,0],
      [w,h],
      [w,0],
    ]
    let texCoords = [
      [0,0],
      [0,1],
      [1,0],
      [1,1],
    ]
    let colors = [
      [0,1,1,1],
      [1,0,1,1],
      [1,1,0,1],
      [1,1,1,1],
    ]

    let indices = [ 0,1,2, 2,1,3]

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(positions.flat()))

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoordBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(texCoords.flat()))

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.fillColorBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(colors.flat()))

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint32Array(indices.flat()))

  }

  glDraw() {
    if (!this.gl) {
      this._initGl()
    }

    let gl = this.gl

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clearColor(0.0, 0.0, 0.0, 0.0)
    gl.clear(gl.COLOR_BUFFER_BIT)



    this._updateGlBuffers(gl)

    let shader = this.simpleShader

    // if index buffer hasn't been set, yet, can't draw
    if (!this.glBuffers.indexBuffer)
      return

    let pixelScale = window.devicePixelRatio || 1.0

    let xscale = 2.0/this.canvas.width*pixelScale
    let yscale = 2.0/this.canvas.height*pixelScale

    // xshift = this.canvas.width/pixelScale
    // yshift = this.canvas.height/pixelScale

    const MV = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]

    const PM = [
      xscale,       0, 0, 0,
            0, yscale, 0, 0,
            0,      0, 1, 0,
          0.0,    0.0, 0, 1
    ]


    // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)

    gl.useProgram(shader.shaderProgram)
    gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
    gl.uniformMatrix4fv(shader.uniformLocations.projectionMatrix, false, PM)

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textTexture.texture)
    gl.uniform1i(shader.uniformLocations.texture, 0)

    this.bindGlBuffers(gl, shader)

    gl.drawElements(gl.TRIANGLES, this.NUM_INDICES, gl.UNSIGNED_INT, 0)

  }

}
