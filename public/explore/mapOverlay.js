

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


			// let ctx = this.canvas.getContext("2d")
			// ctx.font = '48px serif';
			// ctx.fillStyle = 'rgba(200, 0, 0, 0.2)';
			// ctx.fillRect(10.0, 10.0, clientBounds.width-20.0, clientBounds.height-20.0);

			// ctx.fillStyle = 'rgb(0, 200, 0)';
			// ctx.fillText('overlayLayer', 10, 50);

			this.drawGeoGrid()
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
