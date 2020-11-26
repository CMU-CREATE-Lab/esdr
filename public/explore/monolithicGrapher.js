

import * as gltools from "./webgltools.js"

export {GLGrapher}

/**

	*** General Notes

	The Date-Axis must deal with displaying date and time, and deal with the user manipulating the visible range through different gestures.

	The main complication is that dates are irregular, eg. there are different length months and years, and care has to be taken to display the grid and ticks right.

	Dates are typically displayed centered on a section in-between ticks, eg in the middle of a day, while times are shown at the corresponding tick locations.

	It is desirable to show a full date at all times, as well as the smallest increment that makes sense:

	----------------------...
	|       Feb 2020      ...
	| 1 | 2 | 3 | 4 | 5 | ...
	----------------------...

	------------------------...
	  |       Feb 28, 2020  ...
  00:00 01:00 02:00 03:00 ...
	  |     |     |     |   ...
	------------------------...

	The BodyTrack grapher sticks to this philosphy, showing 2 tiers even when zoomed out to decades and centuries, but switching to single tier labelling might be more useful once zoomed out far enough

	*** Time Grids

	For time grids, we will disregard leap-seconds in general, and they can be uniform, therefore the time-invariant

	*** Date Grids 

	For years, depending on the zoom level, leap days might or might not be visible. Months have even more pronounced differences. Therefore, we need to create a date grid matching the visible range

	*** Shaders

  We want to position ticks and labels based on time values on the x-axis, therefore need the plotting shaders

	Tickmarks can use the line-segment shader

  Labels are textured. 


  *** Event handling

  In order to handle scrolling and events properly, we need to create invisible overlay divs that provide DOM-structured event processing in the expected manner

*/
class DateAxis {
	constructor(grapher, overlayDiv) {
		this.grapher = grapher
    this.overlayDiv = overlayDiv

    this.NUM_POSITION_ELEMENTS    = 2
    this.NUM_TEXCOORD_ELEMENTS    = 2
    this.NUM_FILLCOLOR_ELEMENTS   = 4
    this.NUM_VERTICES_PER_LABEL = 4
    this.NUM_INDICES_PER_LABEL  = 6

    this.MAX_NUM_TICKS = 100
    this.MAX_NUM_LABELS	= 100
    this.MIN_TICK_SPACING	= 10.0

    this.glBuffers = {}
    this.labels = []

    this.secondsPerPixelScale = 1.0
    this.labelTextures = new Map()
    this.centerTime = Date.now() / 1000.0

	}

  initGl(gl) {

    this.allocateGlBuffers(gl)

    return gl
  }

  glDraw(gl, PM) {
    if (this.gl !== gl) {
      this.gl = this.initGl(gl)
    }

    // figure out our size 
    let {x: {min: xmin, max: xmax}, y: {min: ymin, max: ymax}} = this.grapher.getDateAxisPixelBounds()

    this._updateGlBuffers(gl, {min: xmin, max: xmax})

    // draw a label for every pixel
    let labels = []


    let shader = this.grapher.labelShader

    const MV = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]


    gl.useProgram(shader.shaderProgram)
    gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
    gl.uniformMatrix4fv(shader.uniformLocations.projectionMatrix, false, PM)

    this.bindGlBuffers(gl, shader)

    for (let [i, label] of this.labels.entries()) {

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, label.labelTexture.texture)
      gl.uniform1i(shader.uniformLocations.texture, 0)


      gl.drawElements(gl.TRIANGLES, this.NUM_INDICES_PER_LABEL, gl.UNSIGNED_INT, this.NUM_INDICES_PER_LABEL*i*Uint32Array.BYTES_PER_ELEMENT)

    }
  }


  allocateGlBuffers(gl) {
    let buffers = this.glBuffers

    let baseSize = this.MAX_NUM_LABELS*this.NUM_VERTICES_PER_LABEL

    buffers.positionBuffer = gltools.resizeArrayBuffer(gl, buffers.positionBuffer, baseSize, this.NUM_POSITION_ELEMENTS)

    buffers.texCoordBuffer = gltools.resizeArrayBuffer(gl, buffers.texCoordBuffer, baseSize, this.NUM_TEXCOORD_ELEMENTS)

    buffers.fillColorBuffer = gltools.resizeArrayBuffer(gl, buffers.fillColorBuffer, baseSize, this.NUM_FILLCOLOR_ELEMENTS)

    buffers.indexBuffer = gltools.resizeElementArrayBuffer(gl, buffers.indexBuffer, this.MAX_NUM_LABELS*this.NUM_INDICES_PER_LABEL)

  }


  bindGlBuffers(gl, shader) {
    let buffers = this.glBuffers

    gltools.bindArrayBuffer(gl, buffers.positionBuffer, shader.attribLocations.vertexPos, this.NUM_POSITION_ELEMENTS)

    gltools.bindArrayBuffer(gl, buffers.texCoordBuffer, shader.attribLocations.texCoord, this.NUM_TEXCOORD_ELEMENTS)

    gltools.bindArrayBuffer(gl, buffers.fillColorBuffer, shader.attribLocations.color, this.NUM_FILLCOLOR_ELEMENTS)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)

  }

  getTimeRangeForWidth(pxWidth) {
    let pxCenter = 0.5*pxWidth
    let timeRange = {
      min: (0 - pxCenter)*this.secondsPerPixelScale + this.centerTime, 
      max: (pxWidth - pxCenter)*this.secondsPerPixelScale + this.centerTime
    }

    return timeRange
  }

  _updateGlBuffers(gl, pixelRange) {
    // for now, just draw a labels to fill the x axis
    let buffers = this.glBuffers
    let format = Intl.DateTimeFormat([], {hour12: false, weekday: "long", year: "numeric", month: "2-digit", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"})

    let pxCenter = 0.5*(pixelRange.min + pixelRange.max)
    let timeRange = {
      min: (pixelRange.min - pxCenter)*this.secondsPerPixelScale + this.centerTime, 
      max: (pixelRange.max - pxCenter)*this.secondsPerPixelScale + this.centerTime
    }
    let timestamp = timeRange.min
    let k = 0 // counter for label index

    let labels = []
    while ((timestamp < timeRange.max) && (k < this.MAX_NUM_LABELS)) {
      let labelString = format.format(timestamp*1000.0)
      // console.log(labelString)
      // get cached texture or create it
      let labelTexture = this.labelTextures.get(labelString) 

      if (!labelTexture) {
        labelTexture = gltools.createTextTexture(gl, labelString, this.grapher.div)
        this.labelTextures.set(labelString, labelTexture)
      }

      let h = labelTexture.height/labelTexture.scale
      let w = labelTexture.width/labelTexture.scale

      let timeCoord = (timestamp - timeRange.min)/this.secondsPerPixelScale

      let positions = [
        [0 + timeCoord, 0],
        [0 + timeCoord, h],
        [w + timeCoord, 0],
        [w + timeCoord, h],
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
     
      let indices = [ 0,1,2, 2,1,3].map(x => x + this.NUM_VERTICES_PER_LABEL*k)

      labels.push({
        labelTexture: labelTexture, 
        timestamp: timestamp,
        positions: positions,
        texCoords: texCoords,
        colors: colors,
        indices: indices
      })


      console.assert(w > 0)
      timestamp += (w + this.MIN_TICK_SPACING)*this.secondsPerPixelScale
      k++
    }

    // update gl buffers with computed vertices
    let positions = labels.flatMap(label => label.positions)
    let texCoords = labels.flatMap(label => label.texCoords)
    let colors = labels.flatMap(label => label.colors)
    let indices = labels.flatMap(label => label.indices)

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(positions.flat()))

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoordBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(texCoords.flat()))

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.fillColorBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(colors.flat()))

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint32Array(indices.flat()))

    this.labels = labels
  }

}

class GLGrapher extends gltools.GLCanvasBase {
  constructor(div) {
    super(div)


    this.NUM_POSITION_ELEMENTS    = 2
    this.NUM_TEXCOORD_ELEMENTS    = 2
    this.NUM_FILLCOLOR_ELEMENTS   = 4
    this.NUM_VERTICES   = 4
    this.NUM_INDICES    = 6


    // create overlay divs
    let overlayDiv = document.createElement("div")
    overlayDiv.style.width = "100%"
    overlayDiv.style.height = "100%"
    overlayDiv.style.position = "absolute"
    overlayDiv.style.zIndex = 1
    overlayDiv.style.overflowY = "hidden"
    overlayDiv.style.display = "flex"
    overlayDiv.style.flexDirection = "column"
    overlayDiv.style.alignItems = "stretch"
    div.appendChild(overlayDiv)

    // date axis is a row with the actual axis plus a corner element
    let dateAxisRow = document.createElement("div")
    dateAxisRow.style.background = "rgba(127,0,0,0.2)"
    dateAxisRow.style.padding = "0px"
    dateAxisRow.style.margin = "0px"
    // dateAxisRow.style.width = "100%"
    // dateAxisRow.style.position = "absolute"
    // dateAxisRow.style.zIndex = 1
    dateAxisRow.style.display = "flex"
    dateAxisRow.style.flexDirection = "row"
    dateAxisRow.style.alignItems = "stretch"
    dateAxisRow.style.flexShrink = 0
    dateAxisRow.style.flexGrow = 0
    // dateAxisRow.style.overflowX = "hidden"
    overlayDiv.appendChild(dateAxisRow)

    let dateAxisDiv = document.createElement("div")
    dateAxisDiv.style.background = "rgba(255,0,0,0.2)"
    dateAxisDiv.style.padding = "0px"
    dateAxisDiv.style.margin = "0px"
    // dateAxisDiv.style.width = "100%"
    // dateAxisDiv.style.position = "absolute"
    dateAxisDiv.style.flexShrink = 1
    dateAxisDiv.style.flexGrow = 1
    dateAxisRow.appendChild(dateAxisDiv)

    let dateAxisCorner = document.createElement("div")
    dateAxisCorner.style.background = "rgba(0,0,127,0.2)"
    dateAxisCorner.style.padding = "0px"
    dateAxisCorner.style.margin = "0px"
    dateAxisCorner.style.width = "2em"
    // dateAxisDiv.style.position = "absolute"
    dateAxisCorner.style.flexShrink = 0
    dateAxisCorner.style.flexGrow = 0
    dateAxisRow.appendChild(dateAxisCorner)

    let plotsDiv = document.createElement("div")
    plotsDiv.style.background = "rgba(0,255,0,0.2)"
    plotsDiv.style.padding = "0px"
    plotsDiv.style.margin = "0px"
    // plotsDiv.style.width = "100%"
    // plotsDiv.style.position = "absolute"
    // plotsDiv.style.zIndex = 1
    plotsDiv.style.display = "flex"
    plotsDiv.style.flexDirection = "column"
    plotsDiv.style.alignItems = "stretch"
    plotsDiv.style.overflowX = "auto"
    plotsDiv.style.flexShrink = 1
    plotsDiv.style.flexGrow = 1
    overlayDiv.appendChild(plotsDiv)

    this.overlayDiv = overlayDiv
    this.dateAxisRowDiv = dateAxisRow
    this.dateAxisDiv = dateAxisDiv
    this.dateAxisCornerDiv = dateAxisCorner
    this.plotsDiv = plotsDiv

    this.setDateAxisHeight("2em")


    this.dateAxis = new DateAxis(this)
    this.plots = new Map()


    this.onScrollListener = (event) => this.onScroll(event)

    // listen for scroll events on plots container so we can redraw the graphs
    this.plotsDiv.addEventListener("scroll", this.onScrollListener)


    this.onMouseUpListener = (event) => this.onMouseUp(event)
    this.onMouseDraggedListener = (event) => this.onMouseDragged(event)
    this.onMouseWheelListener = event => this.onMouseWheel(event)

    this.dateAxisDiv.addEventListener("mousedown", (event) => this.onMouseDown(event) )
    this.dateAxisDiv.addEventListener("wheel", (event) => this.onMouseWheel(event) )
    
    this.onMouseUpListener = (event) => this.onMouseUp(event)
    this.onMouseDraggedListener = (event) => this.onMouseDragged(event)

    this.animationFrameHandler = (time) => this.glDraw()

    this.updateCanvasSize()
  }


  setDateAxisHeight(height) {
    this.dateAxisRowDiv.style.height = height
    // this.plotsDiv.style.top = height
    // this.plotsDiv.style.height = `calc(100% - ${height})`
  }

  setYAxisWidth(width) {
    this.dateAxisCorner.style.width = width
    this.plots.forEach(plotInfo => plotInfo.yAxisDiv.style.width = width)
  }

  addPlot(key, plot, labelElement) {

    let plotRow = document.createElement("div")
    plotRow.style.background = "rgba(0,0,127,0.2)"
    plotRow.style.padding = "0px"
    plotRow.style.margin = "0px"
    plotRow.style.width = "100%"
    plotRow.style.height = "20em"
    plotRow.style.display = "flex"
    plotRow.style.flexDirection = "row"
    plotRow.style.alignItems = "stretch"
    plotRow.style.flexShrink = 0

    let plotDiv = document.createElement("div")
    plotDiv.style.background = "rgba(0,0,255,0.2)"
    plotDiv.style.padding = "0px"
    plotDiv.style.margin = "0px"
    plotDiv.style.width = "100%"
    plotDiv.style.flexShrink = 1
    plotDiv.style.flexGrow = 1

    plotRow.appendChild(plotDiv)

    if (labelElement) {
      plotDiv.appendChild(labelElement)
    }

    let plotAxis = document.createElement("div")
    plotAxis.style.background = "rgba(0,0,127,0.2)"
    plotAxis.style.padding = "0px"
    plotAxis.style.margin = "0px"
    plotAxis.style.width = "2em"
    // dateAxisDiv.style.position = "absolute"
    plotAxis.style.flexShrink = 0
    plotAxis.style.flexGrow = 0
    plotRow.appendChild(plotAxis)

    this.plotsDiv.appendChild(plotRow)

    this.plots.set(key, {plot: plot, div: plotDiv, rowDiv: plotRow, yAxisDiv: plotAxis})

    plot.isAutoRangingNegatives = true
    plot.setPlotRange(this.dateAxis.getTimeRangeForWidth(this.dateAxisDiv.offsetWidth))

    window.requestAnimationFrame(this.animationFrameHandler)
  }

  updateCanvasSize() {
    super.updateCanvasSize()
    window.requestAnimationFrame(this.animationFrameHandler)
  }

  onScroll(event) {
    // window.requestAnimationFrame(this.animationFrameHandler)
    this.glDraw()
    this.gl.flush() // flush to reduce lag outside of requestAnimationFrame(), this might help with the graph lagging the label on scrolling
  }


  getDateAxisPixelBounds() {
    let pixelScale = window.devicePixelRatio || 1.0

    let xpixels = this.canvas.width/pixelScale
    let ypixels = this.canvas.height/pixelScale

    return {x: {min: -0.5*xpixels, max: 0.5*xpixels}, y: {min: -0.5*ypixels, max: 0.5*ypixels}}
  }

  generateLineVertices() {
  	let positions = 0

  	let vertices = positions.map(pos => [pos, pos, pos, pos])
  	let indexOffset = 0
  	let indices = positions.map( (position, i) => [4*i + 0, 4*i + 1, 4*i + 2, 4*i + 2, 4*i + 1, 4*i + 3].map(k => k + indexOffset) )
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
    this.labelShader = gltools.initShaderProgram(
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

  updatePlotTimeRanges() {
    let timeRange = this.dateAxis.getTimeRangeForWidth(this.dateAxisDiv.offsetWidth)
    this.plots.forEach(plotInfo => plotInfo.plot.setPlotRange(timeRange))
  }

  onMouseWheel(event) {
    // console.log("mouse wheel", event)
    let dx = event.deltaX
    let dy = event.deltaY
    let loc = {x: event.screenX, y: event.screenY}

    console.log(dx,dy)

    // do either vertical or horizontal scroll, not both at once to avoid weirdness
    if (Math.abs(dy) > Math.abs(dx)) {
      // vertical scroll
      this.dateAxis.secondsPerPixelScale *= Math.pow(1.01,dy)
    }
    else {
      // horizontal scroll
      this.dateAxis.centerTime += dx*this.dateAxis.secondsPerPixelScale

    }
    event.preventDefault()
    event.stopPropagation()

    this.updatePlotTimeRanges()

    window.requestAnimationFrame(this.animationFrameHandler)

  }


  onMouseDown(event) {
    // console.log("mouse down", event)
    let loc = {x: event.screenX, y: event.screenY}
    this.mouseDownLocation = loc
    this.mouseLastLocation = loc
    document.addEventListener("mouseup", this.onMouseUpListener)
    document.addEventListener("mousemove", this.onMouseDraggedListener)
  }

  onMouseDragged(event) {
    let loc = {x: event.screenX, y: event.screenY}
    let delta = {x: loc.x - this.mouseLastLocation.x, y: loc.y - this.mouseLastLocation.y}

    this.mouseLastLocation = loc


    this.dateAxis.centerTime -= delta.x*this.dateAxis.secondsPerPixelScale

    this.updatePlotTimeRanges()

    window.requestAnimationFrame(this.animationFrameHandler)


    // console.log("mouse draggered", event)
  }

  onMouseUp(event) {
    // console.log("mouse up", event)
    this.mouseDownLocation = undefined
    document.removeEventListener("mouseup", this.onMouseUpListener)
    document.removeEventListener("mousemove", this.onMouseDraggedListener)
  }

  allocateGlBuffers(gl) {
    let buffers = this.glBuffers

    buffers.positionBuffer = gltools.resizeArrayBuffer(gl, buffers.positionBuffer, this.NUM_VERTICES, this.NUM_POSITION_ELEMENTS)

    buffers.texCoordBuffer = gltools.resizeArrayBuffer(gl, buffers.texCoordBuffer, this.NUM_VERTICES, this.NUM_TEXCOORD_ELEMENTS)

    buffers.fillColorBuffer = gltools.resizeArrayBuffer(gl, buffers.fillColorBuffer, this.NUM_VERTICES, this.NUM_FILLCOLOR_ELEMENTS)

    buffers.indexBuffer = gltools.resizeElementArrayBuffer(gl, buffers.indexBuffer, this.NUM_INDICES)

  }

  bindGlBuffers(gl, shader) {
    let buffers = this.glBuffers

    gltools.bindArrayBuffer(gl, buffers.positionBuffer, shader.attribLocations.vertexPos, this.NUM_POSITION_ELEMENTS)

    gltools.bindArrayBuffer(gl, buffers.texCoordBuffer, shader.attribLocations.texCoord, this.NUM_TEXCOORD_ELEMENTS)

    gltools.bindArrayBuffer(gl, buffers.fillColorBuffer, shader.attribLocations.color, this.NUM_FILLCOLOR_ELEMENTS)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)

  }

  _updateGlBuffers(gl) {
    let buffers = this.glBuffers

    if (this.textTexture !== undefined)
      gl.deleteTexture(this.textTexture.texture)

  	// date formats from short to long
  	let dateFormats = [
  		{year: "numeric", month: "2-digit", day: "2-digit"},
  		{weekday: "short", year: "numeric", month: "2-digit", day: "2-digit"},
  		{weekday: "short", year: "numeric", month: "short", day: "2-digit"},
  		{weekday: "long", year: "numeric", month: "long", day: "2-digit"},
  	]

  	let dayFormats = [
  		{year: "numeric", month: "2-digit", day: "2-digit"},
  		{weekday: "short", year: "numeric", month: "2-digit", day: "2-digit"},
  		{weekday: "short", year: "numeric", month: "short", day: "2-digit"},
  		{weekday: "long", year: "numeric", month: "long", day: "2-digit"},
  	]

  	let timeFormats = [
  		{hour12: false, weekday: "long", year: "numeric", month: "2-digit", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"}
  	]

  	let format = Intl.DateTimeFormat([], {hour12: false, weekday: "long", year: "numeric", month: "2-digit", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"})
  	let now = Date.now()

    this.textTexture = gltools.createTextTexture(gl, format.format(now), this.div)

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

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.clearColor(0.0, 0.0, 0.0, 0.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)



    this._updateGlBuffers(gl)

    let shader = this.labelShader

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

    // create a matrix for the date axis that shifts it to coincide with dateAxisDiv
    // this PM creates coordinates with CSS conventions: (0,0) is at top-left corner
    let daShift = {
      x: -1.0 + this.dateAxisDiv.offsetLeft*xscale,
      y: 1.0 - this.dateAxisDiv.offsetTop*yscale
    }
    const datePM = [
         xscale,         0, 0, 0,
              0,   -yscale, 0, 0,
              0,         0, 1, 0,
      daShift.x, daShift.y, 0, 1
    ]

    // when drawing the axis, setup glScissor to limit drawing into the axis box
    let dateAxisBottom = this.dateAxisDiv.offsetTop + this.dateAxisDiv.offsetHeight
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(
      this.dateAxisDiv.offsetLeft*pixelScale,
      this.canvas.height - dateAxisBottom*pixelScale,
      this.dateAxisDiv.offsetWidth*pixelScale,
      this.dateAxisDiv.offsetHeight*pixelScale
    )
    this.dateAxis.glDraw(gl, datePM)

    const PM = [
      xscale,       0, 0, 0,
            0, yscale, 0, 0,
            0,      0, 1, 0,
          0.0,    0.0, 0, 1
    ]

    for (let [key, plotInfo] of this.plots) {
      let plotDiv = plotInfo.div
      // let plotRowDiv = plotInfo.rowDiv

      let plotShift = {
        x: -1.0 + (this.plotsDiv.offsetLeft - this.plotsDiv.scrollLeft)*xscale,
        y: 1.0 - (plotDiv.offsetTop - this.plotsDiv.scrollTop)*yscale
      }
      const plotPM = [
             xscale,           0, 0, 0,
                  0,     -yscale, 0, 0,
                  0,           0, 1, 0,
        plotShift.x, plotShift.y, 0, 1
      ]

      // ETP references bottom-right
      // let offset = {
      //   x: this.plotsDiv.offsetLeft + plotDiv.offsetLeft + plotDiv.offsetWidth,
      //   y: this.plotsDiv.offsetTop + plotDiv.offsetTop + plotDiv.offsetHeight
      // }
      let offset = {
        x: plotDiv.offsetWidth,
        y: plotDiv.offsetHeight
      }
      plotInfo.plot.plotHeight = plotDiv.offsetHeight
      plotInfo.plot.plotWidth = plotDiv.offsetWidth

    // gl.disable(gl.SCISSOR_TEST)
      let plotScissorX = this.plotsDiv.offsetLeft - this.plotsDiv.scrollLeft
      let plotScissorY = plotDiv.offsetTop - this.plotsDiv.scrollTop + plotDiv.offsetHeight
      gl.scissor(
        plotScissorX*pixelScale,
        this.canvas.height - (plotScissorY)*pixelScale,
        plotDiv.offsetWidth*pixelScale,
        Math.max(0.0, Math.min(plotDiv.offsetHeight, plotScissorY - dateAxisBottom))*pixelScale
      )

      plotInfo.plot.glDraw(gl, offset, plotPM)
    }

    gl.disable(gl.SCISSOR_TEST)


    gl.useProgram(shader.shaderProgram)
    gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
    gl.uniformMatrix4fv(shader.uniformLocations.projectionMatrix, false, PM)

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textTexture.texture)
    gl.uniform1i(shader.uniformLocations.texture, 0)

    this.bindGlBuffers(gl, shader)

    // gl.drawElements(gl.TRIANGLES, this.NUM_INDICES, gl.UNSIGNED_INT, 0)



  }

}
