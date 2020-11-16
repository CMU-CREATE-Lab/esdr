
// so lets say we want to show sparklines
// according to grapher docs, at most 3 tiles are needed to span a given time range
// since it's 512 points per channel, we can just reserve space for 1536 markers, 
// and index into it when drawing.

// it is possible to draw lines and points with the marker shader

// line trading can be done via TRIANGLE_STRIP instead of TRIANGLES
// though as a first approximation, each segment can be drawn like a marker, without the connecting triangles between segments

/* 
	Tile info
		level.offset
		startTimestamp
		endTimestamp


	*** Tile management

	When we update the time range, we need to see if we need to fetch new tiles. Tiles that are present are all of the same level and contigous in offset. When a tile is fetched, it is attached to the buffer at the correct index.

	The buffer is circular, eg. once a tile has been placed, it will not be moved. Indices are updated when a new tile comes in, so that all tiles can be drawn with a single draw call, even if the buffer wraps.

	Tiles are indexed to form a direct-mapped cache, eg `index = offset % numTiles`.


	*** time offset issues
	
	As the unix epoch is in the 1e9 range, but a 32bit float only has a 7 digit  (24bit) mantissa, taking a difference of 2 timestamps in FP32 results in rounding errors of a second if the difference of the 2 timestamps is about 100 days.

	Thus, we need to use an offset-based value for the positions passed to GL to ensure they're shown accurately.

	So, at level 0, this is a range of ± 2^23 seconds, or in general 
		offsetRange = 2^(level+23) seconds


	*** triangle strips for lines

	vertex quads were easy, as there is no neighbour interaction

	the simples line drawing is to ignore the joints, and treat each segment separately, for now.
	lines are drawn with triangle strips instead of triangles, at 4 elements per line segment. The number of vertices is still the same.

	
*/

class ETP {

	constructor(tileDataSource) {
		this.drawPoints = false

		this.NUM_SAMPLES_PER_TILE 		= 512
		this.NUM_TILES								= 3

		this.NUM_VERTICES_PER_SAMPLE 	= 4
		this.NUM_INDICES_PER_SAMPLE 	= this.drawPoints ? 6 : 4

		this.NUM_POSITION_ELEMENTS		= 2
		this.NUM_OFFSET_ELEMENTS			= 2
		this.NUM_SIZE_ELEMENTS				= 1
		this.NUM_STROKEWIDTH_ELEMENTS	= 1
		this.NUM_FILLCOLOR_ELEMENTS		= 4
		this.NUM_STROKECOLOR_ELEMENTS	= 4

		this.glBuffers = {}

		this.tiles = (new Array(this.NUM_TILES)).fill({})

		this.tileDataSource = tileDataSource
		this.timestampOffsetDirty = true

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

	_initGl(gl) {

		// check that element indices can be UINT32, for we would like to address more than 65k vertices at a time
		var ext = gl.getExtension('OES_element_index_uint');
		if (!ext) {
			alert("OES_element_index_uint is not supported.")
			return
		}

		// if WebGL context has been successfully setup, assign it to an ivar for later use
		this.gl = gl

		const markerVertexShader = `

	    attribute vec2 pxVertexPos;
	    attribute vec2 pxVertexOffsetDirection;
	    attribute float pxMarkerSizeIn;
	    attribute float pxStrokeWidthIn;
	    attribute vec4 fillColorIn;
	    attribute vec4 strokeColorIn;

	    uniform mat4 modelViewMatrix;
	    uniform mat4 projectionMatrix;

	    varying vec2 pxCenterOffset; 
	    varying float pxMarkerSize;
	    varying float pxStrokeWidth;
	    varying vec4 fillColor;
	    varying vec4 strokeColor;

	    void main() {

	    	vec2 screenSpacePos = (modelViewMatrix * vec4(pxVertexPos, 0.0, 1.0)).xy;


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
		const lineVertexShader = `

	    attribute vec2 pxVertexPos;
	    attribute vec2 pxVertexOffsetDirection;
	    attribute float pxMarkerSizeIn;
	    attribute float pxStrokeWidthIn;
	    attribute vec4 fillColorIn;
	    attribute vec4 strokeColorIn;

	    uniform mat4 modelViewMatrix;
	    uniform mat4 projectionMatrix;

	    varying vec2 pxCenterOffset; 
	    varying float pxMarkerSize;
	    varying float pxStrokeWidth;
	    varying vec4 fillColor;
	    varying vec4 strokeColor;

	    void main() {

	    	vec2 screenSpacePos = (modelViewMatrix * vec4(pxVertexPos, 0.0, 1.0)).xy;

	    	// for line drawing, we have to account for non-uniform x/y scaling
	    	vec2 xyScale = vec2(1.0/modelViewMatrix[0][0], 1.0/modelViewMatrix[1][1]);
	    	float xyScaleLength = length(xyScale);
	    	float preLength = length(pxVertexOffsetDirection);
	    	vec2 vertexOffsetDirection = xyScale*pxVertexOffsetDirection;
	    	float postLength = length(vertexOffsetDirection);
	    	vertexOffsetDirection *= preLength/postLength;

	    	// offset vertex by direction and size of marker
	    	// actual offset is 1px bigger than markerSize to leave room for AA
	    	vec2 pxOffset = vertexOffsetDirection*(0.5*pxMarkerSizeIn + pxStrokeWidthIn + 1.0);
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

  	this.markerShader = {
  		shaderProgram: this._initShaderProgram(gl, this.drawPoints ? markerVertexShader : lineVertexShader, markerFragmentShader),
  	}
  	this.markerShader.attribLocations = {
  		pxVertexPos: 							gl.getAttribLocation(this.markerShader.shaderProgram, "pxVertexPos"),
  		pxVertexOffsetDirection: 	gl.getAttribLocation(this.markerShader.shaderProgram, "pxVertexOffsetDirection"),
  		pxMarkerSize: 						gl.getAttribLocation(this.markerShader.shaderProgram, "pxMarkerSizeIn"),
  		pxStrokeWidth: 						gl.getAttribLocation(this.markerShader.shaderProgram, "pxStrokeWidthIn"),
  		fillColor: 								gl.getAttribLocation(this.markerShader.shaderProgram, "fillColorIn"),
  		strokeColor: 							gl.getAttribLocation(this.markerShader.shaderProgram, "strokeColorIn"),  		
  	}
  	this.markerShader.uniformLocations = {
  		modelViewMatrix: 	gl.getUniformLocation(this.markerShader.shaderProgram, "modelViewMatrix"),
  		projectionMatrix: 	gl.getUniformLocation(this.markerShader.shaderProgram, "projectionMatrix"),

  	}

		this.allocateGlBuffers(gl)

	}

	allocateGlBuffers(gl) {
		let buffers = this.glBuffers

		let bufferBase = this.NUM_SAMPLES_PER_TILE*this.NUM_TILES*this.NUM_VERTICES_PER_SAMPLE*Float32Array.BYTES_PER_ELEMENT

		buffers.positionBuffer = buffers.positionBuffer || gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, bufferBase*this.NUM_POSITION_ELEMENTS, gl.STATIC_DRAW)

		buffers.offsetBuffer = buffers.offsetBuffer || gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.offsetBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, bufferBase*this.NUM_OFFSET_ELEMENTS, gl.STATIC_DRAW)

		buffers.sizeBuffer = buffers.sizeBuffer || gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.sizeBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, bufferBase*this.NUM_SIZE_ELEMENTS, gl.STATIC_DRAW)

		buffers.strokeWidthBuffer = buffers.strokeWidthBuffer || gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.strokeWidthBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, bufferBase*this.NUM_STROKEWIDTH_ELEMENTS, gl.STATIC_DRAW)

		buffers.fillColorBuffer = buffers.fillColorBuffer || gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.fillColorBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, bufferBase*this.NUM_FILLCOLOR_ELEMENTS, gl.STATIC_DRAW)

		buffers.strokeColorBuffer = buffers.strokeColorBuffer || gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.strokeColorBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, bufferBase*this.NUM_STROKECOLOR_ELEMENTS, gl.STATIC_DRAW)

		buffers.indexBuffer = buffers.indexBuffer || gl.createBuffer()
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.NUM_SAMPLES_PER_TILE*this.NUM_TILES*this.NUM_INDICES_PER_SAMPLE*Uint32Array.BYTES_PER_ELEMENT, gl.STATIC_DRAW)
	}


	bindGlBuffers(gl, shader) {
		let buffers = this.glBuffers

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)

		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
		gl.vertexAttribPointer(shader.attribLocations.pxVertexPos, this.NUM_POSITION_ELEMENTS, gl.FLOAT, false, 0, 0)

		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.offsetBuffer)
		gl.vertexAttribPointer(shader.attribLocations.pxVertexOffsetDirection, this.NUM_OFFSET_ELEMENTS, gl.FLOAT, false, 0, 0)

		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.sizeBuffer)
		gl.vertexAttribPointer(shader.attribLocations.pxMarkerSize, this.NUM_SIZE_ELEMENTS, gl.FLOAT, false, 0, 0)

		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.strokeWidthBuffer)
		gl.vertexAttribPointer(shader.attribLocations.pxStrokeWidth, this.NUM_STROKEWIDTH_ELEMENTS, gl.FLOAT, false, 0, 0)

		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.fillColorBuffer)
		gl.vertexAttribPointer(shader.attribLocations.fillColor, this.NUM_FILLCOLOR_ELEMENTS, gl.FLOAT, false, 0, 0)

		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.strokeColorBuffer)
		gl.vertexAttribPointer(shader.attribLocations.strokeColor, this.NUM_FILLCOLOR_ELEMENTS, gl.FLOAT, false, 0, 0)

	}

	static _genTiles(level, startOffset, endOffset) {
		let tiles = []
		for (let i = startOffset; i < endOffset; i++) {
			tiles.push({level: level, offset: i})
		}
		return tiles
	}

	getTilesToFetch(level, startOffset, endOffset) {
		// it should always be 3 tiles max to a fetch
		console.assert(endOffset - startOffset <= 3)

		if (this.tileLevel != level) {
			// all new tiles, simple
			return ETP._genTiles(level, startOffset, endOffset)
		}
		else {
			// we already have tiles at this level
			// so figure out which we have to get
			if (startOffset < this.tileStartOffset) {
				return ETP._genTiles(level, startOffset, Math.min(endOffset, this.tileStartOffset))
			}
			else if (endOffset >= this.tileEndOffset) {
				return ETP._genTiles(level, Math.max(startOffset, this.tileEndOffset), endOffset)
			}
			else {
				return []
			}
		}
	}

	setPlotRange(range) {
		let level = ESDR.computeDataTileLevel(range)
		let startOffset = ESDR.computeDataTileOffset(range.min, level)
		let endOffset = 1 + ESDR.computeDataTileOffset(range.max, level)

		let tilesToFetch = this.getTilesToFetch(level, startOffset, endOffset)

		this.plotRange = range
		this.tileLevel = level
		this.tileStartOffset = startOffset
		this.tileEndOffset = endOffset

		tilesToFetch.forEach(tile => this.fetchTile(tile))
	}

	_tileInCurrentRange(level, offset) {
		return (level == this.tileLevel) && (offset >= this.tileStartOffset) && (offset < this.tileEndOffset)
	}

	fetchTile({level, offset}) {
		if (!this.tileDataSource) {
			console.warn("attempting to fetch tile without data source in place, ignoring")
			return
		}

		let plotter = this

		this.tileDataSource(level, offset, function(tileJson) {
			if (!plotter._tileInCurrentRange(level, offset)) {
				// if data is returned for tiles that aren't in current range, ignore them
				return
			}

			// so we have a valid tile, let's see if we already have it
			let tileIndex = offset % plotter.NUM_TILES
			let tile = plotter.tiles[tileIndex]

			if (tile && tile.offset == offset) {
				// if we already have this tile, ignore the new data
				return
			}

			// we actually have a new tile 
			tile = {
				index: tileIndex,
				level: level,
				offset: offset,
				// filter rows of [time, mean, stdev, count] so that only count > 0 is kept
				data: tileJson.data.filter(sample => sample[3] > 0),
				isPositionDirty: true,
				areIndicesDirty: true,
				areAttributesDirty: true,
			}

			plotter.tiles[tileIndex] = tile

			// kick off processing
			plotter._tileReceived(tileIndex)
		})
	}

	_tileReceived(tileIndex) {
		let tile = this.tiles[tileIndex]

		// console.log(`ETP received tile ${tile.level}.${tile.offset} at #${tileIndex} with ${tile.data.length} samples`)

		// if the new tile is outside of the current offset range, we have to recompute vertex positions
		if (!this.timestampOffsetDirty) {
			let startTileTime = ESDR.computeDataTileStartTime(tile.level, tile.offset)
			let endTileTime = ESDR.computeDataTileStartTime(tile.level, tile.offset+1)

			let offsetRange = Math.pow(2, 23 + this.tileLevel)
			if (Math.max(Math.abs(this.timestampOffset - startTileTime), Math.abs(this.timestampOffset - endTileTime)) > offsetRange) {
				this.timestampOffsetDirty = true
			}
		}

	}

	_updateGlBuffers(gl) {

		if (this.timestampOffsetDirty) {

			let startTime = this.plotRange.min
			let endTime = this.plotRange.max

			// compute new offset in the middle of current range
			this.timestampOffset = 0.5*(startTime + endTime)

			// dirty all tiles' positions, as their positions have to be updated for new offset
			this.tiles.forEach(tile => tile.isPositionDirty = true)
			this.timestampOffsetDirty = false

		}

		let buffers = this.glBuffers

		let indices = new Array(this.tiles.length).fill([])
		let indexTimes = new Array(this.tiles.length).fill([])
		let indexValues = new Array(this.tiles.length).fill([])
		let indicesDirty = false

		// find out which order the tiles are in, in time
		// since tiles are always ordered right, we just need to find the 1st
		let activeTiles = this.tiles.filter(tile => tile.level == this.tileLevel)
		let {index: firstTileIndex} = activeTiles.reduce((acc, tile, i) => {
			if (tile.offset < acc.offset)
				return {offset: tile.offset, index: tile.index}
			else
				return acc
		}, {offset: Infinity, index: -1})

		// 1. map to [offset, tileIndex]
		// 2. sort by offset
		// 3. create map with {tileIndex, order}
		// let tileOrderMap = new Map(this.tiles.map((tile, i) => [tile.offset, i]).sort((a,b) => a[0] - b[0]).map( (e, order) => [e[1], order]))

		activeTiles.forEach(tile => {
			// do this only for ACTIVE tiles that match our tileLevel
			let tileIndex = tile.index

			let indexOffset = tileIndex*this.NUM_SAMPLES_PER_TILE*this.NUM_VERTICES_PER_SAMPLE

			if (tile.isPositionDirty && tile.data) {

				let samples = tile.data
				tile.positions = samples.map(sample => [sample[0] - this.timestampOffset, sample[1]])
				// FIXME: debugging positions
				// let levelScale = Math.pow(2, tile.level)
				// tile.positions = samples.map((sample, i) => [levelScale*(512*tileIndex + i), i])
				// tile.positions = samples.map((sample, i) => [sample[0] - this.timestampOffset, i])

				let positions = tile.positions.map(pos => [pos, pos, pos, pos]).flat()

				gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
				// make sure to put vertices into the alloted window, even if its not filled
				let dstByteOffset = indexOffset*this.NUM_POSITION_ELEMENTS*Float32Array.BYTES_PER_ELEMENT
				gl.bufferSubData(gl.ARRAY_BUFFER, dstByteOffset, new Float32Array(positions.flat()))


				tile.isPositionDirty = false
			}

			if (tile.areIndicesDirty) {

				if (this.drawPoints) {
					tile.indices = tile.positions.map( (position, i) => [4*i + 0, 4*i + 1, 4*i + 2, 4*i + 2, 4*i + 3, 4*i + 0].map(k => k + indexOffset) )
				}
				else {
					tile.indices = tile.positions.map( (position, i) => [4*i + 0, 4*i + 1, 4*i + 2, 4*i + 3].map(k => k + indexOffset) )
				}

				tile.indexTimes = tile.data.map( sample => sample[0] )
				tile.indexValues = tile.data.map( sample => sample[1] )

				indicesDirty = true
				tile.areIndicesDirty = false
			}

			let orderedIndex = (tileIndex - firstTileIndex + this.tiles.length) % this.tiles.length
			indices[orderedIndex] = tile.indices
			indexTimes[orderedIndex] = tile.indexTimes
			indexValues[orderedIndex] = tile.indexValues

			if (tile.areAttributesDirty) {

				let pixelScale = window.devicePixelRatio || 1.0

				let sizes = (new Array(tile.positions.length)).fill((new Array(4)).fill(1.0))

				let strokeWidths = (new Array(tile.positions.length)).fill((new Array(4)).fill(0.0))

				let fillColors = (new Array(tile.positions.length)).fill((new Array(4)).fill([1.0,0.0,0.0,1.0]).flat())
				let strokeColors = (new Array(tile.positions.length)).fill((new Array(4)).fill([0.0,0.0,0.0,0.0]).flat())

				if (this.drawPoints)
				{
					// points are simple
					let offsets = (new Array(tile.positions.length)).fill([
						-1.0, 1.0,
						-1.0,-1.0,
						 1.0,-1.0,
						 1.0, 1.0,
					])

					gl.bindBuffer(gl.ARRAY_BUFFER, buffers.offsetBuffer)
					let offsetsDstByte = indexOffset*this.NUM_POSITION_ELEMENTS*Float32Array.BYTES_PER_ELEMENT
					gl.bufferSubData(gl.ARRAY_BUFFER, offsetsDstByte, new Float32Array(offsets.flat()))

				} 
				else {
					let positions = tile.positions
					let segments = positions.slice(0, positions.length-1).map( (p, i) =>
						[positions[i+1][0] - positions[i][0], positions[i+1][1] - positions[i][1]]
					)
					let normals = segments.map(s => {
						let ss = s[0]*s[0] + s[1]*s[1]
						let sqrt = 1.0/Math.sqrt(ss)
						return [-s[1]*sqrt, s[0]*sqrt]
					})
					let offsets = normals.map(d => {
						return [
							[ d[0], d[1]],
							[-d[0],-d[1]],
							[ d[0], d[1]],
							[-d[0],-d[1]],
						].flat()
					})

					// pad the ends with NaNs, while we don't stitch across tiles
					offsets = [[NaN, NaN, NaN, NaN]].concat(offsets, [[NaN, NaN, NaN, NaN]])


					gl.bindBuffer(gl.ARRAY_BUFFER, buffers.offsetBuffer)
					let offsetsDstByte = indexOffset*this.NUM_POSITION_ELEMENTS*Float32Array.BYTES_PER_ELEMENT
					gl.bufferSubData(gl.ARRAY_BUFFER, offsetsDstByte, new Float32Array(offsets.flat()))

				}


				gl.bindBuffer(gl.ARRAY_BUFFER, buffers.sizeBuffer)
				let sizesDstByte = indexOffset*this.NUM_SIZE_ELEMENTS*Float32Array.BYTES_PER_ELEMENT
				gl.bufferSubData(gl.ARRAY_BUFFER, sizesDstByte, new Float32Array(sizes.flat()))

				gl.bindBuffer(gl.ARRAY_BUFFER, buffers.strokeWidthBuffer)
				let strokesDstByte = indexOffset*this.NUM_STROKEWIDTH_ELEMENTS*Float32Array.BYTES_PER_ELEMENT
				gl.bufferSubData(gl.ARRAY_BUFFER, strokesDstByte, new Float32Array(strokeWidths.flat()))

				gl.bindBuffer(gl.ARRAY_BUFFER, buffers.fillColorBuffer)
				let fillColorDstByte = indexOffset*this.NUM_FILLCOLOR_ELEMENTS*Float32Array.BYTES_PER_ELEMENT
				gl.bufferSubData(gl.ARRAY_BUFFER, fillColorDstByte, new Float32Array(fillColors.flat()))

				gl.bindBuffer(gl.ARRAY_BUFFER, buffers.strokeColorBuffer)
				let strokeColorDstByte = indexOffset*this.NUM_STROKECOLOR_ELEMENTS*Float32Array.BYTES_PER_ELEMENT
				gl.bufferSubData(gl.ARRAY_BUFFER, strokeColorDstByte, new Float32Array(strokeColors.flat()))


				tile.areAttributesDirty = false
			}

		})

		if (indicesDirty) {

			this.drawIndices = indices.flat()
			this.indexTimes = indexTimes.flat()
			this.indexValues = indexValues.flat()

			// console.log(`ready to show  ${this.drawIndices.length} indices`)

			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)
			gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint32Array(this.drawIndices.flat()))
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

	minMaxValueInRange(range) {
		if (!this.indexTimes)
			return {min: -1.0, max: 1.0}

		let startIndex = this._binarySearch(this.indexTimes, t => t >= range.min)
		let endIndex = this._binarySearch(this.indexTimes, t => t > range.max)

		// no drawing if we can't find the times
		if (startIndex >= this.indexTimes.length)
			return {min: -1.0, max: 1.0}

		let min = Math.min(...this.indexValues.slice(startIndex, endIndex))
		let max = Math.max(...this.indexValues.slice(startIndex, endIndex))
		let center = 0.5*(max+min)
		let diff = Math.max(0.001, max-min)
		return {
			min: center - 0.5*diff,
			max: center + 0.5*diff,
		}
	}

	_drawMarkersInRange(gl, range) {
		if (!this.indexTimes)
			return

		let startIndex = this._binarySearch(this.indexTimes, t => t >= range.min)
		let endIndex = this._binarySearch(this.indexTimes, t => t > range.max)

		// no drawing if we can't find the times
		if (startIndex == endIndex)
			return

		let numElements = endIndex - startIndex

		gl.drawElements(this.drawPoints ? gl.TRIANGLES : gl.TRIANGLE_STRIP, numElements*this.NUM_INDICES_PER_SAMPLE, gl.UNSIGNED_INT, startIndex*this.NUM_INDICES_PER_SAMPLE*Uint32Array.BYTES_PER_ELEMENT)

	}

	glDraw(gl, pxOffset, PM) {
		if (!this.gl) {
			this._initGl(gl)
		}

		// if plotRange isn't set yet, don't do any drawing
		if (!this.plotRange)
			return

		this._updateGlBuffers(gl)

		let shader = this.markerShader

		// if index buffer hasn't been set, yet, can't draw
		if (!this.glBuffers.indexBuffer)
			return

		// we want plotRange.max to be zero
		// scale 1 sample to 1px
		// let timeScale = Math.pow(2, this.tileLevel)
		let timeScale = this.plotRange.max - this.plotRange.min

		// let timeRefOffset = this.plotRange.max - this.timestampOffset
		let timeRefOffset = (this.plotRange.max - this.timestampOffset)/timeScale

		let {min: miny, max: maxy} = this.minMaxValueInRange(this.plotRange)

		let sparkWidth = 100.0
		let sparkHeight = 20.0

		let xscale = sparkWidth/timeScale
		let yscale = sparkHeight/maxy
		let xshift = pxOffset.x - sparkWidth*timeRefOffset
		let yshift = pxOffset.y

		const MV = [
		  xscale,      0, 0, 0,
		       0, yscale, 0, 0,
				 	 0,      0, 1, 0,
			xshift, yshift, 0, 1
		]

		gl.useProgram(shader.shaderProgram)
		gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
		gl.uniformMatrix4fv(shader.uniformLocations.projectionMatrix, false, PM)

		this.bindGlBuffers(gl, shader)

		this._drawMarkersInRange(gl, this.plotRange)
	}

} // class ETP
