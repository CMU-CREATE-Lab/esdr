

import * as gltools from "./webgltools.js"

export {GLGrapher}

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
class DateAxis {
	constructor(grapher, overlayDiv) {
		this.grapher = grapher
    this.overlayDiv = overlayDiv

    this.NUM_POSITION_ELEMENTS    = 2
    this.NUM_TEXCOORD_ELEMENTS    = 2
    this.NUM_FILLCOLOR_ELEMENTS   = 4

    this.NUM_VERTICES_PER_LABEL = 4
    this.NUM_INDICES_PER_LABEL  = 6

    this.NUM_VERTICES_PER_TICK = 4
    this.NUM_INDICES_PER_TICK  = 6

    this.MAX_NUM_TICKS = 100
    this.MAX_NUM_LABELS	= 100
    this.MIN_PIXELS_PER_TICK  = 10.0
    this.BOXED_LABEL_MARGIN_PX  = 10.0
    this.MIN_PINNED_LABEL_SPACING_PCT  = 100.0

    this.glBuffers = {}
    this.labels = []

    this.secondsPerPixelScale = 1.0
    this.labelTextures = new Map()
    this.centerTime = Date.now() / 1000.0


    this.shortFineFormats = {
      second: Intl.DateTimeFormat([], {hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit"}),
      minute: Intl.DateTimeFormat([], {hour12: false, hour: "2-digit", minute: "2-digit"}),
      hour:   Intl.DateTimeFormat([], {hour12: false, hour: "2-digit", minute: "2-digit"}),
      day:    Intl.DateTimeFormat([], {day: "2-digit"}),
      week:   Intl.DateTimeFormat([], {day: "2-digit"}),
      month:  Intl.DateTimeFormat([], {month: "2-digit"}),
      year:   Intl.DateTimeFormat([], {year: "2-digit"}),
      decade: Intl.DateTimeFormat([], {year: "numeric"}),
      century: Intl.DateTimeFormat([], {year: "numeric"}),
      millenium: Intl.DateTimeFormat([], {year: "numeric"}),
    }

    this.shortCoarseFormats = {
      day:    Intl.DateTimeFormat([], {year: "numeric", month: "2-digit", day: "2-digit"}),
      week:   Intl.DateTimeFormat([], {year: "numeric", month: "2-digit", day: "2-digit"}),
      month:  Intl.DateTimeFormat([], {year: "numeric", month: "2-digit"}),
      year:   Intl.DateTimeFormat([], {year: "numeric"}),
      decade: Intl.DateTimeFormat([], {year: "numeric"}),
      century: Intl.DateTimeFormat([], {year: "numeric"}),
      millenium: Intl.DateTimeFormat([], {year: "numeric"}),
    }

	}

  getMaxNumLabelVertices() {
    return this.MAX_NUM_LABELS*this.NUM_VERTICES_PER_LABEL
  }

  getMaxNumLabelIndices() {
    return this.MAX_NUM_LABELS*this.NUM_INDICES_PER_LABEL
  }

  getMaxNumTickVertices() {
    return this.MAX_NUM_TICKS*this.NUM_VERTICES_PER_TICK
  }

  getMaxNumTickIndices() {
    return this.MAX_NUM_TICKS*this.NUM_INDICES_PER_TICK
  }

  getMaxNumVertices() {
    return this.getMaxNumLabelVertices() + this.getMaxNumTickVertices()
  }

  getMaxNumIndices() {
    return this.getMaxNumLabelIndices() + this.getMaxNumTickIndices()
  }

  getLabelVertexOffset() {
    return 0
  }

  getLabelIndexOffset() {
    return 0
  }

  getTickVertexOffset() {
    return 0
  }

  getTickIndexOffset() {
    return 0
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
    let grapherBounds = this.grapher.getDateAxisPixelBounds()

    this._updateGlBuffers(gl, grapherBounds)

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

    let baseSize = this.getMaxNumVertices()

    buffers.positionBuffer = gltools.resizeArrayBuffer(gl, buffers.positionBuffer, baseSize, this.NUM_POSITION_ELEMENTS)

    buffers.texCoordBuffer = gltools.resizeArrayBuffer(gl, buffers.texCoordBuffer, baseSize, this.NUM_TEXCOORD_ELEMENTS)

    buffers.fillColorBuffer = gltools.resizeArrayBuffer(gl, buffers.fillColorBuffer, baseSize, this.NUM_FILLCOLOR_ELEMENTS)

    buffers.indexBuffer = gltools.resizeElementArrayBuffer(gl, buffers.indexBuffer, this.getMaxNumIndices())

  }


  bindGlBuffers(gl, shader) {
    let buffers = this.glBuffers

    gltools.bindArrayBuffer(gl, buffers.positionBuffer, shader.attribLocations.vertexPos, this.NUM_POSITION_ELEMENTS)

    gltools.bindArrayBuffer(gl, buffers.texCoordBuffer, shader.attribLocations.texCoord, this.NUM_TEXCOORD_ELEMENTS)

    gltools.bindArrayBuffer(gl, buffers.fillColorBuffer, shader.attribLocations.color, this.NUM_FILLCOLOR_ELEMENTS)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)

  }


  _updateGlBuffers(gl, pixelRange) {
    this._updateLabelGlBuffers(gl, pixelRange)
  }

  /**
    @param {number} k - total label counter
  */
  _createLabelsFor(gl, ticks, tickUnit, isBoxed, formats, pixelRange, timeRange, yCenterFrac, k) {

    let labels = []

    let axisHeight = pixelRange.y.max - pixelRange.y.min
    let labelVertexOffset = this.getLabelVertexOffset()

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


      let space = isBoxed ? (ticks[i+1] - t)/this.secondsPerPixelScale - 2.0*this.BOXED_LABEL_MARGIN_PX : pixelRange.x.max - pixelRange.x.min

      let format = formats[tickUnit]

      let labelString = format.format(t*1000.0)
      // console.log(labelString)
      // get cached texture or create it
      let labelTexture = this.labelTextures.get(labelString) 

      if (!labelTexture) {
        labelTexture = gltools.createTextTexture(gl, labelString, this.grapher.div)
        this.labelTextures.set(labelString, labelTexture)
      }

      let h = labelTexture.height/labelTexture.scale
      let w = labelTexture.width/labelTexture.scale

      // don't draw label if it'd overflow its space
      if (space < w)
        continue

      let xOffset = isBoxed ? 0.5*(ticks[i+1] - t)/this.secondsPerPixelScale : 0
      let yOffset = pixelRange.y.min + yCenterFrac*axisHeight - (labelTexture.middle/labelTexture.scale - 0.0*labelTexture.fontSize)
      // let yOffset = 0.5*axisHeight

      let timeCoord = (t - timeRange.min)/this.secondsPerPixelScale

      let positions = [
        [0 + timeCoord + xOffset - 0.5*w, yOffset - 0],
        [0 + timeCoord + xOffset - 0.5*w, yOffset + h],
        [w + timeCoord + xOffset - 0.5*w, yOffset + 0],
        [w + timeCoord + xOffset - 0.5*w, yOffset + h],
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
     
      let indices = [ 0,1,2, 2,1,3].map(x => x + this.NUM_VERTICES_PER_LABEL*k + labelVertexOffset)

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

  _updateLabelGlBuffers(gl, pixelRange) {
    // for now, just draw a labels to fill the x axis
    let buffers = this.glBuffers

    let axisHeight = pixelRange.y.max - pixelRange.y.min


    let timeRange = this.getTimeRangeForWidth(pixelRange.x.max - pixelRange.x.min)

    let ticks = this.getTicksForTimeRange(timeRange, pixelRange.x.max - pixelRange.x.min)



    let timestamp = timeRange.min

    // compute offsets because buffer objects are shared among ticks and label
    let labelVertexOffset = this.getLabelVertexOffset()
    let labelIndexOffset = this.getLabelIndexOffset()

    let labels = this._createLabelsFor(gl, ticks.majorTicks, ticks.majorUnit, ticks.fineLabelBoxed, this.shortFineFormats, pixelRange, timeRange, 0.75, 0)


    labels = labels.concat(this._createLabelsFor(gl, ticks.coarseTicks, ticks.coarseUnit, ticks.coarseLabelBoxed, this.shortCoarseFormats, pixelRange, timeRange, 0.25, labels.length))


    {
      // update gl buffers with computed vertices
      let positions = labels.flatMap(label => label.positions)
      let texCoords = labels.flatMap(label => label.texCoords)
      let colors = labels.flatMap(label => label.colors)
      let indices = labels.flatMap(label => label.indices)

      let bufferOffset = labelVertexOffset*Float32Array.BYTES_PER_ELEMENT

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
      gl.bufferSubData(gl.ARRAY_BUFFER, bufferOffset*this.NUM_POSITION_ELEMENTS, new Float32Array(positions.flat()))

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoordBuffer)
      gl.bufferSubData(gl.ARRAY_BUFFER, bufferOffset*this.NUM_TEXCOORD_ELEMENTS, new Float32Array(texCoords.flat()))

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.fillColorBuffer)
      gl.bufferSubData(gl.ARRAY_BUFFER, bufferOffset*this.NUM_FILLCOLOR_ELEMENTS, new Float32Array(colors.flat()))

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, labelIndexOffset*Uint32Array.BYTES_PER_ELEMENT, new Uint32Array(indices.flat()))
    }

    this.labels = labels
  }

  getTimeRangeForWidth(pxWidth) {
    let pxCenter = 0.5*pxWidth
    let timeRange = {
      min: (0 - pxCenter)*this.secondsPerPixelScale + this.centerTime, 
      max: (pxWidth - pxCenter)*this.secondsPerPixelScale + this.centerTime
    }

    return timeRange
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



  computeMajorTicksFor(tickPossibilities, boxedUnits, timeRange, pxWidth) {
    /*
      the major ticks are the ones that get labels, and we must figure out if the labels provide enough space
    */
    let texter = new gltools.GLTextTexturer()
    let fontSize = gltools.computeFontSizingForReferenceElement(this.overlayDiv).fontSize


    let majorTicks = undefined
    for (let [tickCount, tickUnit] of tickPossibilities) {
      // for each tick spacing, check if we have enough space to draw labels
      let labelsFit = true
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


} // class DateAxis

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

    return {
      x: {min: this.dateAxisDiv.offsetLeft, max: this.dateAxisDiv.offsetLeft + this.dateAxisDiv.offsetWidth},
      y: {min: this.dateAxisDiv.offsetTop, max: this.dateAxisDiv.offsetTop + this.dateAxisDiv.offsetHeight}
    }
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

    // console.log(dx,dy)

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
