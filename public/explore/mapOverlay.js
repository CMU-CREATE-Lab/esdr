

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

			this.glDrawGeoGrid()
		}

	}

	_loadShader(gl, type, source) {
	  const shader = gl.createShader(type);

	  gl.shaderSource(shader, source);

	  gl.compileShader(shader);

	  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
	    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
	    gl.deleteShader(shader);
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
  	this.shaderProgram = this._initShaderProgram(gl, vertexShader, fragmentShader)

  	this.attribLocations = {
  		vertexPos: gl.getAttribLocation(this.shaderProgram, "vertexPos"),
  		color: gl.getAttribLocation(this.shaderProgram, "colorIn"),
  	}

  	this.uniformLocations = {
  		modelViewMatrix: gl.getUniformLocation(this.shaderProgram, "modelViewMatrix"),
  		projectionMatrix: gl.getUniformLocation(this.shaderProgram, "projectionMatrix"),
  	}

	}

	glDrawGeoGrid() {
		let gl = this.gl
		let map = this.getMap()
		let mapBounds = map.getBounds()
		let geosw = (mapBounds.getSouthWest())
		let geone = (mapBounds.getNorthEast())
		// let pixelScale = window.devicePixelRatio || 1.0

		let vertices = []
		let colors = []


		for (let i = Math.ceil(geosw.lng()); i < geone.lng(); i++)
		{
			let xpix = this.longitudeToPixel(i)
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
			let ypix = this.latitudeToPixel(i)
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

		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
		gl.clearColor(0.0, 0.0, 0.0, 0.0)
		gl.clear(gl.COLOR_BUFFER_BIT)
		gl.lineWidth(1.0)

		const PM = [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		]
		// const MV = PM
		const MV = [
			2.0/this.canvas.width, 											 0, 0, 0,
			                    0, -2.0/this.canvas.height, 0, 0,
													0, 									 	 	 0, 1, 0,
											 -1.0, 									   1.0, 0, 1
		]

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
		gl.vertexAttribPointer(this.attribLocations.vertexPos, 2, gl.FLOAT, false, 0, 0)
		gl.enableVertexAttribArray(this.attribLocations.vertexPos)
		gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
		gl.vertexAttribPointer(this.attribLocations.color, 4, gl.FLOAT, false, 0, 0)
		gl.enableVertexAttribArray(this.attribLocations.color)

		gl.useProgram(this.shaderProgram)
		gl.uniformMatrix4fv(this.uniformLocations.modelViewMatrix, false, MV)
		gl.uniformMatrix4fv(this.uniformLocations.projectionMatrix, false, PM)

		// gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertices.length/2)
		gl.drawArrays(gl.LINES, 0, vertices.length/2)


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

		// console.log(`pixscale ${pixne.x - pixsw.x}, ${this.canvas.style.width} lng ${geosw.lng()}, ${geone.lng()} geoscale ${geone.lng() - geosw.lng()}`)

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

		this.longitudeToPixel = function(longitude) {
			return 0.5*canvasWidth + pixelScale*(pixsw.x + (longitude - geosw.lng())/geoWidth*pixWidth)
		}

		this.latitudeToMercator = function(latitude) {
			let lntany = (180.0/Math.PI)*Math.log(Math.tan(Math.PI*0.25 + latitude*(Math.PI/180.0*0.5)))
			return lntany
		}
		// height in "projected" space
		let geoHeight = this.latitudeToMercator(geone.lat()) - this.latitudeToMercator(geosw.lat())

		this.latitudeToPixel = function(latitude) {
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

		// console.log(`pixscale ${pixne.x - pixsw.x}, ${this.canvas.style.width} lng ${geosw.lng()}, ${geone.lng()} geoscale ${geone.lng() - geosw.lng()}`)

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

		let longitudeToPixel = function(longitude) {
			return 0.5*canvasWidth + pixelScale*(pixsw.x + (longitude - geosw.lng())/geoWidth*pixWidth)
		}

		let latitudeToMercator = function(latitude) {
			let lntany = (180.0/Math.PI)*Math.log(Math.tan(Math.PI*0.25 + latitude*(Math.PI/180.0*0.5)))
			return lntany
		}
		// height in "projected" space
		let geoHeight = latitudeToMercator(geone.lat()) - latitudeToMercator(geosw.lat())

		let latitudeToPixel = function(latitude) {
			return 0.5*canvasHeight + pixelScale*(pixsw.y + (latitudeToMercator(latitude) - latitudeToMercator(geosw.lat()))/geoHeight*pixHeight)
		}


		// draw lon/lat grid for test purposes
		for (let i = Math.ceil(geosw.lng()); i < geone.lng(); i++)
		{
			let xpix = longitudeToPixel(i)
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
			let ypix = latitudeToPixel(i)
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
