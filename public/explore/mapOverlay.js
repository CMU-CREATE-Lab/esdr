
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

class MapOverlay extends google.maps.OverlayView {
	constructor(mapDiv) {
		super()
		this.mapDiv = mapDiv
	}

	onAdd() {
		let clientBounds = this.mapDiv.getBoundingClientRect()

		this.canvas = document.createElement("canvas")
		// this.canvas.style.top = `${clientBounds.top}px`
		// this.canvas.style.left = `${clientBounds.left}px`
		// this.canvas.style.width = `${clientBounds.width}px`
		// this.canvas.style.height = `${clientBounds.height}px`
		// this.canvas.style.width = `100%`
		// this.canvas.style.height = `100%`
		// this.canvas.style.position = "fixed"
		this.canvas.style.display = "block"
		// this.canvas.style.zIndex = "1"

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

	draw() {
    // console.log(`draw event`);
		let map = this.getMap()
		let mapBounds = map.getBounds()
		let mapCenter = map.getCenter()
		let overlayProjection = this.getProjection()
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

			this.glDraw(this.gl)
		}

	}

	_loadShader(gl, type, source) {
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

	_initShaderProgram(gl, vsSource, fsSource) {
		const vertexShader = this._loadShader(gl, gl.VERTEX_SHADER, vsSource)
		const fragmentShader = this._loadShader(gl, gl.FRAGMENT_SHADER, fsSource)

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

	  return shaderProgram
	}

	_initGl() {
		const gl = this.canvas.getContext("webgl")

		if (gl == null) {
			alert("Cannot initialize WebGL.")
			return
		}
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
				return vec2(geo.x, (180.0/pi)*log(tan(pi*0.25 + geo.y*(pi/180.0*0.5))));
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

	    	// offset vertex by direction and size of marker
	    	// actual offset is 1px bigger than markerSize to leave room for AA
	    	vec2 pxOffset = pxVertexOffsetDirection*(0.5*pxMarkerSizeIn + pxStrokeWidthIn + 1.0);
	    	pixelPos += pxOffset;

	    	// outputs
	    	pxCenterOffset = pxOffset;
	      gl_Position = projectionMatrix * modelViewMatrix * vec4(pixelPos, 0.0, 1.0);
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

  	this.markerShader = {
  		shaderProgram: this._initShaderProgram(gl, markerVertexShader, markerFragmentShader),
  	}
  	this.markerShader.attribLocations = {
  		geoVertexPos: 						gl.getAttribLocation(this.markerShader.shaderProgram, "geoVertexPos"),
  		pxVertexOffsetDirection: 	gl.getAttribLocation(this.markerShader.shaderProgram, "pxVertexOffsetDirection"),
  		pxMarkerSize: 						gl.getAttribLocation(this.markerShader.shaderProgram, "pxMarkerSizeIn"),
  		pxStrokeWidth: 						gl.getAttribLocation(this.markerShader.shaderProgram, "pxStrokeWidthIn"),
  		fillColor: 										gl.getAttribLocation(this.markerShader.shaderProgram, "fillColorIn"),  		
  		strokeColor: 										gl.getAttribLocation(this.markerShader.shaderProgram, "strokeColorIn"),  		
  	}
  	this.markerShader.uniformLocations = {
  		zoomFactor: 	gl.getUniformLocation(this.markerShader.shaderProgram, "zoomFactor"),
  		modelViewMatrix: 	gl.getUniformLocation(this.markerShader.shaderProgram, "modelViewMatrix"),
  		projectionMatrix: 	gl.getUniformLocation(this.markerShader.shaderProgram, "projectionMatrix"),

  	}

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
  	this.simpleShader = {
  		shaderProgram: this._initShaderProgram(gl, vertexShader, fragmentShader)
  	}

  	this.simpleShader.attribLocations = {
  		vertexPos: gl.getAttribLocation(this.simpleShader.shaderProgram, "vertexPos"),
  		color: gl.getAttribLocation(this.simpleShader.shaderProgram, "colorIn"),
  	}

  	this.simpleShader.uniformLocations = {
  		modelViewMatrix: gl.getUniformLocation(this.simpleShader.shaderProgram, "modelViewMatrix"),
  		projectionMatrix: gl.getUniformLocation(this.simpleShader.shaderProgram, "projectionMatrix"),
  	}

	}

	glDrawMarkers(gl) {
		let pixelScale = window.devicePixelRatio || 1.0

		// the scale is simple enough, but we also need to shift the center
		// (0,0) in pixel coords should be at the bottom left of the screen
		let xshift = this.longitudeToGlobalPixel(this.mapSouthWest.lng(), this.zoomFactor)
		let yshift = this.latitudeToGlobalPixel(this.mapSouthWest.lat(), this.zoomFactor)
		// during drag/zoom gotta add these shift values for things to line up right due to CSS voodoo
		xshift -= 0.5*this.canvas.width/pixelScale + this.pixSouthWest.x
		yshift -= 0.5*this.canvas.height/pixelScale - this.pixSouthWest.y
		console.log(`swlon ${this.mapSouthWest.lng()} swlat ${this.mapSouthWest.lat()}`)
		console.log(`xshift ${xshift} yshift ${yshift} zf ${this.zoomFactor}`)
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

		let indices = [
			0,1,2,
			2,3,0,
			4,5,6,
			6,7,4,
			8,9,10,
			10,11,8,
		]

		let vertices = [
			0.0, 0.0,
			0.0, 0.0,
			0.0, 0.0,
			0.0, 0.0,
			50.0, 50.0,
			50.0, 50.0,
			50.0, 50.0,
			50.0, 50.0,
			6.9603, 50.9375,
			6.9603, 50.9375,
			6.9603, 50.9375,
			6.9603, 50.9375,
		]
		let fillColors = [
			// red
			0.5,0.0,0.0,0.5,
			0.5,0.0,0.0,0.5,
			0.5,0.0,0.0,0.5,
			0.5,0.0,0.0,0.5,
			// purple
			0.5,0.0,0.5,0.5,
			0.5,0.0,0.5,0.5,
			0.5,0.0,0.5,0.5,
			0.5,0.0,0.5,0.5,
			// blue
			0.0,0.0,0.5,0.5,
			0.0,0.0,0.5,0.5,
			0.0,0.0,0.5,0.5,
			0.0,0.0,0.5,0.5,
		]
		let strokeColors = [
			// yellow
			1.0,1.0,0.0,1.0,
			1.0,1.0,0.0,1.0,
			1.0,1.0,0.0,1.0,
			1.0,1.0,0.0,1.0,
			// blue
			0.0,0.0,0.5,0.5,
			0.0,0.0,0.5,0.5,
			0.0,0.0,0.5,0.5,
			0.0,0.0,0.5,0.5,
			// black
			0.0,0.0,0.0,0.5,
			0.0,0.0,0.0,0.5,
			0.0,0.0,0.0,0.5,
			0.0,0.0,0.0,0.5,
		]
		let offsets = [
			-1.0, 1.0,
			-1.0,-1.0,
			 1.0,-1.0,
			 1.0, 1.0,
			-1.0, 1.0,
			-1.0,-1.0,
			 1.0,-1.0,
			 1.0, 1.0,
			-1.0, 1.0,
			-1.0,-1.0,
			 1.0,-1.0,
			 1.0, 1.0,
		]
		let sizes = [
			20.0,
			20.0,
			20.0,
			20.0,
			30.0,
			30.0,
			30.0,
			30.0,
			40.0,
			40.0,
			40.0,
			40.0,
		]
		let strokeWidths = [
			1.0,
			1.0,
			1.0,
			1.0,
			3.0,
			3.0,
			3.0,
			3.0,
			2.0,
			2.0,
			2.0,
			2.0,
		]

		const indexBuffer = this.markerShader.indexBuffer || gl.createBuffer()
		this.markerShader.indexBuffer = indexBuffer
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)

		const vertexBuffer = this.markerShader.vertexBuffer || gl.createBuffer()
		this.markerShader.vertexBuffer = vertexBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)

		const fillColorBuffer = this.markerShader.fillColorBuffer || gl.createBuffer()
		this.markerShader.colorBuffer = fillColorBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, fillColorBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fillColors), gl.STATIC_DRAW)

		const strokeColorBuffer = this.markerShader.strokeColorBuffer || gl.createBuffer()
		this.markerShader.colorBuffer = strokeColorBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, strokeColorBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(strokeColors), gl.STATIC_DRAW)

		const offsetBuffer = this.markerShader.offsetBuffer || gl.createBuffer()
		this.markerShader.offsetBuffer = offsetBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(offsets), gl.STATIC_DRAW)

		const sizeBuffer = this.markerShader.sizeBuffer || gl.createBuffer()
		this.markerShader.sizeBuffer = sizeBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.STATIC_DRAW)

		const strokeWidthBuffer = this.markerShader.strokeWidthBuffer || gl.createBuffer()
		this.markerShader.strokeWidthBuffer = strokeWidthBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, strokeWidthBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(strokeWidths), gl.STATIC_DRAW)



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

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
		gl.vertexAttribPointer(shader.attribLocations.geoVertexPos, 2, gl.FLOAT, false, 0, 0)
		gl.enableVertexAttribArray(shader.attribLocations.geoVertexPos)
		gl.bindBuffer(gl.ARRAY_BUFFER, fillColorBuffer)
		gl.vertexAttribPointer(shader.attribLocations.fillColor, 4, gl.FLOAT, false, 0, 0)
		gl.enableVertexAttribArray(shader.attribLocations.fillColor)
		gl.bindBuffer(gl.ARRAY_BUFFER, strokeColorBuffer)
		gl.vertexAttribPointer(shader.attribLocations.strokeColor, 4, gl.FLOAT, false, 0, 0)
		gl.enableVertexAttribArray(shader.attribLocations.strokeColor)
		gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer)
		gl.vertexAttribPointer(shader.attribLocations.pxVertexOffsetDirection, 2, gl.FLOAT, false, 0, 0)
		gl.enableVertexAttribArray(shader.attribLocations.pxVertexOffsetDirection)
		gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer)
		gl.vertexAttribPointer(shader.attribLocations.pxMarkerSize, 1, gl.FLOAT, false, 0, 0)
		gl.enableVertexAttribArray(shader.attribLocations.pxMarkerSize)
		gl.bindBuffer(gl.ARRAY_BUFFER, strokeWidthBuffer)
		gl.vertexAttribPointer(shader.attribLocations.pxStrokeWidth, 1, gl.FLOAT, false, 0, 0)
		gl.enableVertexAttribArray(shader.attribLocations.pxStrokeWidth)

		// gl.drawArrays(gl.QUAD, 0, vertices.length/2)
		gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0)

		// draw vertices for debugging purposes
		// gl.pointSize(40)
		// gl.drawArrays(gl.POINTS, 0, vertices.length/2)
	}

	glDraw(gl) {

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
			let xpix = this.longitudeToViewPixel(i)
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
			let ypix = this.latitudeToViewPixel(i)
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

		// console.log(`zoomFactor ${Math.log2(zoomFactor)} (${zoomFactor}) zoomLevel ${map.getZoom()} (${Math.pow(2.0, map.getZoom())})`)

		this.longitudeToViewPixel = function(longitude) {
			// geo == mercator for longitude
			// original:
			// return 0.5*canvasWidth + pixelScale*(pixsw.x + (longitude - geosw.lng())/geoWidth*pixWidth)

			// shift removed from inside
			// 
			return pixelScale*pixWidth/geoWidth*(0.5*geoWidth + pixsw.x/pixWidth*geoWidth - geosw.lng() + longitude)

		}

		this.latitudeToMercator = function(latitude) {
			let lntany = (180.0/Math.PI)*Math.log(Math.tan(Math.PI*0.25 + latitude*(Math.PI/180.0*0.5)))
			return lntany
		}
		// height in "projected" space
		let geoHeight = this.latitudeToMercator(geone.lat()) - this.latitudeToMercator(geosw.lat())

		this.latitudeToViewPixel = function(latitude) {
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
			let xpix = this.longitudeToViewPixel(i)
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
			let ypix = this.latitudeToViewPixel(i)
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

} // class MapOverlay
