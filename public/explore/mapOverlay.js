
/*

# Quirks

The map overlay is positioned so that it stays fixed relative to the viewport,
	EXCEPT: dragging the map causes overlay to move, and it is only repositioned again when drag ends.

During zoom animation, the map's getZoom() function returns the TARGET zoom level, so it cannot be used,
	BUT: zoom level can be calculated from projection and map bounds.


# Transformation pipeline

One might want to use geographic lon/lat, meters, or screen space pixels.
The pipeline is
	geo -> mercator -> meter -> pixel
		geo      -> mercator contains a non-linear transform for the mercator projection
		mercator -> meter 	 is dependent on latitude
		meter    -> pixel    is dependent on the zoom factor and devicePixelRatio

*/

import {ETP} from "./embeddedTilePlotter.js"
import {ImagePeeker} from "./imagePeeker.js"
import {ESDR} from "./esdrFeeds.js"
import * as gltools from "./webgltools.js"


class MapOverlay extends google.maps.OverlayView {
	constructor(map, mapDiv) {
		super()
		this.mapDiv = mapDiv
  	this.setMap(map)
  	this.canvas = document.createElement("canvas")

  	this.deferredUpdateTimer_ = undefined
  	this.deferredUpdateContent_ = {allMarkers: true, allIndices: true}
  	this.debug_ = {}

  	// data plotting
  	this.sparkLines = new Map()
  	this.feedColorizers = new Map()
  	this.colorizedFeedColors = new Map()

  	this.anonymousAnimationFrameHandler = timestamp => this.animationFrameHandler(timestamp)

	}

	onAdd() {
		let clientBounds = this.mapDiv.getBoundingClientRect()

		// this.canvas.style.top = `${clientBounds.top}px`
		// this.canvas.style.left = `${clientBounds.left}px`
		// this.canvas.style.width = `${clientBounds.width}px`
		// this.canvas.style.height = `${clientBounds.height}px`
		// this.canvas.style.width = `100%`
		// this.canvas.style.height = `100%`
		// this.canvas.style.position = "fixed"
		this.canvas.style.display = "block"
		// this.canvas.style.zIndex = "1"

		if (!this.gl)
			this._initGl()

		const panes = this.getPanes()
		panes.overlayLayer.appendChild(this.canvas)

	}

	onRemove() {
		if (this.div) {
			this.div.parentNode.removeChild(this.div)
			delete this.div
		}
		if (this.canvas) {
			this.canvas.parentNode.removeChild(this.canvas)
			delete this.canvas
		}
	}

	requestDraw() {
		if (!this.redrawRequestId) {
			this.redrawRequestId = window.requestAnimationFrame(this.anonymousAnimationFrameHandler)
		}
	}

	animationFrameHandler(time) {
		this.redrawRequestId = undefined
		this.draw()
	}

	draw() {
    // console.log(`draw event`);
		let map = this.getMap()
		let mapBounds = map.getBounds()
		let mapCenter = map.getCenter()
		let overlayProjection = this.getProjection()
		// if we don't have a project, yet, there's nothing to draw
		if (!overlayProjection)
			return
		// let sw = overlayProjection.fromLatLngToDivPixel(this.bounds.getSouthWest())
		// let ne = overlayProjection.fromLatLngToDivPixel(this.bounds.getNorthEast())
		let sw = overlayProjection.fromLatLngToDivPixel(mapBounds.getSouthWest())
		let ne = overlayProjection.fromLatLngToDivPixel(mapBounds.getNorthEast())
		let center = overlayProjection.fromLatLngToDivPixel()

		let width = (ne.x - sw.x)
		let height = (sw.y - ne.y)

		// respect HiDPI screens
		let pixelScale = window.devicePixelRatio || 1.0

		let clientBounds = this.mapDiv.getBoundingClientRect()

		if (this.canvas)
		{
			// move canvas to always cover the viewport
			// this setup works for zooming, and doesn't "jitter", but "sticks" to the map during a drag, and the canvas is only repositioned when the drag is finished
			this.canvas.style.width = `${clientBounds.width}px`
			this.canvas.style.height = `${clientBounds.height}px`
			this.canvas.style.marginTop = `-${0.5*clientBounds.height}px`
			this.canvas.style.marginLeft = `-${0.5*clientBounds.width}px`

			// set canvas size
			this.canvas.width = clientBounds.width*pixelScale
			this.canvas.height = clientBounds.height*pixelScale

			this.createCoordinateConversionFunctions()

			// let ctx = this.canvas.getContext("2d")
			// ctx.font = '48px serif';
			// ctx.fillStyle = 'rgba(200, 0, 0, 0.2)';
			// ctx.fillRect(10.0, 10.0, clientBounds.width-20.0, clientBounds.height-20.0);

			// ctx.fillStyle = 'rgb(0, 200, 0)';
			// ctx.fillText('overlayLayer', 10, 50);

			if (!this.gl)
				this._initGl()

			this.glDraw(this.gl)
		}

	}

	// find z-index of DOM element
	getElementZIndex(e) {      
	  var z = window.getComputedStyle(e).getPropertyValue('z-index')
	  if (isNaN(z)) 
	  	return this.getElementZIndex(e.parentNode)
	  else
	 	 	return z
	}


	_initGl() {
		const gl = this.canvas.getContext("webgl")

		if (gl == null) {
			alert("Cannot initialize WebGL.")
			return
		}


		// check that element indices can be UINT32, for we would like to address more than 65k vertices at a time
		var ext = gl.getExtension('OES_element_index_uint');
		if (!ext) {
			alert("OES_element_index_uint is not supported.")
			return
		}

		// if WebGL context has been successfully setup, assign it to an ivar for later use
		this.gl = gl

		const markerVertexShader = `
			#define pi 3.1415926535897932384626433832795
			#define EARTH_RADIUS 6378137.0

	    attribute vec2 geoVertexPos;
	    attribute vec2 pxVertexOffsetDirection;
	    attribute float pxMarkerSizeIn;
	    attribute float pxStrokeWidthIn;
	    attribute vec4 fillColorIn;
	    attribute vec4 strokeColorIn;

	    uniform float zoomFactor;
	    uniform mat4 modelViewMatrix;
	    uniform mat4 projectionMatrix;

	    varying vec2 pxCenterOffset; 
	    varying float pxMarkerSize;
	    varying float pxStrokeWidth;
	    varying vec4 fillColor;
	    varying vec4 strokeColor;

	    vec2 geoToMercator(vec2 geo) {
	    	// FIXME: had to move this computation outside of shader because of precision issues on Intel integrated graphics, but it would be nice to get it back in so that all coordinate transformations happen in the shader
				// return vec2(geo.x, (180.0/pi)*log(tan(pi*0.25 + geo.y*(pi/180.0*0.5))));
				return geo;
	    }

	    vec2 mercatorToMeterScale(vec2 mercator, float latitude) {
				return mercator * cos(latitude * (pi/180.0)) * (pi/180.0*EARTH_RADIUS);
	    }

	    vec2 mercatorToPixel(vec2 mercator, float zoomFactor) {
				return mercator * zoomFactor * (256.0/360.0);
	    }

	    void main() {
	    	vec2 mercatorPos = geoToMercator(geoVertexPos);
	    	vec2 pixelPos = mercatorToPixel(mercatorPos, zoomFactor);

	    	// transform to screen-space (large offset) before applying pixel offsets
	    	// this is to avoid floating-point rounding to mess up the offset shifts
	    	// because it is adding a very large number (position) to a very small number (offset)
	    	vec2 screenSpacePos = (modelViewMatrix * vec4(pixelPos, 0.0, 1.0)).xy;


	    	// offset vertex by direction and size of marker
	    	// actual offset is 1px bigger than markerSize to leave room for AA
	    	vec2 pxOffset = pxVertexOffsetDirection*(0.5*pxMarkerSizeIn + pxStrokeWidthIn + 1.0);
	    	screenSpacePos += pxOffset;

	    	// outputs
	    	pxCenterOffset = pxOffset;
	      gl_Position = projectionMatrix * vec4(screenSpacePos, 0.0, 1.0);
	      fillColor = fillColorIn;
	      strokeColor = strokeColorIn;
	      pxMarkerSize = pxMarkerSizeIn;
	      pxStrokeWidth = pxStrokeWidthIn;
	    }
  	`

	  const markerFragmentShader = `
	  	precision mediump float;

	  	varying vec2 pxCenterOffset;
	  	varying float pxMarkerSize;
	  	varying float pxStrokeWidth;
	  	varying vec4 fillColor;
	  	varying vec4 strokeColor;

	    void main() {
	    	float r = length(pxCenterOffset);
	    	float rd = (0.5*pxMarkerSize - r);
	    	float fillCoverage = clamp(0.5 + 2.0*(rd - 0.5*pxStrokeWidth), 0.0, 1.0);
	    	vec4 fill = vec4(fillColor.rgb, fillColor.a)*fillCoverage;
	    	float strokeCoverage = clamp(0.5 - 2.0*(rd - 0.5*pxStrokeWidth), 0.0, 1.0)*clamp(0.5 + 2.0*(rd + 0.5*pxStrokeWidth), 0.0, 1.0);
	    	vec4 stroke = strokeColor*strokeCoverage;
	      gl_FragColor = fill + stroke;
	      // gl_FragColor = color;
	      // gl_FragColor = vec4(0.0,0.0,0.0,0.5);
	    }
  	`

  	this.markerShader = gltools.initShaderProgram(
  		gl, markerVertexShader, markerFragmentShader, 
  		{
  			geoVertexPos: "geoVertexPos",
  			pxVertexOffsetDirection: "pxVertexOffsetDirection",
  			pxMarkerSize: "pxMarkerSizeIn",
  			pxStrokeWidth: "pxStrokeWidthIn",
  			fillColor: "fillColorIn",
  			strokeColor: "strokeColorIn",
  		},
  		{
  			zoomFactor: "zoomFactor",
  			modelViewMatrix: "modelViewMatrix",
  			projectionMatrix: "projectionMatrix",
  		},
  	)


		const vertexShader = `
	    attribute vec2 vertexPos;
	    attribute vec4 colorIn;

	    uniform mat4 modelViewMatrix;
	    uniform mat4 projectionMatrix;

	    varying vec4 color;

	    void main() {
	      gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPos, 0.0, 1.0);
	      color = colorIn;
	    }
  	`
	  const fragmentShader = `
	  	precision mediump float;

	  	varying vec4 color;

	    void main() {
	      gl_FragColor = color;
	    }
  	`

  	this.simpleShader = gltools.initShaderProgram(
  		gl, markerVertexShader, markerFragmentShader, 
  		{
  			vertexPos: "vertexPos",
  			color: "colorIn",
  		},
  		{
  			modelViewMatrix: "modelViewMatrix",
  			projectionMatrix: "projectionMatrix",
  		},
  	)

	}

	createQuadIndices(count) {
		let indices = []
		for (let i = 0; i < count; i++)
		{
			indices.push(4*i + 0, 4*i + 1, 4*i + 2)
			indices.push(4*i + 2, 4*i + 3, 4*i + 0)
		}
		return indices
	}

	splatArrayForQuad(src) {
		let dst = src.flatMap(e => {
			let array = new Array(4)
			return array.fill(e, 0, 4)
		})

		// for (let i = 0; i < src.length/numComponents; i++)
		// {
		// 	let k = i*numComponents
		// 	let element = src.slice(k, k+numComponents)
		// 	dst.push(...element, ...element, ...element, ...element)
		// }

		return dst
	}

	repeatArray(src, count) {
		let array = new Array(count)
		return array.fill(src, 0, count)
		// for (let i = 0; i < count; i++)
		// {
		// 	dst.push(...src)
		// }
		// return dst
	}

	_checkBufferLengths() {
		if (!this.debug_)
			return

			console.assert(this.debug_.vertexBufferLength && (this.debug_.vertexBufferLength > this.debug_.maxElementIndex))
			console.assert(this.debug_.fillColorBufferLength && (this.debug_.fillColorBufferLength > this.debug_.maxElementIndex))
			console.assert(this.debug_.strokeColorBufferLength && (this.debug_.strokeColorBufferLength > this.debug_.maxElementIndex))
			console.assert(this.markers.feeds.length == this.debug_.indexBufferLength)
	}

	_updateMarkerBuffers(gl) {
		let markers = this.markers
		if (!markers || !markers.feeds || (markers.feeds.length <= 0))
			return

		// FIXME: this function transforms geographic points to a mercator projection, as Intel GPUs seem to have a precision issue with the used log/tan functions, so the non-linear transformation had to be moved outside the shader
		function geo2merc(geo) {
			return [geo[0], (180.0/Math.PI)*Math.log(Math.tan(Math.PI*0.25 + geo[1]*(Math.PI/180.0*0.5)))]
		}

		let vertices = this.splatArrayForQuad(markers.positions.map(pos => geo2merc(pos)))

		let offsets = this.repeatArray([
			-1.0, 1.0,
			-1.0,-1.0,
			 1.0,-1.0,
			 1.0, 1.0,
		], markers.feeds.length)

		let sizes = this.splatArrayForQuad(markers.markerSizes)
		let strokeWidths = this.splatArrayForQuad(markers.strokeWidths)

		// upload data to GL buffers
		this.markerShader.vertexBuffer = gltools.resizeArrayBuffer(gl, this.markerShader.vertexBuffer, vertices.length*4,2)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices.flat()), gl.STATIC_DRAW)

		this.markerShader.offsetBuffer = gltools.resizeArrayBuffer(gl, this.markerShader.offsetBuffer, offsets.length*4,2)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(offsets.flat()), gl.STATIC_DRAW)

		this.markerShader.sizeBuffer = gltools.resizeArrayBuffer(gl, this.markerShader.sizeBuffer, sizes.length*4,1)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes.flat()), gl.STATIC_DRAW)

		this.markerShader.strokeWidthBuffer = gltools.resizeArrayBuffer(gl, this.markerShader.strokeWidthBuffer, strokeWidths.length*4,1)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(strokeWidths.flat()), gl.STATIC_DRAW)

		this._updateIndexBuffer(gl)
		this._updateMarkerColorBuffers(gl)

		if (this.debug_)
			this.debug_.vertexBufferLength = vertices.length

		this._checkBufferLengths()
	}

	_updateMarkerColorBuffers(gl, changedFeedIndices) {
		let markers = this.markers
		if (!markers || !markers.feeds)
			return

		// do a sub buffer update for changes with less than 1000 markers changed
		// exact number can be tuned for performance, 1000 is just a guess
		if (!changedFeedIndices || (changedFeedIndices.length > 1000)) {
			let fillColors = this.splatArrayForQuad(markers.fillColors)

			let strokeColors = this.splatArrayForQuad(markers.strokeColors)

			this.markerShader.fillColorBuffer = gltools.resizeArrayBuffer(gl, this.markerShader.fillColorBuffer, fillColors.length, 4)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fillColors.flat()), gl.DYNAMIC_DRAW)

			this.markerShader.strokeColorBuffer = gltools.resizeArrayBuffer(gl, this.markerShader.strokeColorBuffer, strokeColors.length, 4)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(strokeColors.flat()), gl.DYNAMIC_DRAW)

			if (this.debug_) {
				this.debug_.fillColorBufferLength = fillColors.length
				this.debug_.strokeColorBufferLength = strokeColors.length
			}

		}
		else
		{
			gl.bindBuffer(gl.ARRAY_BUFFER, this.markerShader.fillColorBuffer)
			for (let i of changedFeedIndices) {
				let colors = this.splatArrayForQuad(markers.fillColors.slice(i,i+1)).flat()
				let fcolors = new Float32Array(colors)

				gl.bufferSubData(gl.ARRAY_BUFFER, i*4*4*Float32Array.BYTES_PER_ELEMENT, fcolors)

			}
			gl.bindBuffer(gl.ARRAY_BUFFER, this.markerShader.strokeColorBuffer)
			for (let i of changedFeedIndices) {
				let colors = this.splatArrayForQuad(markers.strokeColors.slice(i,i+1)).flat()

				gl.bufferSubData(gl.ARRAY_BUFFER, i*4*4*Float32Array.BYTES_PER_ELEMENT, new Float32Array(colors))

			}
		}
	}

	_updateIndexBuffer(gl) {
		if (!this.markers)
			return

		// indices determine draw order
		// and filtered feeds should be after before rejected feeds to come out on top

		let rejectedFeeds = this.markers.rejectedFeeds
		let filteredFeeds = Array.from(this.markers.sortedFeeds.index.keys()).filter(feedId => !rejectedFeeds.has(feedId))

		let indicesForQuad = function(i) {
			return [4*i + 0, 4*i + 1, 4*i + 2, 4*i + 2, 4*i + 3, 4*i + 0]
		}


		let indices = Array.from(rejectedFeeds).concat(filteredFeeds).map(feedId => {
			let i = this.markers.sortedFeeds.index.get(feedId)
			return indicesForQuad(i)
		})

		console.assert(this.markers.feeds.length == indices.length)

		if (this.debug_) {
			this.debug_.maxElementIndex = indices.flat().reduce((acc, val) => Math.max(acc, val), 0)
			this.debug_.indexBufferLength = indices.length
		}

		// console.assert(indices.length == (filteredFeeds.length + Array.from(rejectedFeeds).length))

		// upload data to GL buffers
		const indexBuffer = this.markerShader.indexBuffer || gl.createBuffer()
		this.markerShader.indexBuffer = indexBuffer
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices.flat()), gl.DYNAMIC_DRAW)

	}

	_getFeedIndexFromFeedId(feedId) {
		return this.markers.sortedFeeds.index.get(feedId)
	}

	_deferredGlUpdateCallback(mapOverlay, gl) {
		if (gl && mapOverlay.markers && (mapOverlay.markers.feeds.length > 0)) {
			mapOverlay.glBuffersDirty = false
			let update = mapOverlay.deferredUpdateContent_
			let wasUpdated = false
			if (update.allMarkers)
			{
				mapOverlay._updateMarkerBuffers(gl)
				wasUpdated = true
			}
			else
			{
				if (update.allIndices) {
					mapOverlay._updateIndexBuffer(gl)
					wasUpdated = true
				}

				if (update.feedColors) {
					let feedIndices = update.feedColors.map(feedId => mapOverlay.markers.sortedFeeds.index.get(feedId))
					mapOverlay._updateMarkerColorBuffers(gl, feedIndices)
					wasUpdated = true
				}
			}

			mapOverlay._checkBufferLengths()

			if (wasUpdated)
				mapOverlay.glDraw(gl)

		}

		// clear timer and content
		mapOverlay.deferredUpdateTimer_ = undefined
		mapOverlay.deferredUpdateContent_ = {}
	}

	_doDeferredGlUpdate(updateContent, isImmediate) {
		// the updates affect the marker states
		// allMarkers and allIndices are bools that are ORed
		// feedColors are lists that are combined

		if (updateContent.feedColors && this.deferredUpdateContent_.feedColors) {
			this.deferredUpdateContent_.feedColors = this.deferredUpdateContent_.feedColors.concat(updateContent.feedColors)
		}
		else if (updateContent.feedColors) {
			this.deferredUpdateContent_.feedColors = updateContent.feedColors
		}

		this.deferredUpdateContent_.allMarkers = this.deferredUpdateContent_.allMarkers || updateContent.allMarkers
		this.deferredUpdateContent_.allIndices = this.deferredUpdateContent_.allIndices || updateContent.allIndices

		// this.deferredUpdateContent_ = Object.assign(this.deferredUpdateContent_, updateContent)

		// re-trigger timer ...
		let timer = this.deferredUpdateTimer_
		// if timer is pending, cancel it
		if (timer)
			clearTimeout(timer)

		if (!isImmediate) {
			// new timeout 300ms from now
			timer = setTimeout(this._deferredGlUpdateCallback, 300, this, this.gl)

			this.deferredUpdateTimer_ = timer

		}
		else
		{
			// do immediate update from UI triggered changes
			this._deferredGlUpdateCallback(this, this.gl)
			this.deferredUpdateTimer_ = undefined
		}

	}

	glDrawMarkers(gl) {

		if (!this.markers || !this.markers.feeds)
			return


		let pixelScale = window.devicePixelRatio || 1.0

		// the scale is simple enough, but we also need to shift the center
		// (0,0) in pixel coords should be at the bottom left of the screen
		let xshift = this.longitudeToGlobalPixel(this.mapSouthWest.lng(), this.zoomFactor)
		let yshift = this.latitudeToGlobalPixel(this.mapSouthWest.lat(), this.zoomFactor)
		// during drag/zoom gotta add these shift values for things to line up right due to CSS voodoo
		xshift -= 0.5*this.canvas.width/pixelScale + this.pixSouthWest.x
		yshift -= 0.5*this.canvas.height/pixelScale - this.pixSouthWest.y

		// console.log(`swlon ${this.mapSouthWest.lng()} swlat ${this.mapSouthWest.lat()}`)
		// console.log(`xshift ${xshift} yshift ${yshift} zf ${this.zoomFactor}`)
		let xscale = 2.0/this.canvas.width*pixelScale
		let yscale = 2.0/this.canvas.height*pixelScale
		const MV = [
			      1,       0, 0, 0,
			      0,       1, 0, 0,
						0,       0, 1, 0,
			-xshift, -yshift, 0, 1
		]
		const PM = [
			xscale, 		  0, 0, 0,
			     0,  yscale, 0, 0,
					 0, 		  0, 1, 0,
			  -1.0, 	 -1.0, 0, 1
		]


		// premuliplied alpha blend
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		// for non-premul alpha blending
		// gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.BLEND)
		gl.disable(gl.DEPTH_TEST)
		let shader = this.markerShader
		gl.useProgram(shader.shaderProgram)
		gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
		gl.uniformMatrix4fv(shader.uniformLocations.projectionMatrix, false, PM)
		gl.uniform1f(shader.uniformLocations.zoomFactor, this.zoomFactor)

		// if index buffer hasn't been set, yet, can't draw
		if (!shader.indexBuffer)
			return

		this._checkBufferLengths()

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shader.indexBuffer)

		gltools.bindArrayBuffer(gl, shader.vertexBuffer, shader.attribLocations.geoVertexPos, 2)

		gltools.bindArrayBuffer(gl, shader.fillColorBuffer, shader.attribLocations.fillColor, 4)

		gltools.bindArrayBuffer(gl, shader.strokeColorBuffer, shader.attribLocations.strokeColor, 4)

		gltools.bindArrayBuffer(gl, shader.offsetBuffer, shader.attribLocations.pxVertexOffsetDirection, 2)

		gltools.bindArrayBuffer(gl, shader.sizeBuffer, shader.attribLocations.pxMarkerSize, 1)

		gltools.bindArrayBuffer(gl, shader.strokeWidthBuffer, shader.attribLocations.pxStrokeWidth, 1)

		// gl.drawArrays(gl.QUAD, 0, vertices.length/2)

		gl.drawElements(gl.TRIANGLES, this.markers.feeds.length*6, gl.UNSIGNED_INT, 0)

		// draw vertices for debugging purposes
		// gl.pointSize(40)
		// gl.drawArrays(gl.POINTS, 0, vertices.length/2)

		const sparkPM = [
			xscale, 		  0, 0, 0,
			     0, -yscale, 0, 0,
					 0, 		  0, 1, 0,
			  -1.0, 	  1.0, 0, 1
		]
		this.drawSparkLines(gl, sparkPM)
	}

	glDraw(gl) {

		// force a buffer update if we're forced to draw while waiting for a deferred update
		// this also triggers a new glDraw()
		if (this.glBuffersDirty) {
			this._doDeferredGlUpdate({}, true)
			return
		}

		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
		gl.clearColor(0.0, 0.0, 0.0, 0.0)
		gl.clear(gl.COLOR_BUFFER_BIT)


		// this.glDrawGeoGrid(gl)
		this.glDrawMarkers(gl)
	}

	glDrawGeoGrid(gl) {
		let map = this.getMap()
		let mapBounds = map.getBounds()
		let geosw = (mapBounds.getSouthWest())
		let geone = (mapBounds.getNorthEast())
		// let pixelScale = window.devicePixelRatio || 1.0

		let vertices = []
		let colors = []


		for (let i = Math.ceil(geosw.lng()); i < geone.lng(); i++)
		{
			let xpix = this.longitudeToCanvasPixel(i)
			vertices.push(xpix, 0.1*this.canvas.height)
			vertices.push(xpix, 0.9*this.canvas.height)
			let color = [0.5, 0, 1.0, 1.0];
			if (i % 10 == 0)
				color = [0.0, 1.0, 0.0, 1.0];;
			if (i == 0)
				color = [0.0, 0, 0.0, 1.0];;

			colors.push(...color)
			colors.push(...color)
		}

		for (let i = Math.ceil(geosw.lat()); i < geone.lat(); i++)
		{
			let ypix = this.latitudeToCanvasPixel(i)
			vertices.push(0.1*this.canvas.width, ypix)
			vertices.push(0.9*this.canvas.width, ypix)
			let color = [0.5, 0, 1.0, 1.0];
			if (i % 10 == 0)
				color = [0.0, 1.0, 0.0, 1.0];;
			if (i == 0)
				color = [0.0, 0, 0.0, 1.0];;

			colors.push(...color)
			colors.push(...color)
		}

		// vertices = [
		// 	 0.5,  0.5,
		// 	 0.5, -0.5,
		// 	-0.5,  0.5,
		// 	-0.5, -0.5,
		// ]

		// crete vertex buffer on demand
		const vertexBuffer = this.vertexBuffer || gl.createBuffer()
		this.vertexBuffer = vertexBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)

		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)

		const colorBuffer = this.colorBuffer || gl.createBuffer()
		this.colorBuffer = colorBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)

		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW)



		// do the drawing

		gl.lineWidth(1.0)

		const PM = [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		]
		// const MV = PM
		// model view matrix that shifts Y to point up instead of down as is standard in GL
		const MV = [
			2.0/this.canvas.width, 											 0, 0, 0,
			                    0, -2.0/this.canvas.height, 0, 0,
													0, 									 	 	 0, 1, 0,
											 -1.0, 									   1.0, 0, 1
		]

		let shader = this.simpleShader

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
		gl.vertexAttribPointer(shader.attribLocations.vertexPos, 2, gl.FLOAT, false, 0, 0)
		gl.enableVertexAttribArray(shader.attribLocations.vertexPos)

		gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
		gl.vertexAttribPointer(shader.attribLocations.color, 4, gl.FLOAT, false, 0, 0)
		gl.enableVertexAttribArray(shader.attribLocations.color)

		gl.useProgram(shader.shaderProgram)
		gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
		gl.uniformMatrix4fv(shader.uniformLocations.projectionMatrix, false, PM)

		// gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertices.length/2)
		gl.drawArrays(gl.LINES, 0, vertices.length/2)


	}

	metersPerDegreeAtLatitude(latitude) {
		const earthRadius = 6378137.0
		let scale = cos(latitude * Math.PI/180.0) * (Math.PI*2.0*earthRadius)
		return scale
	}

	metersPerPixelAtLatitude(latitude, zoomFactor) {
		// https://groups.google.com/g/google-maps-js-api-v3/c/hDRO4oHVSeM
		// earthRadius * 2 * pi / 256 * cos (lat * pi/180) / zoomFactor
		// zoomFactor = pow(2, zoom)
		const earthRadius = 6378137.0
		let scale = cos(latitude * Math.PI/180.0) * (Math.PI*2.0*earthRadius) / zoomFactor
		return scale
	}

	latitudeToGlobalPixel(latitude, zoomFactor) {
		let mercatorLatitude = (180.0/Math.PI)*Math.log(Math.tan(Math.PI*0.25 + latitude*(Math.PI/180.0*0.5)))
		let mercatorPixel = 256.0/360.0*zoomFactor*mercatorLatitude
		return mercatorPixel
	}

	longitudeToGlobalPixel(longitude, zoomFactor) {
		let mercatorLongitude = longitude
		let mercatorPixel = 256.0/360.0*zoomFactor*mercatorLongitude
		return mercatorPixel
	}

	mercatorToLatitude(lntany) {
		// lntany = (180.0/Math.PI)*Math.log(Math.tan(Math.PI*0.25 + latitude*(Math.PI/180.0*0.5)))
		// lntany*(Math.PI/180.0) = Math.log(Math.tan(Math.PI*0.25 + latitude*(Math.PI/180.0*0.5)))
		// Math.exp(lntany*(Math.PI/180.0)) = Math.tan(Math.PI*0.25 + latitude*(Math.PI/180.0*0.5))
		// Math.atan(Math.exp(lntany*(Math.PI/180.0))) = Math.PI*0.25 + latitude*(Math.PI/180.0*0.5)
		// Math.atan(Math.exp(lntany*(Math.PI/180.0))) - Math.PI*0.25 = latitude*(Math.PI/180.0*0.5)
		// (Math.atan(Math.exp(lntany*(Math.PI/180.0))) - Math.PI*0.25)*(180.0/Math.PI/0.5) = latitude
		return (Math.atan(Math.exp(lntany*(Math.PI/180.0))) - Math.PI*0.25)*(180.0/Math.PI/0.5)
	}
	latitudeToMercator(latitude) {
		let lntany = (180.0/Math.PI)*Math.log(Math.tan(Math.PI*0.25 + latitude*(Math.PI/180.0*0.5)))
		return lntany
	}


	// create functions to convert from geometric to window coordinates
	createCoordinateConversionFunctions() {
		let overlayProjection = this.getProjection()
		let map = this.getMap()
		let mapBounds = map.getBounds()
		let center = map.getCenter()
		let geosw = (mapBounds.getSouthWest())
		let geone = (mapBounds.getNorthEast())
		let pixsw = overlayProjection.fromLatLngToDivPixel(mapBounds.getSouthWest())
		let pixne = overlayProjection.fromLatLngToDivPixel(mapBounds.getNorthEast())


		let ctx = this.canvas.getContext("2d")
		// ctx.strokeStyle = 'rgba(0, 200, 0, 0.2)';
		let pixelScale = window.devicePixelRatio || 1.0

		// The Zoom Fiasco
		//		During zooming, the mapBounds stay fixed, but the projection changes, which makes the projection weird
		//		Thus, we have to compute this x/y offset from pixsw
		//	As for scale, the Y-scale has to be scaled by the web mercator function NON-LINEARLY, but that's easily done through the y=ln(tan(pi/4+lat/2)) function, which gives us a projected value that is linear in pixel-space
		// all latitudes have to be "linearized" before further computation in pixel space
		let pixWidth = pixne.x - pixsw.x
		let pixHeight = pixne.y - pixsw.y
		let geoWidth = geone.lng() - geosw.lng()
		let canvasWidth = this.canvas.width
		let canvasHeight = this.canvas.height
		// let pixelWidth = canvasWidth/pixelScale
		// let pixelHeight = canvasHeight/pixelScale
		let xoffset = 0.5*canvasWidth/pixWidth
		let yoffset = 0.5*this.canvas.height/pixHeight

		// web mercator is 256px across for 2pi 
		// we have to recreate the zoom factor because map.getZoom() is wrong during the zoom animation
		if (geoWidth < 0.0) {
			geoWidth = 360.0 + geoWidth
		}
		let zoomFactor = (pixWidth) / ((256/(Math.PI*2.0)) * (geoWidth*Math.PI/180.0))
		this.zoomFactor = zoomFactor
		this.mapSouthWest = geosw
		this.pixSouthWest = pixsw
		this.pixHeight = pixHeight

		// console.log(`zoomFactor ${Math.log2(zoomFactor)} (${zoomFactor}) zoomLevel ${map.getZoom()} (${Math.pow(2.0, map.getZoom())})`)

		this.viewPixelToLongitude = function(x) {
			// x = 0.5*canvasWidth + pixelScale*(pixsw.x + (longitude - geosw.lng())/geoWidth*pixWidth)
			// x - 0.5*canvasWidth = pixelScale*(pixsw.x + (longitude - geosw.lng())/geoWidth*pixWidth)
			// (x - 0.5*canvasWidth)/pixelScale = pixsw.x + (longitude - geosw.lng())/geoWidth*pixWidth
			// (x - 0.5*canvasWidth)/pixelScale - pixsw.x = (longitude - geosw.lng())/geoWidth*pixWidth
			// ((x - 0.5*canvasWidth)/pixelScale - pixsw.x)*geoWidth/pixWidth = longitude - geosw.lng()
			return ((x*pixelScale - 0.5*canvasWidth)/pixelScale - pixsw.x)*geoWidth/pixWidth + geosw.lng()
		}
		this.longitudeToViewPixel = function(lng) {
			// lng = ((x*pixelScale - 0.5*canvasWidth)/pixelScale - pixsw.x)*geoWidth/pixWidth + geosw.lng()
			// (lng - geosw.lng()) = ((x*pixelScale - 0.5*canvasWidth)/pixelScale - pixsw.x)*geoWidth/pixWidth
			// (lng - geosw.lng())/geoWidth*pixWidth = (x*pixelScale - 0.5*canvasWidth)/pixelScale - pixsw.x
			// (lng - geosw.lng())/geoWidth*pixWidth + pixsw.x = (x*pixelScale - 0.5*canvasWidth)/pixelScale
			// (lng - geosw.lng())/geoWidth*pixWidth*pixelScale + pixsw.x*pixelScale = x*pixelScale - 0.5*canvasWidth
			// (lng - geosw.lng())/geoWidth*pixWidth*pixelScale + pixsw.x*pixelScale + 0.5*canvasWidth = x*pixelScale
			// (lng - geosw.lng())/geoWidth*pixWidth*pixelScale + pixsw.x*pixelScale + 0.5*canvasWidth = x*pixelScale
			// (lng - geosw.lng())/geoWidth*pixWidth + pixsw.x + 0.5*canvasWidth/pixelScale = x
			return (lng - geosw.lng())/geoWidth*pixWidth + pixsw.x + 0.5*canvasWidth/pixelScale
		}
		this.longitudeToCanvasPixel = function(longitude) {
			// geo == mercator for longitude
			// original:
			return 0.5*canvasWidth + pixelScale*(pixsw.x + (longitude - geosw.lng())/geoWidth*pixWidth)

			// shift removed from inside
			// 
			// return pixelScale*pixWidth/geoWidth*(0.5*geoWidth + pixsw.x/pixWidth*geoWidth - geosw.lng() + longitude)

		}

		// height in "projected" space
		let geoHeight = this.latitudeToMercator(geone.lat()) - this.latitudeToMercator(geosw.lat())


		this.addPixelDeltaToGeoPos = function(geo, pxDelta) {
			let pxSrc = this.geoCoordsToViewPixel(geo)
			let pxDst = {x: pxSrc.x + pxDelta.x, y: pxSrc.y + pxDelta.y}
			let geoDst = this.viewPixelToGeoCoords(pxDst)
			return geoDst
		}


		this.viewPixelToLatitude = function(y) {
			// y = 0.5*canvasHeight + pixelScale*(pixsw.y + (this.latitudeToMercator(latitude) - this.latitudeToMercator(geosw.lat()))/geoHeight*pixHeight)
			// y - 0.5*canvasHeight = pixelScale*(pixsw.y + (this.latitudeToMercator(latitude) - this.latitudeToMercator(geosw.lat()))/geoHeight*pixHeight)
			// (y - 0.5*canvasHeight)/pixelScale = pixsw.y + (this.latitudeToMercator(latitude) - this.latitudeToMercator(geosw.lat()))/geoHeight*pixHeight
			// (y - 0.5*canvasHeight)/pixelScale - pixsw.y = (this.latitudeToMercator(latitude) - this.latitudeToMercator(geosw.lat()))/geoHeight*pixHeight
			// ((y - 0.5*canvasHeight)/pixelScale - pixsw.y)*geoHeight/pixHeight = this.latitudeToMercator(latitude) - this.latitudeToMercator(geosw.lat())
			// ((y - 0.5*canvasHeight)/pixelScale - pixsw.y)*geoHeight/pixHeight + this.latitudeToMercator(geosw.lat()) = this.latitudeToMercator(latitude)
			// this.mercatorToLatitude(((y - 0.5*canvasHeight)/pixelScale - pixsw.y)*geoHeight/pixHeight + this.latitudeToMercator(geosw.lat())) = latitude
			return this.mercatorToLatitude(((y*pixelScale - 0.5*canvasHeight)/pixelScale - pixsw.y)*geoHeight/pixHeight + this.latitudeToMercator(geosw.lat()))
		}

		this.latitudeToViewPixel = function(lat) {
			// lat = this.mercatorToLatitude(((y*pixelScale - 0.5*canvasHeight)/pixelScale - pixsw.y)*geoHeight/pixHeight + this.latitudeToMercator(geosw.lat()))
			// this.latitudeToMercator(lat) = ((y*pixelScale - 0.5*canvasHeight)/pixelScale - pixsw.y)*geoHeight/pixHeight + this.latitudeToMercator(geosw.lat())
			// this.latitudeToMercator(lat) - this.latitudeToMercator(geosw.lat()) = ((y*pixelScale - 0.5*canvasHeight)/pixelScale - pixsw.y)*geoHeight/pixHeight
			// (this.latitudeToMercator(lat) - this.latitudeToMercator(geosw.lat()))/geoHeight*pixHeight = (y*pixelScale - 0.5*canvasHeight)/pixelScale - pixsw.y
			// (this.latitudeToMercator(lat) - this.latitudeToMercator(geosw.lat()))/geoHeight*pixHeight + pixsw.y = (y*pixelScale - 0.5*canvasHeight)/pixelScale
			// (this.latitudeToMercator(lat) - this.latitudeToMercator(geosw.lat()))/geoHeight*pixHeight*pixelScale + pixsw.y*pixelScale = y*pixelScale - 0.5*canvasHeight
			// (this.latitudeToMercator(lat) - this.latitudeToMercator(geosw.lat()))/geoHeight*pixHeight*pixelScale + pixsw.y*pixelScale + 0.5*canvasHeight = y*pixelScale
			// (this.latitudeToMercator(lat) - this.latitudeToMercator(geosw.lat()))/geoHeight*pixHeight + pixsw.y + 0.5*canvasHeight/pixelScale = y
			return (this.latitudeToMercator(lat) - this.latitudeToMercator(geosw.lat()))/geoHeight*pixHeight + pixsw.y + 0.5*canvasHeight/pixelScale
		}


		this.latitudeToCanvasPixel = function(latitude) {
			return 0.5*canvasHeight + pixelScale*(pixsw.y + (this.latitudeToMercator(latitude) - this.latitudeToMercator(geosw.lat()))/geoHeight*pixHeight)
		}

	}

	drawGeoGrid() {

		let overlayProjection = this.getProjection()
		let map = this.getMap()
		let mapBounds = map.getBounds()
		let center = map.getCenter()
		let geosw = (mapBounds.getSouthWest())
		let geone = (mapBounds.getNorthEast())
		let pixsw = overlayProjection.fromLatLngToDivPixel(mapBounds.getSouthWest())
		let pixne = overlayProjection.fromLatLngToDivPixel(mapBounds.getNorthEast())

		let clientBounds = this.canvas.getBoundingClientRect()

		let ctx = this.canvas.getContext("2d")
		// ctx.strokeStyle = 'rgba(0, 200, 0, 0.2)';
		let pixelScale = window.devicePixelRatio || 1.0

		// The Zoom Fiasco
		//		During zooming, the mapBounds stay fixed, but the projection changes, which makes the projection weird
		//		Thus, we have to compute this x/y offset from pixsw
		//	As for scale, the Y-scale has to be scaled by the web mercator function NON-LINEARLY, but that's easily done through the y=ln(tan(pi/4+lat/2)) function, which gives us a projected value that is linear in pixel-space
		// all latitudes have to be "linearized" before further computation in pixel space
		let pixWidth = pixne.x - pixsw.x
		let pixHeight = pixne.y - pixsw.y
		let geoWidth = geone.lng() - geosw.lng()
		let canvasWidth = this.canvas.width
		let canvasHeight = this.canvas.height
		let xoffset = 0.5*canvasWidth/pixWidth
		let yoffset = 0.5*this.canvas.height/pixHeight



		// draw lon/lat grid for test purposes
		for (let i = Math.ceil(geosw.lng()); i < geone.lng(); i++)
		{
			let xpix = this.longitudeToCanvasPixel(i)
			ctx.strokeStyle = `rgba(0, 200, ${Math.max(0, Math.min(255, 127 + 30*i))}, 1.0)`;
			if (i == 0)
			ctx.strokeStyle = `rgba(0, 0, 0, 1.0)`;
			ctx.beginPath()
			ctx.moveTo(xpix, 0.1*this.canvas.height)
			ctx.lineTo(xpix, 0.9*this.canvas.height)
			ctx.stroke()
		}
		for (let i = Math.ceil(geosw.lat()); i < geone.lat(); i++)
		{
			let ypix = this.latitudeToCanvasPixel(i)
			ctx.strokeStyle = `rgba(${Math.max(0, Math.min(255, 127 + 30*i))}, 0, 200, 1.0)`;
			if (i % 10 == 0)
				ctx.strokeStyle = `rgba(0, 255, 0, 1.0)`;
			if (i == 0)
				ctx.strokeStyle = `rgba(0, 0, 0, 1.0)`;
			ctx.beginPath()
			ctx.moveTo(0.1*this.canvas.width, ypix)
			ctx.lineTo(0.9*this.canvas.width, ypix)
			ctx.stroke()
		}


	}

/**
 * Return 0 <= i <= array.length such that !predicate(array[i - 1]) && predicate(array[i]).
 */
_binarySearch(array, predicate) {
    let lo = -1
    let hi = array.length
    while (1 + lo < hi) {
        const mi = lo + ((hi - lo) >> 1)
        if (predicate(array[mi])) {
            hi = mi;
        } else {
            lo = mi;
        }
    }
    return hi;
	}

	// takes array or set as input, returns array
	_xorSets(A,B) {
		let aryA = Array.isArray(A) ? A : Array.from(A)
		let aryB = Array.isArray(B) ? B : Array.from(B)
		let setA = Array.isArray(A) ? new Set(A) : A
		let setB = Array.isArray(B) ? new Set(B) : B
		let changedAry = aryA.filter(e => !setB.has(e)).concat(aryB.filter(e => !setA.has(e)))
		return changedAry
	}

	selectFeed(feedId, isSelected, isImmediate) {
		if (!this.markers)
			return []
		let feedIds = new Set(this.markers.selectedFeeds)
		if (isSelected) {
			feedIds.add(feedId)
		}
		else {
			feedIds.delete(feedId)
		}

		this.selectMarkers(feedIds, isImmediate)

	}

	selectMarkers(feeds, isImmediate) {
		if (!this.markers)
			return []

    // changed are only the xor between the two sets
    let changedFeeds = this._xorSets(this.markers.selectedFeeds, feeds)

    this.markers.selectedFeeds = new Set(feeds)
    this.colorMarkers(changedFeeds)

    this._doDeferredGlUpdate({feedColors: changedFeeds}, isImmediate)

		return feeds
	}


	highlightMarkers(feeds, isImmediate) {
		if (!this.markers)
			return []

    // changed are only the xor between the two sets
    let changedFeeds = this._xorSets(this.markers.highlightedFeeds, feeds)

    this.markers.highlightedFeeds = new Set(feeds)
    this.colorMarkers(changedFeeds)

    this._doDeferredGlUpdate({feedColors: changedFeeds}, isImmediate)

		return feeds
	}

	highlightFeeds(feeds, isImmediate) {

    // changed are only the xor between the two sets
    let changedFeeds = this._xorSets(this.markers.highlightedFeeds, feeds)

    this.markers.highlightedFeeds = new Set(feeds)
    this.colorMarkers(changedFeeds)

    this._doDeferredGlUpdate({feedColors: changedFeeds}, isImmediate)

	}

	highlightMarkersAtGeo(geo, isImmediate) {

    let feeds = this.feedsCloseToGeo(geo, 10.0).filter(feedId => !this.markers.rejectedFeeds.has(feedId))

    this.highlightFeeds(feeds, isImmediate)

    return feeds
	}

	highlightMarkersAtPixel(eventPixel, isImmediate) {
		if (!this.markers)
			return []

		let pixsw = this.pixSouthWest

		let x = eventPixel.x
		let y = eventPixel.y
		// let x = eventPixel.x
		// let y = pixsw.y - eventPixel.y

    // console.log(`mousemove ${eventPixel}`)

    let feeds = this.feedsCloseToPixel({x: x, y: y}, 10.0).filter(feedId => !this.markers.rejectedFeeds.has(feedId))

    this.highlightFeeds(feeds, isImmediate)

		return feeds
	}

	filterMarkers(filteredFeeds) {
		if (!this.markers)
			return

	  let resultsSet = new Set(filteredFeeds)
	  let rejectedFeeds = Array.from(this.markers.sortedFeeds.index.keys()).filter(feedId => !resultsSet.has(feedId))

		let changedFeeds = this._xorSets(this.markers.rejectedFeeds, rejectedFeeds)
		// console.log(`filterMarkers changedFeeds = ${changedFeeds.length}`)

		this.markers.rejectedFeeds = new Set(rejectedFeeds)
		this.colorMarkers(changedFeeds)

		this._doDeferredGlUpdate({feedColors: changedFeeds, allIndices: true})
		// if (this.gl) {
		// 	let feedIndices = changedFeeds.map(feedId => this.markers.sortedFeeds.index.get(feedId))
		// 	this._updateIndexBuffer(this.gl)
		// 	this._updateMarkerColorBuffers(this.gl, feedIndices)
		// 	this.glDraw(this.gl)
		// }
	}

	activateMarkers(activeFeeds) {
		if (!this.markers)
			return
		let changedFeeds = this._xorSets(this.markers.activeFeeds, activeFeeds)

		this.markers.activeFeeds = new Set(activeFeeds)
		this.colorMarkers(changedFeeds)

		this._doDeferredGlUpdate({feedColors: changedFeeds})
		// if (this.gl) {
		// 	let feedIndices = changedFeeds.map(feedId => this.markers.sortedFeeds.index.get(feedId))
		// 	this._updateMarkerColorBuffers(this.gl, feedIndices)
		// 	this.glDraw(this.gl)
		// }
	}

	viewPixelToGeoCoords(px) {
		let geo = new google.maps.LatLng(this.viewPixelToLatitude(px.y), this.viewPixelToLongitude(px.x))
		return geo
	}
	geoCoordsToViewPixel(geo) {
		return {x: this.longitudeToViewPixel(geo.lng), y: this.latitudeToViewPixel(geo.lat)}
	}


	geoCoordsToCanvasPixel(geo) {
		return {x: this.longitudeToCanvasPixel(geo.lng), y: this.latitudeToCanvasPixel(geo.lat)}
	}

	feedsCloseToGeo(geo, pxRadius) {
		// if no data source, no feeds
		if (!this.feedDataSource)
			return []


		let geosw = this.addPixelDeltaToGeoPos(geo, {x: -pxRadius, y: +pxRadius})
		let geone = this.addPixelDeltaToGeoPos(geo, {x: +pxRadius, y: -pxRadius})

		// console.log(`feedsCloseToPixelv ${geosw.lng()} to ${geone.lng()}, ${geosw.lat()} to ${geone.lat()}`)

		let feedIds = this.feedDataSource.feedsInGeoBox(geosw, geone)

		return feedIds
	}

	feedsCloseToPixel(pxPos, pxRadius) {
		// if no data source, no feeds
		if (!this.feedDataSource)
			return []

		let pixsw = {x: pxPos.x - pxRadius, y: pxPos.y + pxRadius}
		let pixne = {x: pxPos.x + pxRadius, y: pxPos.y - pxRadius}

		let geosw = this.viewPixelToGeoCoords(pixsw)
		let geone = this.viewPixelToGeoCoords(pixne)

		// console.log(`feedsCloseToPixelv ${geosw.lng()} to ${geone.lng()}, ${geosw.lat()} to ${geone.lat()}`)

		let feedIds = this.feedDataSource.feedsInGeoBox(geosw, geone)

		return feedIds
	}

	// feedsInGeoBox(sw, ne) {
	// 	if (!this.markers)
	// 		return []

	// 	// binsearch lng/lat to find range covered in box
	// 	let latArray = this.markers.sortedFeeds.latitude
	// 	let latLo = this._binarySearch(latArray, e => e[0] >= sw.lat())
	// 	let latHi = this._binarySearch(latArray, e => e[0] > ne.lat())

	// 	if (latLo >= latHi) // same indices indicate nothing found
	// 		return []

	// 	let lngArray = this.markers.sortedFeeds.longitude
	// 	let lngLo = this._binarySearch(lngArray, e => e[0] >= sw.lng())
	// 	let lngHi = this._binarySearch(lngArray, e => e[0] > ne.lng())

	// 	if (lngLo >= lngHi)
	// 		return []

	// 	// find intersection of lat/lng results, eg. only those that have both
	// 	let lngSet = new Set(lngArray.slice(lngLo, lngHi).map(e => e[1]))
	// 	let intersectArray = latArray.slice(latLo, latHi).map(e => e[1]).filter(e => lngSet.has(e))

	// 	// return only the feedIds
	// 	return intersectArray

	// }

	colorMarkers(changedFeedIds) {
		let markers = this.markers
		if (!markers)
			return

		// if no change list supplied, color all
		if (!changedFeedIds)
			changedFeedIds = markers.feeds.map(feed => feed.id)

		let fillColors = changedFeedIds.map( (feedId) => {
			if (markers.highlightedFeeds.has(feedId))
				return [0.0,0.2,0.2,0.2]
			else if (markers.rejectedFeeds.has(feedId))
				return [0.025,0.025,0.025,0.05]
			else
				return [0.0,0.0,0.3,0.3]
		})
		let strokeColors = changedFeedIds.map( (feedId) => {
			if (markers.selectedFeeds.has(feedId))
				return [1.0, 0.0, 0.0, 1.0]
			if (markers.activeFeeds.has(feedId))
				return [0.5,0.5,0.5,0.5]
			else if (markers.rejectedFeeds.has(feedId))
				return [0.05,0.05,0.05,0.1]
			else
				return [0.0,0.0,0.5,0.5]
		})

		let feedIndices = undefined
		if (!this.markers.fillColors || (this.markers.fillColors.length == fillColors.length)) {
			this.markers.fillColors = fillColors
			this.markers.strokeColors = strokeColors
		}
		else
		{
			feedIndices = changedFeedIds.map(feedId => this.markers.sortedFeeds.index.get(feedId))
			for (let i = 0; i < fillColors.length; i++) {
				let feedIndex = feedIndices[i]
				this.markers.fillColors[feedIndex] = fillColors[i]
				this.markers.strokeColors[feedIndex] = strokeColors[i]
			}
		}
	}

	setDataSource(feedDataSource, feedStates) {
		// feeds to draw as markers
		// filter out all that don't have lon/lat
		this.feedDataSource = feedDataSource
		let feeds = Array.from(feedDataSource.feeds.values()).filter(feed => feed.latlng)

		let feedIndexMap = new Map(feeds.map((e, i) => [e.id, i]))

		let positions = feeds.map(feed => [feed.latlng.lng, feed.latlng.lat])

		// look for feed states that determine coloring
		// FIXME: selectedFeeds is fetched from data source here, but interactive selections need to be done through selectFeed() to be visible
		let selectedFeeds = feedDataSource.selectedFeeds()
		let highlightedFeeds = feedStates && feedStates.highlightedFeeds ? feedStates.highlightedFeeds : (this.markers && this.markers.highlightedFeeds) || new Set()
		let activeFeeds = feedStates && feedStates.activeFeeds ? feedStates.activeFeeds : (this.markers && this.markers.activeFeeds) || new Set()

		let rejectedFeeds = feedStates && feedStates.rejectedFeeds ? feedStates.rejectedFeeds : (this.markers && this.markers.rejectedFeeds) || new Set()




		this.markers = {
			sortedFeeds: {
				longitude: feedDataSource.longitudeSortedFeeds,
				latitude: feedDataSource.latitudeSortedFeeds,
				index: feedIndexMap, // maps feedId -> array index (for updating buffers when the markers change)
			},
			feeds: feeds,
			positions: positions,
			fillColors: this.repeatArray([0.0,0.0,0.5,0.5], feeds.length),
			strokeColors: this.repeatArray([0.0,0.0,0.5,0.5], feeds.length),
			strokeWidths: this.repeatArray([1.0], feeds.length),
			markerSizes: this.repeatArray([10.0], feeds.length),
			highlightedFeeds: highlightedFeeds,
			rejectedFeeds: rejectedFeeds,
			activeFeeds: activeFeeds,
			selectedFeeds: selectedFeeds,
		}

		this.colorMarkers()

		this.glBuffersDirty = true;

		this._doDeferredGlUpdate({allMarkers: true})
		// if (this.gl) {
		// 	this._updateMarkerBuffers(this.gl)
		// 	this.glDraw(this.gl)
		// }
	}

	updateSparklineTimeRange(range) {
		for (let plotter of this.sparkLines.values()) {
			plotter.setPlotRange(range)
		}
		this.requestDraw()
	}


	removeSparklinePlot(feedId, channelName) {
		this.sparkLines.delete(`${feedId}.${channelName}`)

		this.requestDraw()
	}


	addSparklinePlot(feedId, channelName) {

		let tileSource = this.feedDataSource.dataSourceForChannel(feedId, channelName)

		let {texture: colorMapTexture, range: colorMapRange} = ESDR.sparklineColorMap(feedId, channelName)

		let plotter = new ETP(tileSource, colorMapTexture, colorMapRange)
    plotter.dataUpdatedCallback = () => this.requestDraw()

		this.sparkLines.set(`${feedId}.${channelName}`, plotter)

		this.requestDraw()

		return plotter
	}


	drawSparkLines(gl, PM) {
		for (let [channelId, plotter] of this.sparkLines) {
			let feedId = parseInt(channelId.slice(0, channelId.indexOf('.')))
			let feed = this.feedDataSource.feeds.get(feedId)
			// feed might not be loaded, yet, in which case we don't know its position
			if (!feed || !feed.latlng)
				continue

			let pxOffset = this.geoCoordsToCanvasPixel(feed.latlng)
			// FIXME: this is to canvas coords, which are scaled wrong, and upside down
			let pixelScale = window.devicePixelRatio || 1.0
			pxOffset.x *= 1.0/pixelScale
			pxOffset.y = /*this.canvas.height - */pxOffset.y
			pxOffset.y *= 1.0/pixelScale
			// pxOffset.y += plotter.plotHeight

			plotter.glDraw(gl, pxOffset, PM)
		}

	}


	setColorizerForFeed(feedId, channelName, colorizer) {

		if (colorizer) {
			// load colormap if we have one
			let colorMap = ESDR.sparklineColorMap(feedId, channelName)

			let imagePeeker = colorMap.texture ? new ImagePeeker(colorMap.texture) : undefined


			colorizer.currentValueCallback = (time, value, count) => {
				let feedIndex = this._getFeedIndexFromFeedId(feedId)

				// console.log("colorizering", feedId, channelName, time, value)

				// do nothing if feed isn't on map (yet)
				if (feedIndex === undefined)
					return

				let color = (imagePeeker ? imagePeeker.colorMapLookup(value, colorMap.range) : undefined) || [0.0,0.0,0.0,1.0]

				// console.log("  color", color)

				this.colorizedFeedColors.set(feedId, color)

				this.markers.fillColors[feedIndex] = color

				this.glBuffersDirty = true
				this._doDeferredGlUpdate({feedColors: [feedId]})

				this.requestDraw()
		  }

		}	
		else {
			// if we're clearing the colorizer, do a color update
			this.colorMarkers([feedId])
			this._doDeferredGlUpdate({feedColors: [feedId]})
		}


	  this.feedColorizers.set(feedId, colorizer)
	}

} // class MapOverlay

export {MapOverlay, ImagePeeker}
