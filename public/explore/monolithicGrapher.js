

import * as gltools from "./webgltools.js"

export {GLGrapher}

class PlotAxis {
  constructor(grapher, overlayDiv) {
    this.grapher = grapher
    this.overlayDiv = overlayDiv

    this.NUM_POSITION_ELEMENTS    = 2
    this.NUM_OFFSET_ELEMENTS      = 2
    this.NUM_SIZE_ELEMENTS        = 1
    this.NUM_STROKEWIDTH_ELEMENTS = 1
    this.NUM_TEXCOORD_ELEMENTS    = 2
    this.NUM_FILLCOLOR_ELEMENTS   = 4
    this.NUM_STROKECOLOR_ELEMENTS = 4

    this.NUM_VERTICES_PER_LABEL = 4
    this.NUM_INDICES_PER_LABEL  = 6

    this.NUM_VERTICES_PER_TICK = 4
    this.NUM_INDICES_PER_TICK  = 6

    this.MAX_NUM_TICKS = 100
    this.MAX_NUM_LABELS = 100
    this.MIN_PIXELS_PER_TICK  = 10.0
    this.MIN_PINNED_LABEL_SPACING_PCT  = 100.0

    this.tickGlBuffers = {}
    this.numTicksAllocated = 0
    this.labelGlBuffers = {}
    this.labels = []

    this.highlightTime = undefined
    this.hideRegularLabelsOnHighlight = false
  }

  highlightValueAtTime(requestedTime) {
    this.highlightTime = requestedTime
  }

  getMaxNumLabelVertices() {
    return this.MAX_NUM_LABELS*this.NUM_VERTICES_PER_LABEL
  }

  getMaxNumLabelIndices() {
    return this.MAX_NUM_LABELS*this.NUM_INDICES_PER_LABEL
  }

  initGl(gl) {

    this.allocateGlBuffers(gl)

    return gl
  }

  glDrawLabels(gl, PM, axisBounds) {


    let shader = this.grapher.labelShader

    const MV = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      axisBounds.x.min, 0, 0, 1
    ]


    gl.useProgram(shader.shaderProgram)
    gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
    gl.uniformMatrix4fv(shader.uniformLocations.projectionMatrix, false, PM)

    this.bindLabelGlBuffers(gl, shader)

    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(shader.uniformLocations.texture, 0)

    let hideRegulars = ((this.ticks.highlightTicks.length > 0) && this.hideRegularLabelsOnHighlight)

    for (let [i, label] of this.labels.entries()) {
      // only draw last label if we have a highlighted value
      if (hideRegulars && (i+1 < this.labels.length))
        continue

      gl.bindTexture(gl.TEXTURE_2D, label.labelTexture.texture)


      gl.drawElements(gl.TRIANGLES, this.NUM_INDICES_PER_LABEL, gl.UNSIGNED_INT, (this.NUM_INDICES_PER_LABEL*i)*Uint32Array.BYTES_PER_ELEMENT)

    }

  }



  glDrawAxisPrePlot(gl, PM, axisBounds, plotBounds) {
    if (this.gl !== gl) {
      this.gl = this.initGl(gl)
    }

    this.updateGlBuffers(gl, axisBounds)

    this.glDrawTicks(gl, PM, axisBounds, plotBounds)
  }

  glDrawAxisPostPlot(gl, PM, axisBounds, plotBounds) {
    if (this.gl !== gl) {
      this.gl = this.initGl(gl)
    }

    this.glDrawLabels(gl, PM, axisBounds)
  }


  allocateTickGlBuffers(gl) {
    let buffers = this.tickGlBuffers

    // grow buffer as needed
    if ((this.numTicks === undefined) || (this.numTicks <= this.numTicksAllocated))
      return

    let baseSize = this.numTicks*this.NUM_VERTICES_PER_TICK

    buffers.positionBuffer = gltools.resizeArrayBuffer(gl, buffers.positionBuffer, baseSize, this.NUM_POSITION_ELEMENTS)

    buffers.offsetBuffer = gltools.resizeArrayBuffer(gl, buffers.offsetBuffer, baseSize, this.NUM_OFFSET_ELEMENTS)

    buffers.colorMapValueBuffer = gltools.resizeArrayBuffer(gl, buffers.colorMapValueBuffer, baseSize, this.NUM_TEXCOORD_ELEMENTS)

    // for the labels
    buffers.texCoordBuffer = buffers.colorMapValueBuffer


    buffers.indexBuffer = gltools.resizeElementArrayBuffer(gl, buffers.indexBuffer, this.numTicks*this.NUM_INDICES_PER_TICK)

    this.numTicksAllocated = this.numTicks

  }

  allocateLabelGlBuffers(gl) {
    let buffers = this.labelGlBuffers

    let baseSize = this.getMaxNumLabelVertices()

    buffers.positionBuffer = gltools.resizeArrayBuffer(gl, buffers.positionBuffer, baseSize, this.NUM_POSITION_ELEMENTS)

    buffers.texCoordBuffer = gltools.resizeArrayBuffer(gl, buffers.texCoordBuffer, baseSize, this.NUM_TEXCOORD_ELEMENTS)

    buffers.colorBuffer = gltools.resizeArrayBuffer(gl, buffers.colorBuffer, baseSize, this.NUM_FILLCOLOR_ELEMENTS)


    buffers.indexBuffer = gltools.resizeElementArrayBuffer(gl, buffers.indexBuffer, this.getMaxNumLabelIndices())

  }

  allocateGlBuffers(gl) {
    this.allocateLabelGlBuffers(gl)
    this.allocateTickGlBuffers(gl, this.numTicks)

  }

  bindLabelGlBuffers(gl, shader) {
    let buffers = this.labelGlBuffers

    gltools.bindArrayBuffer(gl, buffers.positionBuffer, shader.attribLocations.vertexPos, this.NUM_POSITION_ELEMENTS)

    gltools.bindArrayBuffer(gl, buffers.texCoordBuffer, shader.attribLocations.texCoord, this.NUM_TEXCOORD_ELEMENTS)

    gltools.bindArrayBuffer(gl, buffers.colorBuffer, shader.attribLocations.color, this.NUM_FILLCOLOR_ELEMENTS)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)

  }


  bindTickGlBuffers(gl, shader) {
    let buffers = this.tickGlBuffers

    gltools.bindArrayBuffer(gl, buffers.positionBuffer, shader.attribLocations.vertexPos, this.NUM_POSITION_ELEMENTS)

    gltools.bindArrayBuffer(gl, buffers.offsetBuffer, shader.attribLocations.pxVertexOffsetDirection, this.NUM_OFFSET_ELEMENTS)

    gltools.bindArrayBuffer(gl, buffers.texCoordBuffer, shader.attribLocations.texCoord, this.NUM_TEXCOORD_ELEMENTS)

    // these attribs are bound directly instead of with arrays, as they're all the same
    gl.disableVertexAttribArray(shader.attribLocations.pxMarkerSize)
    gl.disableVertexAttribArray(shader.attribLocations.pxStrokeWidth)
    gl.disableVertexAttribArray(shader.attribLocations.fillColor)
    gl.disableVertexAttribArray(shader.attribLocations.strokeColor)
    gl.vertexAttrib1f(shader.attribLocations.pxMarkerSize, 1.0)
    gl.vertexAttrib1f(shader.attribLocations.pxStrokeWidth, 0.0)
    gl.vertexAttrib4f(shader.attribLocations.fillColor, 0.0, 0.0, 0.0, 1.0)
    gl.vertexAttrib4f(shader.attribLocations.strokeColor, 0.0, 0.0, 0.0, 1.0)



    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)

  }


  updateGlBuffers(gl, pixelRange) {
    let labels = this.createLabels(gl, pixelRange)
    this.labels = labels

    this.updateTickGlBuffers(gl, pixelRange)
    this.updateLabelGlBuffers(gl, pixelRange)
  }


  updateLabelGlBuffers(gl, pixelRange) {
    let labels = this.labels

    let buffers = this.labelGlBuffers


    // update gl buffers with computed vertices
    let positions = labels.flatMap(label => label.positions)
    let texCoords = labels.flatMap(label => label.texCoords)
    let colors = labels.flatMap(label => label.colors)
    let indices = labels.flatMap(label => label.indices)

    let bufferOffset = 0*Float32Array.BYTES_PER_ELEMENT

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(positions.flat()))

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoordBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(texCoords.flat()))

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colorBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(colors.flat()))

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint32Array(indices.flat()))

  }

  updateTickGlBuffers(gl, pixelRange) {
    if (!this.createTicks)
      return

    let {minorTicks, majorTicks, coarseTicks, highlightTicks} = this.createTicks(gl, pixelRange)

    // merge vertices into single array for all kinds of ticks

    let positions = minorTicks.positions.concat(majorTicks.positions, coarseTicks.positions, highlightTicks.positions)
    let offsets = minorTicks.offsets.concat(majorTicks.offsets, coarseTicks.offsets, highlightTicks.offsets)
    let texCoords = minorTicks.texCoords.concat(majorTicks.texCoords, coarseTicks.texCoords, highlightTicks.texCoords)

    let indices = minorTicks.indices.concat(majorTicks.indices, coarseTicks.indices, highlightTicks.indices)

    // expand buffers
    this.numTicks = positions.length
    this.allocateTickGlBuffers(gl)

    let buffers = this.tickGlBuffers
    let bufferOffset = 0*Float32Array.BYTES_PER_ELEMENT

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(positions.flat()))

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.offsetBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(offsets.flat()))

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoordBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(texCoords.flat()))

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint32Array(indices.flat()))

  }

  /**
   * Return 0 <= i <= array.length such that !predicate(array[i - 1]) && predicate(array[i]).
   * eg. return the index of the first element that matches the predicate
   */
  _binarySearchIndex(array, predicate) {
    let lo = -1
    let hi = array.length
    while (1 + lo < hi) {
      const mi = lo + ((hi - lo) >> 1)
      if (predicate(array[mi])) {
        hi = mi
      } else {
        lo = mi
      }
    }
    return hi
  }

}



class YAxis extends PlotAxis {
  constructor(grapher, overlayDiv, plot) {
    super(grapher, overlayDiv)
    this.plot = plot

    this.MIN_PINNED_LABEL_SPACING_PCT = 25.0

    // this.hideRegularLabelsOnHighlight = true

    this.formats = {
      k: {format: y => `${(y*0.001).toFixed(0)}k`},
      1: {format: y => `${(y).toFixed(0)}`},
      d: {format: y => `${(y).toFixed(1)}`},
      c: {format: y => `${(y).toFixed(2)}`},
      m: {format: y => `${(y).toFixed(3)}`},
    }
  }

  _createLabelsFor(gl, ticks, tickUnit, pixelRange, valueRange, k) {
    let pxHeight = pixelRange.y.max - pixelRange.y.min
    let pxWidth = pixelRange.x.max - pixelRange.x.min
    let perPixelScale = (valueRange.max - valueRange.min)/pxHeight
    
    let fontSize = gltools.computeFontSizingForReferenceElement(this.overlayDiv).fontSize

    let labels = []

    let format = this.formats[tickUnit]

    let maxLabelWidth = 0.0

    for (let [i, y] of ticks.entries()) {
      if (k >= this.MAX_NUM_LABELS)
        break

      let labelString = format.format(y)

      let labelTexture = this.grapher.labelTextures.get(labelString) 

      if (!labelTexture) {
        labelTexture = gltools.createTextTexture(gl, labelString, this.grapher.div)
        this.grapher.labelTextures.set(labelString, labelTexture)
      }

      maxLabelWidth = Math.max(labelTexture.width/labelTexture.scale, maxLabelWidth)
    }

    for (let [i, y] of ticks.entries()) {
      if (k >= this.MAX_NUM_LABELS)
        break

      let labelString = format.format(y)

      let labelTexture = this.grapher.labelTextures.get(labelString) 

      if (!labelTexture) {
        labelTexture = gltools.createTextTexture(gl, labelString, this.grapher.div)
        this.grapher.labelTextures.set(labelString, labelTexture)
      }

      let h = labelTexture.height/labelTexture.scale
      let w = labelTexture.width/labelTexture.scale

      let valueCoord = 1.0*pxHeight - (y - valueRange.min)/perPixelScale

      let space = Math.min(pxHeight - valueCoord, valueCoord - 0) - 0.5*h

      if (space < 0.0)
        continue

      let xOffset = 0.5*fontSize + maxLabelWidth
      let yOffset = valueCoord - (labelTexture.middle/labelTexture.scale)

      let ts = labelTexture.scale

      let positions = [
        [0 + Math.round(xOffset*ts)/ts - w, Math.round(yOffset*ts)/ts - 0],
        [0 + Math.round(xOffset*ts)/ts - w, Math.round(yOffset*ts)/ts + h],
        [w + Math.round(xOffset*ts)/ts - w, Math.round(yOffset*ts)/ts + 0],
        [w + Math.round(xOffset*ts)/ts - w, Math.round(yOffset*ts)/ts + h],
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
        value: y,
        positions: positions,
        texCoords: texCoords,
        colors: colors,
        indices: indices
      })

      k++

    }
    if ((this.ticks.highlightTicks.length > 0))
      labels.push(this.createHighlightLabel(gl, this.ticks.highlightTicks[0], pixelRange, valueRange, k))

    return labels    
  }

  highlightLabelFormat(y) {
    if (y >= 1000000.0)
      return `${(y/1000.0).toFixed(2)}M`
    else if (y >= 100000.0)
      return `${(y/1000.0).toFixed(0)}k`
    else if (y >= 10000.0)
      return `${(y/1000.0).toFixed(1)}k`
    else if (y >= 1000.0)
      return `${(y/1000.0).toFixed(2)}k`
    else if (y >= 100.0)
      return `${(y).toFixed(1)}`
    else if (y >= 10.0)
      return `${(y).toFixed(2)}`
    else if (y >= 1.0)
      return `${(y).toFixed(3)}`
    else
      return `${(y).toFixed(3)}`
  }

  createHighlightLabel(gl, y, pixelRange, valueRange, k) {
    let pxHeight = pixelRange.y.max - pixelRange.y.min
    let pxWidth = pixelRange.x.max - pixelRange.x.min
    let pxPlotWidth = this.grapher.dateAxisDiv.offsetWidth
    let perPixelScale = (valueRange.max - valueRange.min)/pxHeight
    let fontSize = gltools.computeFontSizingForReferenceElement(this.overlayDiv).fontSize

    let labelString = this.highlightLabelFormat(y)

    let labelTexture = this.grapher.labelTextures.get(labelString + "-red") 

    if (!labelTexture) {
      labelTexture = gltools.createTextTexture(gl, labelString, this.grapher.div, "red")
      this.grapher.labelTextures.set(labelString + "-red", labelTexture)
    }

    let h = labelTexture.height/labelTexture.scale
    let w = labelTexture.width/labelTexture.scale

    let valueCoord = 1.0*pxHeight - (y - valueRange.min)/perPixelScale
    let timeCoord = - 0.5*pxPlotWidth + (this.highlightTime - this.grapher.dateAxis.centerTime)/this.grapher.dateAxis.secondsPerPixelScale

    // draw highlight label centered
    // let xOffset = 0.5*pxWidth
    // let yOffset = 0.5*pxHeight - (labelTexture.middle/labelTexture.scale)

    // draw highlight label at coordinate
    let xOffset = timeCoord - 0.25*fontSize
    let yOffset = Math.min(Math.max(valueCoord - (labelTexture.middle/labelTexture.scale), 0.0), pxHeight-1.0*h)

    let ts = labelTexture.scale

    let positions = [
      [0 + Math.round(xOffset*ts)/ts - 1.0*w, Math.round(yOffset*ts)/ts - 0],
      [0 + Math.round(xOffset*ts)/ts - 1.0*w, Math.round(yOffset*ts)/ts + h],
      [w + Math.round(xOffset*ts)/ts - 1.0*w, Math.round(yOffset*ts)/ts + 0],
      [w + Math.round(xOffset*ts)/ts - 1.0*w, Math.round(yOffset*ts)/ts + h],
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

    return {
      labelTexture: labelTexture, 
      value: y,
      positions: positions,
      texCoords: texCoords,
      colors: colors,
      indices: indices
    }
  }

  getTicksForValueRange(valueRange, pixelRange, lineHeight) {
    let pxHeight = pixelRange.y.max - pixelRange.y.min
    let perPixelScale = (valueRange.max - valueRange.min)/pxHeight

    let minDeltaPerTick = Math.max(
      this.MIN_PIXELS_PER_TICK * perPixelScale,
      pxHeight / this.MAX_NUM_TICKS * perPixelScale
    )

    let tickPossibilities = [
      [1, "m"],
      [2, "m"],
      [5, "m"],
      [1, "c"],
      [2, "c"],
      [5, "c"],
      [1, "d"],
      [2, "d"],
      [5, "d"],
      [1, "1"],
      [2, "1"],
      [5, "1"],
      [10, "1"],
      [20, "1"],
      [50, "1"],
      [100, "1"],
      [200, "1"],
      [500, "1"],
      [1, "k"],
      [2, "k"],
      [5, "k"],
      [10, "k"],
      [20, "k"],
      [50, "k"],
      [100, "k"],
      [200, "k"],
      [500, "k"],
    ]

    function unitStep(unit) {
      switch(unit) {
        case "k":
          return 1000.0
        case "1":
          return 1.0
        case "d":
          return 0.1
        case "c":
          return 0.01
        case "m":
          return 0.001
      }
    }

    let minorTickIndex = this._binarySearchIndex(tickPossibilities, ([count, unit]) => {
      let dy = count*unitStep(unit)
      return dy >= minDeltaPerTick
    })

    let minorTick = tickPossibilities[minorTickIndex]

    let minorTickTimeStamps = []

    // now that we know the tick spacing, we need to find the actual ticks in valueRange

    for (let y = this.nextTickAfter(valueRange.min, minorTick); y < valueRange.max; y = this.nextTickAfter(y, minorTick)) {
      minorTickTimeStamps.push(y)
    }


    let minMajorDeltaPerTick = Math.max(
      lineHeight*(1.0 + this.MIN_PINNED_LABEL_SPACING_PCT*0.01)*perPixelScale, 
      minDeltaPerTick)

    let majorTickIndex = this._binarySearchIndex(tickPossibilities, ([count, unit]) => {
      let dy = count*unitStep(unit)
      return dy >= minMajorDeltaPerTick
    })

    let majorTick = tickPossibilities[majorTickIndex]

    let majorTickTimeStamps = []

    // now that we know the tick spacing, we need to find the actual ticks in valueRange

    for (let y = this.nextTickAfter(valueRange.min - 0.5*majorTick[0]*unitStep(majorTick[1]), majorTick); y < valueRange.max; y = this.nextTickAfter(y, majorTick)) {
      majorTickTimeStamps.push(y)
    }

    let highlightValue = this.plot.getValueAroundTime(this.highlightTime) 

    return {
      majorTicks: majorTickTimeStamps,
      majorUnit: majorTick[1],
      minorTicks: minorTickTimeStamps,
      highlightTicks: isFinite(highlightValue) ? [highlightValue] : []
    }
  }



  nextTickAfter(y, [tickCount, tickUnit]) {
    let factor = 1.0
    switch (tickUnit) {
      case "k": {
        factor = tickCount*1000.0
        break
      }
      case "1": {
        factor = tickCount*1.0
        break
      }
      case "d": {
        factor = tickCount*0.1
        break
      }
      case "c": {
        factor = tickCount*0.01
        break
      }
      case "m": {
        factor = tickCount*0.001
        break
      }
    }

    let yy = Math.floor(y/(factor))
    let tickY = (yy+1)*factor
    return tickY - y > 0.5*factor ? tickY : tickY + factor
  }


  createLabels(gl, pixelRange) {

    let valueRange = this.plot.getVisibleValueRange()
    this.valueRange = valueRange

    let lineHeight = gltools.computeFontSizingForReferenceElement(this.overlayDiv).lineHeight

    let ticks = this.getTicksForValueRange(valueRange, pixelRange, lineHeight)
    this.ticks = ticks;

    let labels = this._createLabelsFor(gl, ticks.majorTicks, ticks.majorUnit, pixelRange, valueRange, 0)

    return labels
  }

  _createTicksFor(gl, ticks, weight, k) {
    

    let positions = ticks.map(y => [[0, y], [0, y], [1.0, y], [1.0, y]].flat())
    let offsets = ticks.map(y => [[0, 1], [0, -1], [0, 1], [0, -1]].flat())
    let texCoords = ticks.map(y => [[0, 0], [0, 0], [0, 0], [0, 0]].flat())

    let indices = ticks.map((y, i) => [ 0,1,2, 2,1,3].map(x => x + this.NUM_VERTICES_PER_LABEL*(k+i) ))

    // console.assert(k+ticks.length < this.MAX_NUM_TICKS)

    return {positions, offsets, texCoords, indices}
  }

  createTicks(gl, pixelRange) {

    let minorTicks = this._createTicksFor(gl, this.ticks.minorTicks, 1.0, 0)
    let majorTicks = this._createTicksFor(gl, this.ticks.majorTicks, 1.0, this.ticks.minorTicks.length)
    let coarseTicks = {positions: [], offsets: [], texCoords: [], indices: []}

    let highlightTicks = this._createTicksFor(gl, this.ticks.highlightTicks, 1.0, this.ticks.minorTicks.length + this.ticks.majorTicks.length)

    return {minorTicks, majorTicks, coarseTicks, highlightTicks}
  }

  glDrawTicks(gl, PM, axisBounds, plotBounds) {
    let pxHeight = axisBounds.y.max - axisBounds.y.min
    let perPixelScale = (this.valueRange.max - this.valueRange.min)/pxHeight


    // the ticks are in graph space

    let lineHeight = gltools.computeFontSizingForReferenceElement(this.overlayDiv).lineHeight


    let shader = this.grapher.lineShader

    gl.useProgram(shader.shaderProgram)
    gl.uniformMatrix4fv(shader.uniformLocations.projectionMatrix, false, PM)
    gl.uniform2fv(shader.uniformLocations.colorMapYRange, [0.0, 1.0])
    gl.uniform1f(shader.uniformLocations.markerScale, 1.0)
    gl.uniform1f(shader.uniformLocations.pixelScale, window.devicePixelRatio || 1.0)
    // gl.uniform1f(shader.uniformLocations.pixelScale, 999.0)

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.grapher.whiteTexture)
    gl.uniform1i(shader.uniformLocations.colorMapSampler, 0)

    this.bindTickGlBuffers(gl, shader)


    // console.log("will attempt to draw indices", this.NUM_INDICES_PER_LABEL*this.ticks.minorTicks.length)

    // draw MINOR ticks
    {
      // assume that outer coord space is CSS (0,0) at top-left
      // but graph is GL (0,0) at bottom left
      let xscale = lineHeight*0.25
      let yscale = pxHeight/(this.valueRange.max - this.valueRange.min)
      let xshift = axisBounds.x.min - lineHeight*0.125
      let yshift = this.overlayDiv.offsetHeight + this.valueRange.min*yscale
      // let yshift = this.overlayDiv.offsetHeight

      const MV = [
        xscale,       0, 0, 0,
             0, -yscale, 0, 0,
             0,       0, 1, 0,
        xshift,  yshift, 0, 1
      ]
      gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
    }

    gl.drawElements(gl.TRIANGLES, this.NUM_INDICES_PER_LABEL*this.ticks.minorTicks.length, gl.UNSIGNED_INT, (0)*Uint32Array.BYTES_PER_ELEMENT)

    // draw MAJOR ticks, first grid lines then ticks
    {
      // assume that outer coord space is CSS (0,0) at top-left
      // but graph is GL (0,0) at bottom left
      let xscale = axisBounds.x.min
      let yscale = pxHeight/(this.valueRange.max - this.valueRange.min)
      let xshift = 0
      let yshift = this.overlayDiv.offsetHeight + this.valueRange.min*yscale
      // let yshift = this.overlayDiv.offsetHeight

      const MV = [
        xscale,       0, 0, 0,
             0, -yscale, 0, 0,
             0,       0, 1, 0,
        xshift,  yshift, 0, 1
      ]
      gl.vertexAttrib4f(shader.attribLocations.fillColor, 0.0, 0.0, 0.0, 0.18)
      gl.vertexAttrib4f(shader.attribLocations.strokeColor, 0.0, 0.0, 0.0, 0.18)
      gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
      gl.uniform1f(shader.uniformLocations.markerScale, 0.5)
      gl.drawElements(gl.TRIANGLES, this.NUM_INDICES_PER_LABEL*this.ticks.majorTicks.length, gl.UNSIGNED_INT, (this.NUM_INDICES_PER_LABEL*this.ticks.minorTicks.length)*Uint32Array.BYTES_PER_ELEMENT)
    }
    {
      // assume that outer coord space is CSS (0,0) at top-left
      // but graph is GL (0,0) at bottom left
      let xscale = lineHeight*0.5
      let yscale = pxHeight/(this.valueRange.max - this.valueRange.min)
      let xshift = axisBounds.x.min - lineHeight*0.25
      let yshift = this.overlayDiv.offsetHeight + this.valueRange.min*yscale
      // let yshift = this.overlayDiv.offsetHeight

      const MV = [
        xscale,       0, 0, 0,
             0, -yscale, 0, 0,
             0,       0, 1, 0,
        xshift,  yshift, 0, 1
      ]
      gl.vertexAttrib4f(shader.attribLocations.fillColor, 0.0, 0.0, 0.0, 1.0)
      gl.vertexAttrib4f(shader.attribLocations.strokeColor, 0.0, 0.0, 0.0, 1.0)
      gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
      gl.uniform1f(shader.uniformLocations.markerScale, 1.0)
      gl.drawElements(gl.TRIANGLES, this.NUM_INDICES_PER_LABEL*this.ticks.majorTicks.length, gl.UNSIGNED_INT, (this.NUM_INDICES_PER_LABEL*this.ticks.minorTicks.length)*Uint32Array.BYTES_PER_ELEMENT)
    }
    // draw highlight tick
    if (this.ticks.highlightTicks.length) {
      // assume that outer coord space is CSS (0,0) at top-left
      // but graph is GL (0,0) at bottom left
      let xscale = axisBounds.x.min
      let yscale = pxHeight/(this.valueRange.max - this.valueRange.min)
      let xshift = 0
      let yshift = this.overlayDiv.offsetHeight + this.valueRange.min*yscale

      const MV = [
        xscale,       0, 0, 0,
             0, -yscale, 0, 0,
             0,       0, 1, 0,
        xshift,  yshift, 0, 1
      ]
      gl.vertexAttrib4f(shader.attribLocations.fillColor, 1.0, 0.0, 0.0, 1.0)
      gl.vertexAttrib4f(shader.attribLocations.strokeColor, 1.0, 0.0, 0.0, 1.0)
      gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
      gl.uniform1f(shader.uniformLocations.markerScale, 1.0)
      gl.drawElements(
        gl.TRIANGLES, 
        this.NUM_INDICES_PER_LABEL*(this.ticks.highlightTicks.length), 
        gl.UNSIGNED_INT, 
        (this.ticks.minorTicks.length + this.ticks.majorTicks.length)*this.NUM_INDICES_PER_LABEL*Uint32Array.BYTES_PER_ELEMENT
      )
    }

  }

}


/**

	*** General Notes

	The Date-Axis must deal with displaying date and time, and deal with the user manipulating the visible range through different gestures.

	The main complication is that dates are irregular, eg. there are different length months and years, and care has to be taken to display the grid and ticks right.

	Dates are typically displayed centered (boxed) on a section in-between ticks, eg in the middle of a day, while times are shown (pinned) at the corresponding tick locations.

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

	The BodyTrack grapher sticks to this philosphy, showing 2 tiers even when zoomed out to decades and centuries, but switching to single tier labelling might be more useful once zoomed out far enough.

  **** Which Scaling to Show?

  Tick spacing is different for different demarkations of date / time. The basic units are
    - year
    - month
      - week
      - day
    - hour
    - minute
    - second

  For each of these, labelling and (tick) distribution are different
    - year: yearly decimal -- 1 (2) (5) 10 ...
    - month / week / day: daily -- 1 (7)
    - hour: 1 (3) (6) 12
    - minute / second: 1 5 (15) 30

  Boxed labels can be shown as long as they fit into their respective boxes, but pinned labels need some spacing between them.

  Scales shown need to be independent of previous states, so that a graph with the same time range, same sized box, and same styling always shows the same ticks and labels



	**** Time Grid Uniformity

	For time grids, we will disregard leap-seconds in general, and they can be uniform, therefore the time-invariant

	**** Date Grid Uniformity

	For years, depending on the zoom level, leap days might or might not be visible. Months have even more pronounced differences. Therefore, we need to create a date grid matching the visible range

	*** Shaders

  We want to position ticks and labels based on time values on the x-axis, therefore need the plotting shaders

	Tickmarks can use the line-segment shader

  Labels are textured. 


  *** Event Handling and Layout

  In order to handle scrolling and events properly, we need to create invisible overlay divs that provide DOM-structured event processing in the expected manner.

  DIV elements are created for each plot area, and they are used to calculate where to draw in the WebGL backing canvas.

*/
class DateAxis extends PlotAxis{
	constructor(grapher, overlayDiv) {
    super(grapher, overlayDiv)

    this.BOXED_LABEL_MARGIN_PX  = 10.0
    this.MAX_NUM_TICKS = 200

    this.secondsPerPixelScale = 1.0
    this.centerTime = Date.now() / 1000.0


    this.shortFineFormats = {
      second: Intl.DateTimeFormat([], {hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit"}),
      minute: Intl.DateTimeFormat([], {hour12: false, hour: "2-digit", minute: "2-digit"}),
      hour:   Intl.DateTimeFormat([], {hour12: false, hour: "2-digit", minute: "2-digit"}),
      day:    Intl.DateTimeFormat([], {day: "2-digit"}),
      week:   Intl.DateTimeFormat([], {day: "2-digit"}),
      month:  Intl.DateTimeFormat([], {month: "short"}),
      year:   Intl.DateTimeFormat([], {year: "2-digit"}),
      decade: Intl.DateTimeFormat([], {year: "numeric"}),
      century: Intl.DateTimeFormat([], {year: "numeric"}),
      millenium: Intl.DateTimeFormat([], {year: "numeric"}),
    }

    this.shortCoarseFormats = {
      day:    Intl.DateTimeFormat([], {year: "numeric", month: "short", day: "2-digit"}),
      week:   Intl.DateTimeFormat([], {year: "numeric", month: "short", day: "2-digit"}),
      month:  Intl.DateTimeFormat([], {year: "numeric", month: "short"}),
      year:   Intl.DateTimeFormat([], {year: "numeric"}),
      decade: Intl.DateTimeFormat([], {year: "numeric"}),
      century: Intl.DateTimeFormat([], {year: "numeric"}),
      millenium: Intl.DateTimeFormat([], {year: "numeric"}),
    }

	}

  /**
    @param {number} k - total label counter
  */
  _createLabelsFor(gl, ticks, tickUnit, isBoxed, formats, pixelRange, timeRange, yCenterFrac, k) {

    let labels = []

    let axisHeight = pixelRange.y.max - pixelRange.y.min

    let format = formats[tickUnit]

    // if these are boxed labels, we need to add entries at the end and beginning
    if (isBoxed) {
      ticks = [timeRange.min].concat(ticks)
      ticks.push(timeRange.max)
    }

    for (let [i, t] of ticks.entries()) {
      if (k >= this.MAX_NUM_LABELS)
        break
      // don't bother with last tick if we're showing boxed values, as it would be out of view
      if (isBoxed && (i+1 == ticks.length))
        continue




      let labelString = format.format(t*1000.0)
      // console.log(labelString)
      // get cached texture or create it
      let labelTexture = this.grapher.labelTextures.get(labelString) 

      if (!labelTexture) {
        labelTexture = gltools.createTextTexture(gl, labelString, this.grapher.div)
        this.grapher.labelTextures.set(labelString, labelTexture)
      }

      let h = labelTexture.height/labelTexture.scale
      let w = labelTexture.width/labelTexture.scale

      let timeCoord = (t - timeRange.min)/this.secondsPerPixelScale

      let boxSpace = (ticks[i+1] - t)/this.secondsPerPixelScale - 2.0*this.BOXED_LABEL_MARGIN_PX - w
      let pinSpace = 2.0*Math.min(pixelRange.x.max - timeCoord, timeCoord - pixelRange.x.min) - w

      let space = isBoxed ? boxSpace : pinSpace


     // don't draw label if it'd overflow its space
      if (space < 0.0)
        continue

      let xOffset = isBoxed ? 0.5*(ticks[i+1] - t)/this.secondsPerPixelScale : 0
      let yOffset = pixelRange.y.min + yCenterFrac*axisHeight - (labelTexture.middle/labelTexture.scale - 0.0*labelTexture.fontSize)
      // let yOffset = 0.5*axisHeight

      let ts = labelTexture.scale

      let positions = [
        [0 + Math.round((timeCoord + xOffset)*ts)/ts - 0.5*w, Math.round(yOffset*ts)/ts - 0],
        [0 + Math.round((timeCoord + xOffset)*ts)/ts - 0.5*w, Math.round(yOffset*ts)/ts + h],
        [w + Math.round((timeCoord + xOffset)*ts)/ts - 0.5*w, Math.round(yOffset*ts)/ts + 0],
        [w + Math.round((timeCoord + xOffset)*ts)/ts - 0.5*w, Math.round(yOffset*ts)/ts + h],
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
        timestamp: t,
        positions: positions,
        texCoords: texCoords,
        colors: colors,
        indices: indices
      })

      k++
    }

    return labels
  }

  createLabels(gl, pixelRange) {

    let axisHeight = pixelRange.y.max - pixelRange.y.min


    let timeRange = this.getTimeRangeForPixels(pixelRange.x.min, pixelRange.x.max - pixelRange.x.min)

    let ticks = this.getTicksForTimeRange(timeRange, pixelRange.x.max - pixelRange.x.min)
    this.ticks = ticks

    let labels = this._createLabelsFor(gl, ticks.majorTicks, ticks.majorUnit, ticks.fineLabelBoxed, this.shortFineFormats, pixelRange, timeRange, 0.75, 0)


    labels = labels.concat(this._createLabelsFor(gl, ticks.coarseTicks, ticks.coarseUnit, ticks.coarseLabelBoxed, this.shortCoarseFormats, pixelRange, timeRange, 0.25, labels.length))

    return labels
  }


  getTimeRangeForPixels(offsetLeft, offsetWidth) {
    let pxCenter = this.overlayDiv.offsetLeft + 0.5*this.overlayDiv.offsetWidth
    let timeRange = {
      min: (offsetLeft - pxCenter)*this.secondsPerPixelScale + this.centerTime, 
      max: ((offsetLeft + offsetWidth) - pxCenter)*this.secondsPerPixelScale + this.centerTime
    }

    return timeRange
  }

  getTimeRangeForDiv(div) {
    return this.getTimeRangeForPixels(div.offsetLeft, div.offsetWidth)
  }


  computeMajorTicksFor(tickPossibilities, boxedUnits, timeRange, pxWidth) {
    /*
      the major ticks are the ones that get labels, and we must figure out if the labels provide enough space
    */
    let texter = new gltools.GLTextTexturer()
    let fontSize = gltools.computeFontSizingForReferenceElement(this.overlayDiv).fontSize


    let majorTicks = undefined
    for (let [tickCount, tickUnit] of tickPossibilities) {
      // for each tick spacing, check if we have enough space to draw labels
      let isBoxed = boxedUnits[tickUnit]

      // ticks include end boxes if thi
      let ticks = []
      for (let t = this.nextTickOnOrAfter(timeRange.min, [tickCount, tickUnit]); t < timeRange.max; t = this.nextTickOnOrAfter(t + 1.0, [tickCount, tickUnit])) {
        ticks.push(t)
      }

      // find shortest possible label sizes
      let tickLabels = ticks.map(t => {

        let labelFormat = this.shortFineFormats[tickUnit]
        let labelText = labelFormat.format(t*1000.0)

        let {textWidth: labelWidth} = texter.computeTextSize(labelText, fontSize)

        return {width: labelWidth, offset: (t-timeRange.min)/this.secondsPerPixelScale}
      })

      // check if spacing works out
      let labelsTooBig = tickLabels.some((firstLabel, i) => {
        if (i+1 == tickLabels.length)
          return false

        let secondLabel = tickLabels[i+1]

        if (isBoxed) {
          let space = secondLabel.offset - firstLabel.offset - firstLabel.width
          if (space < 2.0*this.BOXED_LABEL_MARGIN_PX)
            return true
        }
        else {
          let space = secondLabel.offset - firstLabel.offset - 0.5*(secondLabel.width + firstLabel.width)
          // if we have less space than necessary, we're too big
          if (space < this.MIN_PINNED_LABEL_SPACING_PCT*0.01*Math.max(secondLabel.width, firstLabel.width))
            return true
        }

        return false
      })

      if (!labelsTooBig)
        return {majorTicks: ticks, majorUnit: tickUnit, majorTickCount: tickCount}
    }

    // if we haven't found a fitting unit, return empty fields
    return {}
  }

  /**
    @param {Range} timeRange - time range for which to get the ticks
  */
  getTicksForTimeRange(timeRange, pxWidth) {
    /*
      Tick generation:

      We have
        FINE ticks
          MINOR: just ticks
          MAJOR: tick and label
        COARSE ticks and labels
    */

    // find minor tick spacing based on this.secondsPerPixelScale
    // but respect MAX_NUM_TICKS
    let minSecondsPerTick = Math.max(
      this.MIN_PIXELS_PER_TICK * this.secondsPerPixelScale,
      pxWidth / this.MAX_NUM_TICKS * this.secondsPerPixelScale
    )
    let minorTickPossibilities = [
      [1, "second"],
      [5, "second"],
      [15, "second"],
      [30, "second"],
      [1, "minute"],
      [5, "minute"],
      [15, "minute"],
      [30, "minute"],
      [1, "hour"],
      [3, "hour"],
      [6, "hour"],
      [12, "hour"],
      [1, "day"],
      [1, "week"],
      [1, "month"],
      [3, "month"],
      [6, "month"],
      [1, "year"],
      [5, "year"],
      [1, "decade"],
      [5, "decade"],
      [1, "century"],
      [5, "century"],
      [1, "millenium"],
    ]

    let minorTickIndex = this._binarySearchIndex(minorTickPossibilities, ([count, unit]) => {
      let dt = count*this.maxSecondsPerUnit(unit)
      return dt >= minSecondsPerTick
    })

    let minorTick = minorTickPossibilities[minorTickIndex]

    let minorTickTimeStamps = []

    // now that we know the tick spacing, we need to find the actual times in timeRange
    // as the ticks might be slightly irregular, we can only loop through the time range to find the right times
    for (let t = this.nextTickOnOrAfter(timeRange.min, minorTick); t < timeRange.max; t = this.nextTickOnOrAfter(t + 1.0, minorTick)) {
      minorTickTimeStamps.push(t)
    }

    // which units to show as boxed, eg. in the middle of intervals 
    let boxedUnits = {
      day: true,
      month: true,
      year: true,
    }

    let {majorTicks: majorTickTimestamps, majorUnit: majorUnit, majorTickCount: majorTickCount} = this.computeMajorTicksFor(minorTickPossibilities.slice(minorTickIndex), boxedUnits, timeRange, pxWidth)

    // knowing the ticks to show, that gives us the units we need to show
    // let fineUnit = minorTick[1]
    let fineToCoarseUnitMap = {
      second: "day",
      minute: "day",
      hour: "day",
      day: "month",
      week: "month",
      month: "year",
      year: "decade",
      decade: "century",
      century: "millenium",
    }

    let coarseUnit = fineToCoarseUnitMap[majorUnit]


    let coarseTickTimeStamps = []
    for (let t = this.nextTickOnOrAfter(timeRange.min, [1, coarseUnit]); t < timeRange.max; t = this.nextTickOnOrAfter(t + 1.0, [1, coarseUnit])) {
      coarseTickTimeStamps.push(t)
    }

    return {
      minorTicks: minorTickTimeStamps,
      majorTicks: majorTickTimestamps,
      majorUnit: majorUnit,
      coarseTicks: coarseTickTimeStamps,
      coarseUnit: coarseUnit,
      // labels shouldn't be boxed when they apply to more than one base unit
      fineLabelBoxed: boxedUnits[majorUnit] && (majorTickCount == 1),
      // coarse labels only do base units, so no problem there
      coarseLabelBoxed: boxedUnits[coarseUnit],
      highlightTicks: isFinite(this.highlightTime) ? [this.highlightTime] : []
    }
  }



  nextTickOnOrAfter(timestamp, [tickCount, tickUnit]) {
    let tsDate = new Date(timestamp*1000.0)
    let date = undefined

    let tsYear = tsDate.getFullYear()
    let tsMonth = tsDate.getMonth()
    let tsDay = tsDate.getDate() // day of month
    let tsHour = tsDate.getHours()
    let tsMinute = tsDate.getMinutes()
    let tsSecond = tsDate.getSeconds()

    switch (tickUnit) {
      case "millenium" : {
        let tsModYear = tsYear % 1000*tickCount
        let tickYear = tsYear - tsModYear

        date = new Date(tickYear, 0)

        // as on or after, we can't before the tsdate
        if (date < tsDate)
          date = new Date(tickYear + 1000*tickCount, 0)

        break
      }
      case "century" : {
        let tsModYear = tsYear % 100*tickCount
        let tickYear = tsYear - tsModYear

        date = new Date(tickYear, 0)

        // as on or after, we can't before the tsdate
        if (date < tsDate)
          date = new Date(tickYear + 100*tickCount, 0)

        break
      }
      case "decade" : {
        let tsModYear = tsYear % 10*tickCount
        let tickYear = tsYear - tsModYear

        date = new Date(tickYear, 0)

        // as on or after, we can't before the tsdate
        if (date < tsDate)
          date = new Date(tickYear + 10*tickCount, 0)

        break
      }
      case "year" : {
        let tsModYear = tsYear % tickCount
        let tickYear = tsYear - tsModYear

        date = new Date(tickYear, 0)

        // as on or after, we can't before the tsdate
        if (date < tsDate)
          date = new Date(tickYear + 1*tickCount, 0)

        break
      }
      case "month": {
        let tsModMonth = tsMonth % tickCount

        let tickMonth = tsMonth - tsModMonth

        date = new Date(tsYear, tickMonth)

        if (date < tsDate)
          date = new Date(tsYear, tickMonth + 1*tickCount)

        break
      }
      case "week": {
        // BEWARE: week assumes tickCount == 1
        let tsWeekDay = tsDate.getDay() // 0-6

        let tickDay = tsDay - tsWeekDay

        date = new Date(tsYear, tsMonth, tickDay)

        if (date < tsDate)
          date = new Date(tsYear, tsMonth, tickDay + 7*tickCount)

        break
      }
      case "day": {
        // BEWARE: day assumes tickCount == 1, as I don't know how it could used to create a regular grid for multiples of one day because of the irregular nature of months and years

        date = new Date(tsYear, tsMonth, tsDay)

        if (date < tsDate)
          date = new Date(tsYear, tsMonth, tsDay + tickCount)

        break
      }
      case "hour": {
        let tsModHour = tsHour % tickCount
        let tickHour = tsHour - tsModHour

        date = new Date(tsYear, tsMonth, tsDay, tickHour)

        if (date < tsDate)
          date = new Date(tsYear, tsMonth, tsDay, tickHour + tickCount)

        break
      }
      case "minute": {
        let tsModMinute = tsMinute % tickCount
        let tickMinute = tsMinute - tsModMinute

        date = new Date(tsYear, tsMonth, tsDay, tsHour, tickMinute)

        if (date < tsDate)
          date = new Date(tsYear, tsMonth, tsDay, tsHour, tickMinute + tickCount)

        break
      }
      case "second": {
        let tsModSecond = tsSecond % tickCount
        let tickSecond = tsSecond - tsModSecond

        date = new Date(tsYear, tsMonth, tsDay, tsHour, tsMinute, tickSecond)

        if (date < tsDate)
          date = new Date(tsYear, tsMonth, tsDay, tsHour, tsMinute, tickSecond + tickCount)

        break
      }
    }

    return date*0.001
  }

  maxSecondsPerUnit(timeUnit) {
    switch(timeUnit) {
      case "second":
        return 1.0
      case "minute":
        return 60.0
      case "hour":
        return 60.0*60.0
      case "day":
        return 24.0*60.0*60.0
      case "week":
        return 7.0*24.0*60.0*60.0
      case "month":
        return 31.0*24.0*60.0*60.0
      case "year":
        return 365.0*24.0*60.0*60.0
      case "decade":
        return 10.0*365.0*24.0*60.0*60.0
      case "century":
        return 100.0*365.0*24.0*60.0*60.0
      case "millenium":
        return 1000.0*365.0*24.0*60.0*60.0
      default:
        console.error("Unknown time unit", timeUnit)
        return NaN
    }
  }

  _createTicksFor(gl, ticks, weight, k) {
    
    let ct = this.centerTime

    let positions = ticks.map(t => [[t-ct, 1.0], [t-ct, 0.0], [t-ct, 1.0], [t-ct, 0.0]].flat())
    let offsets = ticks.map(t => [[-1, 0], [-1, 0], [1, 0], [1, 0]].flat())
    let texCoords = ticks.map(t => [[0, 0], [0, 0], [0, 0], [0, 0]].flat())

    let indices = ticks.map((t, i) => [ 0,1,2, 2,1,3].map(x => x + this.NUM_VERTICES_PER_LABEL*(k+i) ))

    // if(k+ticks.length > this.MAX_NUM_TICKS) {
    //   console.warn("exceeded maximum number of ticks on date axis, ignoring the rest")
    //   return {positions: [], offsets: [], texCoords: [], indices: []}
    // }

    return {positions, offsets, texCoords, indices}
  }

  createTicks(gl, pixelRange) {

    let minorTicks = this._createTicksFor(gl, this.ticks.minorTicks, 1.0, 0)
    let majorTicks = this._createTicksFor(gl, this.ticks.majorTicks, 1.0, this.ticks.minorTicks.length)
    let coarseTicks = this._createTicksFor(gl, this.ticks.coarseTicks, 1.0, this.ticks.minorTicks.length + this.ticks.majorTicks.length)

    let highlightTicks =  this._createTicksFor(gl, this.ticks.highlightTicks, 1.0, this.ticks.minorTicks.length + this.ticks.majorTicks.length + this.ticks.coarseTicks.length)

    return {minorTicks, majorTicks, coarseTicks, highlightTicks}
  }

  glDrawTicks(gl, PM, axisBounds, plotBounds) {
    let pxHeight = axisBounds.y.max - axisBounds.y.min
    let pxWidth = axisBounds.x.max - axisBounds.x.min


    // the ticks are in graph space

    let lineHeight = gltools.computeFontSizingForReferenceElement(this.overlayDiv).lineHeight


    let shader = this.grapher.lineShader

    gl.useProgram(shader.shaderProgram)
    gl.uniformMatrix4fv(shader.uniformLocations.projectionMatrix, false, PM)
    gl.uniform2fv(shader.uniformLocations.colorMapYRange, [0.0, 1.0])
    gl.uniform1f(shader.uniformLocations.markerScale, 1.0)
    gl.uniform1f(shader.uniformLocations.pixelScale, window.devicePixelRatio || 1.0)
    // gl.uniform1f(shader.uniformLocations.pixelScale, 999.0)

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.grapher.whiteTexture)
    gl.uniform1i(shader.uniformLocations.colorMapSampler, 0)

    this.bindTickGlBuffers(gl, shader)


    // console.log("will attempt to draw indices", this.NUM_INDICES_PER_LABEL*this.ticks.minorTicks.length)

    // draw MINOR ticks
    {
      // assume that outer coord space is CSS (0,0) at top-left
      // but graph is GL (0,0) at bottom left
      let xscale = 1.0/this.secondsPerPixelScale
      let yscale = lineHeight*0.25
      let xshift = 0.5*pxWidth
      let yshift = pxHeight + lineHeight*0.125
      // let yshift = this.overlayDiv.offsetHeight

      const MV = [
        xscale,       0, 0, 0,
             0, -yscale, 0, 0,
             0,       0, 1, 0,
        xshift,  yshift, 0, 1
      ]
      gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
    }

    gl.drawElements(gl.TRIANGLES, this.NUM_INDICES_PER_TICK*this.ticks.minorTicks.length, gl.UNSIGNED_INT, (0)*Uint32Array.BYTES_PER_ELEMENT)

    // draw MAJOR ticks, first grid lines then ticks
    {
      // assume that outer coord space is CSS (0,0) at top-left
      // but graph is GL (0,0) at bottom left
      let xscale = 1.0/this.secondsPerPixelScale
      let yscale = plotBounds.y.max - axisBounds.y.max
      let xshift = 0.5*pxWidth
      let yshift = plotBounds.y.max
      // let yshift = this.overlayDiv.offsetHeight

      const MV = [
        xscale,       0, 0, 0,
             0, -yscale, 0, 0,
             0,       0, 1, 0,
        xshift,  yshift, 0, 1
      ]

      gl.vertexAttrib4f(shader.attribLocations.fillColor, 0.0, 0.0, 0.0, 0.18)
      gl.vertexAttrib4f(shader.attribLocations.strokeColor, 0.0, 0.0, 0.0, 0.18)
      gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
      gl.uniform1f(shader.uniformLocations.markerScale, 1.0)
      gl.drawElements(gl.TRIANGLES, this.NUM_INDICES_PER_TICK*this.ticks.majorTicks.length, gl.UNSIGNED_INT, (this.NUM_INDICES_PER_LABEL*this.ticks.minorTicks.length)*Uint32Array.BYTES_PER_ELEMENT)
    }
    {
      // assume that outer coord space is CSS (0,0) at top-left
      // but graph is GL (0,0) at bottom left
      let xscale = 1.0/this.secondsPerPixelScale
      let yscale = lineHeight*0.5
      let xshift = 0.5*pxWidth
      let yshift = pxHeight + lineHeight*0.25
      // let yshift = this.overlayDiv.offsetHeight

      const MV = [
        xscale,       0, 0, 0,
             0, -yscale, 0, 0,
             0,       0, 1, 0,
        xshift,  yshift, 0, 1
      ]
      gl.vertexAttrib4f(shader.attribLocations.fillColor, 0.0, 0.0, 0.0, 1.0)
      gl.vertexAttrib4f(shader.attribLocations.strokeColor, 0.0, 0.0, 0.0, 1.0)
      gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
      gl.uniform1f(shader.uniformLocations.markerScale, 1.0)
      gl.drawElements(gl.TRIANGLES, this.NUM_INDICES_PER_TICK*this.ticks.majorTicks.length, gl.UNSIGNED_INT, (this.NUM_INDICES_PER_LABEL*this.ticks.minorTicks.length)*Uint32Array.BYTES_PER_ELEMENT)
    }
    // draw COARSE ticks
    if (this.ticks.coarseTicks.length) {
      // assume that outer coord space is CSS (0,0) at top-left
      // but graph is GL (0,0) at bottom left
      let xscale = 1.0/this.secondsPerPixelScale
      let yscale = pxHeight
      let xshift = 0.5*pxWidth
      let yshift = pxHeight
      // let yshift = this.overlayDiv.offsetHeight

      const MV = [
        xscale,       0, 0, 0,
             0, -yscale, 0, 0,
             0,       0, 1, 0,
        xshift,  yshift, 0, 1
      ]
      gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
      gl.uniform1f(shader.uniformLocations.markerScale, 1.0)
      gl.drawElements(gl.TRIANGLES, this.NUM_INDICES_PER_TICK*this.ticks.coarseTicks.length, gl.UNSIGNED_INT, (this.NUM_INDICES_PER_LABEL*(this.ticks.minorTicks.length+this.ticks.majorTicks.length))*Uint32Array.BYTES_PER_ELEMENT)
    }
    if (this.ticks.highlightTicks.length) {
      // assume that outer coord space is CSS (0,0) at top-left
      // but graph is GL (0,0) at bottom left
      let xscale = 1.0/this.secondsPerPixelScale
      let yscale = plotBounds.y.max - axisBounds.y.max
      let xshift = 0.5*pxWidth
      let yshift = plotBounds.y.max

      const MV = [
        xscale,       0, 0, 0,
             0, -yscale, 0, 0,
             0,       0, 1, 0,
        xshift,  yshift, 0, 1
      ]

      gl.vertexAttrib4f(shader.attribLocations.fillColor, 1.0, 0.0, 0.0, 1.0)
      gl.vertexAttrib4f(shader.attribLocations.strokeColor, 1.0, 0.0, 0.0, 1.0)
      gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
      gl.uniform1f(shader.uniformLocations.markerScale, 1.0)
      gl.drawElements(gl.TRIANGLES,
        this.NUM_INDICES_PER_TICK*this.ticks.highlightTicks.length, 
        gl.UNSIGNED_INT, 
        (this.ticks.minorTicks.length + this.ticks.majorTicks.length + this.ticks.coarseTicks.length)*this.NUM_INDICES_PER_LABEL*Uint32Array.BYTES_PER_ELEMENT)
    }

  }

} // class DateAxis


/**
  The GlGrapher is a monolithic grapher in the sense that it does all drawing in a single WebGL canvas, instead of separate canvas elements. This is done o be able to display a large number of plots simultaneously, as the number of available WebGL contexts per web page is limited, and using 2D canvasses has very low performance.

  The grapher container does not have to be explicitly sized, but can be integrated in a dynamic layout, and will resize automatically. Resizing keeps timeline magnification constant.

  UI interaction is handled through transparent overlay elements so that standard CSS layout can take care of positioning the plots and axes. 

  TODO: "plot extensions" should be forced to the same width within grapher, but for now this has to be done externally if they are used
  TODO: UI event handling / gesture recognition is very rudimentary
*/
class GLGrapher extends gltools.GLCanvasBase {
  constructor(div) {
    super(div)

    this.MIN_SECONDS_PER_PIXEL_SCALE = 0.01 // 100 pixels per second
    this.MAX_SECONDS_PER_PIXEL_SCALE = (0.5/12)*(365*24*60*60) // 0.5 months per pixel

    this.dateAxisRangeListeners = []
    this.dateAxisCursorListeners = []

    this.labelTextures = new Map()


    // create overlay divs
    // the main overlay is absolutely positioned and its size must be set explicitly
    let overlayDiv = document.createElement("div")
    overlayDiv.style.width = `${div.offsetWidth}px`
    overlayDiv.style.height = `${div.offsetHeight}px`
    overlayDiv.style.position = "absolute"
    overlayDiv.style.zIndex = 1
    overlayDiv.style.overflowY = "hidden"
    overlayDiv.style.display = "flex"
    overlayDiv.style.flexDirection = "column"
    overlayDiv.style.alignItems = "stretch"
    div.appendChild(overlayDiv)

    // date axis is a row with the actual axis plus a corner element
    let dateAxisRow = document.createElement("div")
    // dateAxisRow.style.background = "rgba(127,0,0,0.2)"
    dateAxisRow.style.padding = "0px"
    dateAxisRow.style.margin = "0px"
    dateAxisRow.style.boxSizing = "border-box"
    dateAxisRow.style.borderBottom = "1px solid black"
    dateAxisRow.style.display = "flex"
    dateAxisRow.style.flexDirection = "row"
    dateAxisRow.style.alignItems = "stretch"
    dateAxisRow.style.flexShrink = 0
    dateAxisRow.style.flexGrow = 0
    // dateAxisRow.style.overflowX = "hidden"
    overlayDiv.appendChild(dateAxisRow)

    let dateAxisDiv = document.createElement("div")
    // dateAxisDiv.style.background = "rgba(255,0,0,0.2)"
    dateAxisDiv.style.padding = "0px"
    dateAxisDiv.style.margin = "0px"
    // dateAxisDiv.style.width = "100%"
    // dateAxisDiv.style.position = "absolute"
    dateAxisDiv.style.flexShrink = 1
    dateAxisDiv.style.flexGrow = 1
    dateAxisRow.appendChild(dateAxisDiv)

    let dateAxisCorner = document.createElement("div")
    // dateAxisCorner.style.background = "rgba(0,0,127,0.2)"
    dateAxisCorner.style.padding = "0px"
    dateAxisCorner.style.margin = "0px"
    dateAxisCorner.style.width = "4em"
    dateAxisCorner.style.boxSizing = "border-box"
    dateAxisCorner.style.borderLeft = "1px solid black"
    dateAxisCorner.style.flexShrink = 0
    dateAxisCorner.style.flexGrow = 0
    dateAxisRow.appendChild(dateAxisCorner)

    let plotsDiv = document.createElement("div")
    // plotsDiv.style.background = "rgba(0,255,0,0.2)"
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

    this.setDateAxisHeight("3em")


    this.dateAxis = new DateAxis(this, this.dateAxisDiv)
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



    this.onHighlightMouseMovedListener = event => this.onHighlightMouseMoved(event)
    this.dateAxisDiv.addEventListener("mousemove", this.onHighlightMouseMovedListener )
    this.onHighlightMouseLeftListener = event => this.onHighlightMouseLeft(event)
    this.dateAxisDiv.addEventListener("mouseleave", this.onHighlightMouseLeftListener )



    this.animationFrameHandler = (time) => {
      this.redrawRequestId = undefined
      this.glDraw()
    }

    this.updateCanvasSize()
  }

  requestRedraw() {
    if (!this.redrawRequestId) {
      this.redrawRequestId = window.requestAnimationFrame(this.animationFrameHandler)
    }
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

  addDateAxisExtensionDiv(extensionDiv) {
    this.dateAxisRowDiv.appendChild(extensionDiv)
  }

  addPlot(key, plot, labelElement, extensionElement) {

    /* 
      Plot Row Layout
      .-plot-row----------------------------------.
      | .-plot-----------. .-axis-. .-extension-. |
      | | [=iframe=====] | |      | |           | |
      | | .-label-.      | |      | |           | |
      | | |       |      | |      | |           | |
      | | '-------'      | |      | |           | |
      | |                | |      | |           | |
      | '----------------' '------' '-----------' |
      '-------------------------------------------'
    */

    let plotRow = document.createElement("div")
    // plotRow.style.background = "rgba(0,0,127,0.2)"
    plotRow.style.padding = "0px"
    plotRow.style.margin = "0px"
    plotRow.style.minWidth = "0px"
    plotRow.style.width = "auto"
    plotRow.style.height = "5em"
    plotRow.style.display = "flex"
    plotRow.style.boxSizing = "border-box"
    plotRow.style.borderBottom = "1px solid black"
    plotRow.style.flexDirection = "row"
    plotRow.style.alignItems = "stretch"
    plotRow.style.flexShrink = 0

    plotRow.addEventListener("wheel", (event) => this.onPlotMouseWheel(event))

    let plotDiv = document.createElement("div")
    // plotDiv.style.background = "rgba(0,0,255,0.2)"
    plotDiv.style.display = "flex"
    plotDiv.style.flexDirection = "column"
    plotDiv.style.alignItems = "stretch"
    plotDiv.style.padding = "0px"
    plotDiv.style.margin = "0px"
    plotDiv.style.width = "100%"
    plotDiv.style.minWidth = "0px"
    plotDiv.style.flexShrink = 2
    plotDiv.style.flexGrow = 1
    plotDiv.style.overflowX = "visible"

    // iframe to get resize notifications of plot width
    let widthIFrame = document.createElement("iframe")
    // widthIFrame.style.width = "100%"
    widthIFrame.style.height = "0px"
    widthIFrame.style.border = "none"

    plotDiv.appendChild(widthIFrame)

    plotRow.appendChild(plotDiv)

    if (labelElement) {
      plotDiv.appendChild(labelElement)
    }


    let plotAxis = document.createElement("div")
    // plotAxis.style.background = "rgba(0,0,127,0.2)"
    plotAxis.style.padding = "0px"
    plotAxis.style.margin = "0px"
    plotAxis.style.width = "4em"
    plotAxis.style.boxSizing = "border-box"
    plotAxis.style.borderLeft = "1px solid black"
    plotAxis.style.flexShrink = 0
    plotAxis.style.flexGrow = 0
    plotRow.appendChild(plotAxis)

    if (extensionElement) {
      plotRow.appendChild(extensionElement)
    }

    this.plotsDiv.appendChild(plotRow)

    let yAxis = new YAxis(this, plotAxis, plot)

    let plotInfo = {plot: plot, div: plotDiv, rowDiv: plotRow, yAxisDiv: plotAxis, yAxis: yAxis, widthIFrame: widthIFrame}
    this.plots.set(key, plotInfo)

    plotDiv.addEventListener("mousemove", event => this.onPlotHighlightMouseMoved(event, plotInfo) )
    plotDiv.addEventListener("mouseleave", event => this.onPlotHighlightMouseLeft(event, plotInfo) )
    widthIFrame.contentWindow.addEventListener("resize", () => {
      plot.setPlotRange(this.dateAxis.getTimeRangeForDiv(plotDiv))
      this.requestRedraw()
    })


    plot.isAutoRangingNegatives = true
    plot.setPlotRange(this.dateAxis.getTimeRangeForDiv(plotDiv))

    let oldCallback = plot.dataUpdatedCallback
    plot.dataUpdatedCallback = () => {oldCallback(); this.requestRedraw()}

    this.requestRedraw()
  }

  removePlot(key) {
    let plotInfo = this.plots.get(key)

    // remove plot row from DOM
    plotInfo.rowDiv.remove()

    // remove plotInfo
    this.plots.delete(key)

    this.requestRedraw()
  }

  setPlotHeight(key, height) {
    let plotInfo = this.plots.get(key)

    if (typeof height !== "string")
      height = `${height}px`

    plotInfo.rowDiv.style.height = height

    this.requestRedraw()
  }

  /**
  */
  updateCanvasSize() {
    super.updateCanvasSize()
    this.overlayDiv.style.width = `${this.div.offsetWidth}px`
    this.overlayDiv.style.height = `${this.div.offsetHeight}px`
    this.requestRedraw()
  }

  onScroll(event) {
    // window.requestAnimationFrame(this.animationFrameHandler)
    this.glDraw()
    this.gl.flush() // flush to reduce lag outside of requestAnimationFrame(), this might help with the graph lagging the label on scrolling
  }


  getDateAxisPixelBounds() {

    return {
      x: {min: this.dateAxisDiv.offsetLeft, max: this.dateAxisDiv.offsetLeft + this.dateAxisDiv.offsetWidth},
      y: {min: this.dateAxisDiv.offsetTop, max: this.dateAxisDiv.offsetTop + this.dateAxisDiv.offsetHeight}
    }
  }

  getAllPlotPixelBounds() {

    return {
      x: {min: this.plotsDiv.offsetLeft, max: this.plotsDiv.offsetLeft + this.plotsDiv.offsetWidth},
      y: {min: this.plotsDiv.offsetTop, max: this.plotsDiv.offsetTop + this.plotsDiv.offsetHeight}
    }
  }

  getYAxisPixelBounds(plotInfo) {

    return {
      x: {
        min: plotInfo.yAxisDiv.offsetLeft, 
        max: plotInfo.yAxisDiv.offsetLeft + plotInfo.yAxisDiv.offsetWidth
      },
      y: {
        min: plotInfo.yAxisDiv.offsetTop, 
        max: plotInfo.yAxisDiv.offsetTop + plotInfo.yAxisDiv.offsetHeight
      }
    }
  }

  getPlotPixelBounds(plotInfo) {
    return {
      x: {
        min: plotInfo.div.offsetLeft, 
        max: plotInfo.div.offsetLeft + plotInfo.div.offsetWidth
      },
      y: {
        min: plotInfo.div.offsetTop, 
        max: plotInfo.div.offsetTop + plotInfo.div.offsetHeight
      }
    }
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
        // gl_FragColor = vec4(1.0,0.0,1.0,1.0);
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

    this.lineShader = gltools.createLineShader(gl)
    this.markerShader = gltools.createMarkerShader(gl)

    this.whiteTexture = gltools.createWhiteTexture(gl)
  }

  addDateAxisRangeChangeListener(listener) {
    this.dateAxisRangeListeners.push(listener)
  }

  addDateAxisCursorChangeListener(listener) {
    this.dateAxisCursorListeners.push(listener)
  }


  _dateAxisRangeChanged() {
    let timeRange = this.getTimeRange()
    for (let listener of this.dateAxisRangeListeners) {
      listener(timeRange)
    }
  }
  _dateAxisCursorChanged() {
    for (let listener of this.dateAxisCursorListeners) {
      listener(this.dateAxis.highlightTime)
    }
  }

  updatePlotTimeRanges() {
    this.plots.forEach(plotInfo => plotInfo.plot.setPlotRange(this.dateAxis.getTimeRangeForDiv(plotInfo.div)))
  }

  /**
    This function takes either a start and an end time to set the timerange to, or a single time range.
  */
  setTimeRange(startTime, endTime) {
    // this is for allowing a single {min, max} instead of two params
    if ((startTime.min !== undefined) && (startTime.max !== undefined)) {
      endTime = startTime.max
      startTime = startTime.min
    }


    let dt = endTime - startTime
    let pxWidth = this.dateAxis.overlayDiv.offsetWidth


    this.dateAxis.centerTime = 0.5*(startTime + endTime)
    this.dateAxis.secondsPerPixelScale = Math.min(Math.max(dt/pxWidth, this.MIN_SECONDS_PER_PIXEL_SCALE), this.MAX_SECONDS_PER_PIXEL_SCALE)

    this._dateAxisRangeChanged()

    this.updatePlotTimeRanges()
    this.requestRedraw()
  }

  getTimeRange() {
    let timeRange = this.dateAxis.getTimeRangeForDiv(this.dateAxis.overlayDiv)
    return timeRange
  }

  getTimeCursor() {
    return undefined
  }

  zoomAtTime(factor, time = undefined) {
    if (time === undefined)
      time = this.dateAxis.centerTime

    let dt = time - this.dateAxis.centerTime

    let newScale = this.dateAxis.secondsPerPixelScale * factor

    // limit zoom factor to reasonable values
    if (newScale < this.MIN_SECONDS_PER_PIXEL_SCALE) {
      newScale = this.MIN_SECONDS_PER_PIXEL_SCALE
      factor = this.MIN_SECONDS_PER_PIXEL_SCALE/this.dateAxis.secondsPerPixelScale
    }
    else if (newScale > this.MAX_SECONDS_PER_PIXEL_SCALE) {
      newScale = this.MAX_SECONDS_PER_PIXEL_SCALE
      factor = this.MAX_SECONDS_PER_PIXEL_SCALE/this.dateAxis.secondsPerPixelScale
    }

    this.dateAxis.centerTime = time - dt*factor
    this.dateAxis.secondsPerPixelScale *= factor

    this._dateAxisRangeChanged()

  }

  onPlotMouseWheel(event) {
    // scrolling on plots is only allowed horizontally
    let dx = event.deltaX
    let dy = event.deltaY

    // do either vertical or horizontal scroll, not both at once to avoid weirdness
    if (Math.abs(dy) < Math.abs(dx)) {
      // horizontal scroll
      this.dateAxis.centerTime += dx*this.dateAxis.secondsPerPixelScale

      this._dateAxisRangeChanged()

      event.preventDefault()
      event.stopPropagation()

      this.updatePlotTimeRanges()

      this.requestRedraw()
    }
  }

  onMouseWheel(event) {
    // console.log("mouse wheel", event)
    let dx = event.deltaX
    let dy = event.deltaY
    let loc = {x: event.offsetX, y: event.offsetY}


    // console.log(dx,dy)

    // do either vertical or horizontal scroll, not both at once to avoid weirdness
    if (Math.abs(dy) > Math.abs(dx)) {
      // vertical scroll
      let pxWidth = this.dateAxis.overlayDiv.offsetWidth
      let mouseTime = (loc.x - this.dateAxis.overlayDiv.offsetLeft - 0.5*pxWidth)*this.dateAxis.secondsPerPixelScale + this.dateAxis.centerTime

      this.zoomAtTime(Math.pow(1.01,dy), mouseTime)
      // this.dateAxis.secondsPerPixelScale *= Math.pow(1.01,dy)
    }
    else {
      // horizontal scroll
      this.dateAxis.centerTime += dx*this.dateAxis.secondsPerPixelScale

      this._dateAxisRangeChanged()

    }
    event.preventDefault()
    event.stopPropagation()

    this.updatePlotTimeRanges()

    this.requestRedraw()

  }


  onMouseDown(event) {
    event.preventDefault()
    // console.log("mouse down", event)
    let loc = {x: event.screenX, y: event.screenY}
    this.mouseDownLocation = loc
    this.mouseLastLocation = loc
    document.addEventListener("mouseup", this.onMouseUpListener)
    document.addEventListener("mousemove", this.onMouseDraggedListener)
  }

  onMouseDragged(event) {
    event.preventDefault()
    let loc = {x: event.screenX, y: event.screenY}
    let delta = {x: loc.x - this.mouseLastLocation.x, y: loc.y - this.mouseLastLocation.y}

    this.mouseLastLocation = loc


    this.dateAxis.centerTime -= delta.x*this.dateAxis.secondsPerPixelScale

    this.updatePlotTimeRanges()
    this._dateAxisRangeChanged()

    this.requestRedraw()


    // console.log("mouse draggered", event)
  }

  onHighlightMouseMoved(event) {
    // suppress mouse moved on date axis during a drag
    if (this.mouseDownLocation !== undefined)
      return

    // event.preventDefault()
    let loc = {x: event.offsetX, y: event.offsetY}

    let pxWidth = this.dateAxis.overlayDiv.offsetWidth
    let mouseTime = (loc.x - this.dateAxis.overlayDiv.offsetLeft - 0.5*pxWidth)*this.dateAxis.secondsPerPixelScale + this.dateAxis.centerTime

    this.dateAxis.highlightValueAtTime(mouseTime)
    this.plots.forEach(plotInfo => plotInfo.yAxis.highlightValueAtTime(mouseTime))

    this._dateAxisCursorChanged()

    this.requestRedraw()

    // console.log("mouse moved 4 highlighting", loc, mouseTime)
  }


  onHighlightMouseLeft(event) {

    this.plots.forEach(plotInfo => plotInfo.yAxis.highlightValueAtTime(undefined))

    // this._dateAxisChanged()

    this.requestRedraw()

    // console.log("mouse exited 4 highlighting")
  }

  onPlotHighlightMouseMoved(event, plotInfo) {
    // event.preventDefault()
    let loc = {x: event.offsetX, y: event.offsetY}

    let pxWidth = this.dateAxis.overlayDiv.offsetWidth
    let mouseTime = (loc.x - this.dateAxis.overlayDiv.offsetLeft - 0.5*pxWidth)*this.dateAxis.secondsPerPixelScale + this.dateAxis.centerTime

    this.plots.forEach(plotInfo => plotInfo.yAxis.highlightValueAtTime(undefined))

    this.dateAxis.highlightValueAtTime(mouseTime)
    
    plotInfo.yAxis.highlightValueAtTime(mouseTime)

    this._dateAxisCursorChanged()

    this.requestRedraw()

    // console.log("mouse moved 4 highlighting", loc, mouseTime)
  }


  onPlotHighlightMouseLeft(event, plotInfo) {

    plotInfo.yAxis.highlightValueAtTime(undefined)
    this.dateAxis.highlightValueAtTime(undefined)

    this._dateAxisCursorChanged()

    this.requestRedraw()

    // console.log("mouse exited 4 highlighting")
  }

  onMouseUp(event) {
    event.preventDefault()
    // console.log("mouse up", event)
    this.mouseDownLocation = undefined
    document.removeEventListener("mouseup", this.onMouseUpListener)
    document.removeEventListener("mousemove", this.onMouseDraggedListener)
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
    // gl.enable(gl.SCISSOR_TEST)
    gl.scissor(
      this.dateAxisDiv.offsetLeft*pixelScale,
      this.canvas.height - dateAxisBottom*pixelScale,
      this.dateAxisDiv.offsetWidth*pixelScale,
      this.dateAxisDiv.offsetHeight*pixelScale
    )
    this.dateAxis.glDrawAxisPrePlot(gl, datePM, this.getDateAxisPixelBounds(), this.getAllPlotPixelBounds())
    this.dateAxis.glDrawAxisPostPlot(gl, datePM, this.getDateAxisPixelBounds(), this.getAllPlotPixelBounds())

    // draw Y-Axes
    for (let [key, plotInfo] of this.plots) {
      if (!plotInfo.yAxis)
        continue

      // axis MV based on the row div, so that we can draw grids reaching into the graph
      let axisDiv = plotInfo.rowDiv
      // let plotRowDiv = plotInfo.rowDiv

      let plotTop = axisDiv.offsetTop - this.plotsDiv.scrollTop

      let axisShift = {
        x: -1.0 + (axisDiv.offsetLeft - this.plotsDiv.scrollLeft)*xscale,
        y: 1.0 - (plotTop)*yscale
      }
      const axisPM = [
             xscale,           0, 0, 0,
                  0,     -yscale, 0, 0,
                  0,           0, 1, 0,
        axisShift.x, axisShift.y, 0, 1
      ]

      let plotBounds  = this.getPlotPixelBounds(plotInfo)
      let yAxisBounds = this.getYAxisPixelBounds(plotInfo)

      let plotHeight = plotBounds.y.max - plotBounds.y.min

      let sLeft = plotBounds.x.min
      let sBottom = this.div.offsetHeight - plotTop - plotHeight
      let sWidth = (yAxisBounds.x.max - plotBounds.x.min)
      let topOffset = Math.max(dateAxisBottom, plotTop)
      let sTop = this.div.offsetHeight - topOffset
      let sHeight = Math.max(0.0, sTop - sBottom)

      gl.scissor(
        sLeft*pixelScale,
        sBottom*pixelScale,
        sWidth*pixelScale,
        sHeight*pixelScale
      )
      gl.enable(gl.SCISSOR_TEST)
    // gl.disable(gl.SCISSOR_TEST)

      plotInfo.yAxis.glDrawAxisPrePlot(gl, axisPM, yAxisBounds, plotBounds)
    }


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
      gl.enable(gl.SCISSOR_TEST)
      gl.scissor(
        plotScissorX*pixelScale,
        this.canvas.height - (plotScissorY)*pixelScale,
        plotDiv.offsetWidth*pixelScale,
        Math.max(0.0, Math.min(plotDiv.offsetHeight, plotScissorY - dateAxisBottom))*pixelScale
      )

      plotInfo.plot.glDraw(gl, offset, plotPM)
    }

    // draw Y-Axes
    for (let [key, plotInfo] of this.plots) {
      if (!plotInfo.yAxis)
        continue

      // axis MV based on the row div, so that we can draw grids reaching into the graph
      let axisDiv = plotInfo.rowDiv
      // let plotRowDiv = plotInfo.rowDiv

      let plotTop = axisDiv.offsetTop - this.plotsDiv.scrollTop

      let axisShift = {
        x: -1.0 + (axisDiv.offsetLeft - this.plotsDiv.scrollLeft)*xscale,
        y: 1.0 - (plotTop)*yscale
      }
      const axisPM = [
             xscale,           0, 0, 0,
                  0,     -yscale, 0, 0,
                  0,           0, 1, 0,
        axisShift.x, axisShift.y, 0, 1
      ]

      let plotBounds  = this.getPlotPixelBounds(plotInfo)
      let yAxisBounds = this.getYAxisPixelBounds(plotInfo)

      let plotHeight = plotBounds.y.max - plotBounds.y.min

      let sLeft = plotBounds.x.min
      let sBottom = this.div.offsetHeight - plotTop - plotHeight
      let sWidth = (yAxisBounds.x.max - plotBounds.x.min)
      let topOffset = Math.max(dateAxisBottom, plotTop)
      let sTop = this.div.offsetHeight - topOffset
      let sHeight = Math.max(0.0, sTop - sBottom)

      gl.scissor(
        sLeft*pixelScale,
        sBottom*pixelScale,
        sWidth*pixelScale,
        sHeight*pixelScale
      )
      gl.enable(gl.SCISSOR_TEST)
    // gl.disable(gl.SCISSOR_TEST)

      plotInfo.yAxis.glDrawAxisPostPlot(gl, axisPM, yAxisBounds, plotBounds)
    }

    gl.disable(gl.SCISSOR_TEST)

    // manage label texture cache
    let maxCachedLabels = 50 + this.plots.size*50
    if (this.labelTextures.size > maxCachedLabels) {
      // delete half of the textures, oldest first
      let labelKeys = Array.from(this.labelTextures.keys())
      let oldKeys = labelKeys.slice(0, maxCachedLabels/2)
      let keepKeys = labelKeys.slice(maxCachedLabels/2)

      for (let key of oldKeys) {
        gl.deleteTexture(this.labelTextures.get(key).texture)
      }

      this.labelTextures = new Map(keepKeys.map(key => [key, this.labelTextures.get(key)]))

    }

  } // glDraw()

} // class GlGrapher
