
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

import {ESDR} from "./esdrFeeds.js"
import * as gltools from "./webgltools.js"

class ETP {

	constructor(tileDataSource, colorMapTexture, colorMapYRange) {
		this.drawPoints = false
		this.drawLines = false
		this.drawBars = true
		this.drawOverlappingBars = true

		this.lineWidth = 1.0
		this.pointSize = 1.0

		this.NUM_SAMPLES_PER_TILE 		= 512
		this.NUM_TILES								= 3

		this.NUM_VERTICES_PER_SAMPLE 	= 4
		this.NUM_INDICES_PER_POINT_SAMPLE = 6
		this.NUM_INDICES_PER_LINE_SAMPLE 	= 4
		this.NUM_INDICES_PER_BAR_SAMPLE 	= 6

		this.NUM_POSITION_ELEMENTS		= 2
		this.NUM_OFFSET_ELEMENTS			= 2
		this.NUM_SIZE_ELEMENTS				= 1
		this.NUM_STROKEWIDTH_ELEMENTS	= 1
		this.NUM_COLORMAPVALUE_ELEMENTS	= 1
		this.NUM_FILLCOLOR_ELEMENTS		= 4
		this.NUM_STROKECOLOR_ELEMENTS	= 4

		this.plotWidth = 100.0
		this.plotHeight = 20.0

		this.glBuffers = {}

		this.tiles = (new Array(this.NUM_TILES)).fill({})
		this.dataUpdatedCallback = () => undefined

		this.tileDataSource = tileDataSource
		this.timestampOffsetDirty = true

		this.setColorMap(colorMapTexture, colorMapYRange)
	}

	setColorMap(colorMapTexture, colorMapYRange) {
		if (colorMapTexture !== undefined)
			this.fillColor = [1.0, 1.0, 1.0, 1.0] // white color when color mapped
		else
			this.fillColor = [0.0, 0.0, 0.0, 0.5] // black otherwise

		if (this.colorMapTexture instanceof WebGLTexture) {
			this.gl.deleteTexture(this.colorMapTexture)
			this.colorMapTexture = undefined
		}

		this.colorMapTexture = colorMapTexture

		this.colorMapYRange = colorMapYRange || {min: 0.0, max: 100.0}

		// use this flag to mark needing to globally update buffers
		this.colorsDirty = true
	}

	//
	// Initialize a texture and load an image.
	// When the image finished loading copy it into the texture.
	//
	loadTexture(gl, url) {
		function isPowerOf2(value) {
		  return (value & (value - 1)) == 0;
		}

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

	  const image = new Image()

	  let plotter = this
	  image.onload = function() {
	  	// check if texture object was deleted while we waited for loading
	  	if (!gl.isTexture(texture))
	  			return

	    gl.bindTexture(gl.TEXTURE_2D, texture)
	    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image)

	    // // WebGL1 has different requirements for power of 2 images
	    // // vs non power of 2 images so check if the image is a
	    // // power of 2 in both dimensions.
	    // if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
	    //    // Yes, it's a power of 2. Generate mips.
	    //    gl.generateMipmap(gl.TEXTURE_2D);
	    // } else {
				// No, it's not a power of 2. Turn off mips and set
				// wrapping to clamp to edge
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
	    // }

	    plotter.dataUpdatedCallback()
	  }
	  image.src = url

	  return texture;
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


  	this.markerShader = (this.drawPoints || this.drawBars) ? gltools.createMarkerShader(gl) : gltools.createLineShader(gl)

  	// let maxAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS)
  	// console.assert(maxAttributes >= 7)

		this.allocateGlBuffers(gl)

	}

	getNumIndicesPerSample() {
		return this.drawLines ? this.NUM_INDICES_PER_LINE_SAMPLE : (this.drawPoints ? this.NUM_INDICES_PER_POINT_SAMPLE : this.NUM_INDICES_PER_BAR_SAMPLE)
	}

	allocateGlBuffers(gl) {
		let buffers = this.glBuffers

		let bufferBase = this.NUM_SAMPLES_PER_TILE*this.NUM_TILES*this.NUM_VERTICES_PER_SAMPLE

		buffers.positionBuffer = gltools.resizeArrayBuffer(gl, buffers.positionBuffer, bufferBase, this.NUM_POSITION_ELEMENTS)

		buffers.offsetBuffer = gltools.resizeArrayBuffer(gl, buffers.offsetBuffer, bufferBase, this.NUM_OFFSET_ELEMENTS)

		buffers.sizeBuffer = gltools.resizeArrayBuffer(gl, buffers.sizeBuffer, bufferBase, this.NUM_SIZE_ELEMENTS)

		buffers.strokeWidthBuffer = gltools.resizeArrayBuffer(gl, buffers.strokeWidthBuffer, bufferBase, this.NUM_STROKEWIDTH_ELEMENTS)

		buffers.colorMapValueBuffer = gltools.resizeArrayBuffer(gl, buffers.colorMapValueBuffer, bufferBase, this.NUM_COLORMAPVALUE_ELEMENTS)

		buffers.fillColorBuffer = gltools.resizeArrayBuffer(gl, buffers.fillColorBuffer, bufferBase, this.NUM_FILLCOLOR_ELEMENTS)

		buffers.strokeColorBuffer = gltools.resizeArrayBuffer(gl, buffers.strokeColorBuffer, bufferBase, this.NUM_STROKECOLOR_ELEMENTS)


		buffers.indexBuffer = gltools.resizeElementArrayBuffer(gl, buffers.indexBuffer, this.NUM_SAMPLES_PER_TILE*this.NUM_TILES*this.getNumIndicesPerSample())
	}


	bindGlBuffers(gl, shader) {
		let buffers = this.glBuffers

		gltools.bindArrayBuffer(gl, buffers.positionBuffer, shader.attribLocations.vertexPos, this.NUM_POSITION_ELEMENTS)

		gltools.bindArrayBuffer(gl, buffers.offsetBuffer, shader.attribLocations.pxVertexOffsetDirection, this.NUM_OFFSET_ELEMENTS)

		gltools.bindArrayBuffer(gl, buffers.sizeBuffer, shader.attribLocations.pxMarkerSize, this.NUM_SIZE_ELEMENTS)

		gltools.bindArrayBuffer(gl, buffers.strokeWidthBuffer, shader.attribLocations.pxStrokeWidth, this.NUM_STROKEWIDTH_ELEMENTS)

		gltools.bindArrayBuffer(gl, buffers.colorMapValueBuffer, shader.attribLocations.colorMapValue, this.NUM_COLORMAPVALUE_ELEMENTS)

		gltools.bindArrayBuffer(gl, buffers.fillColorBuffer, shader.attribLocations.fillColor, this.NUM_FILLCOLOR_ELEMENTS)

		gltools.bindArrayBuffer(gl, buffers.strokeColorBuffer, shader.attribLocations.strokeColor, this.NUM_STROKECOLOR_ELEMENTS)

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer)

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
		console.assert(isFinite(range.min))
		console.assert(isFinite(range.max))
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

			// filter rows of [time, mean, stdev, count] so that only count > 0 is kept
			// replace mean with NaN to get a line break
			// let tileData tileJson.data.filter(sample => sample[3] > 0)
			let tileData = tileJson.data.map(sample => sample[3] > 0 ? sample : [sample[0], NaN, sample[2], sample[3]])

			// we actually have a new tile 
			tile = {
				index: tileIndex,
				level: level,
				offset: offset,
				data: tileData,
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

		this.dataUpdatedCallback()
	}

	getPrevPositionToConnectToTile(tileIndex) {
		let tile = this.tiles[(tileIndex + this.NUM_TILES) % this.NUM_TILES]
		let prevTile = this.tiles[(tileIndex-1 + this.NUM_TILES) % this.NUM_TILES]
		if ((tile.level == prevTile.level) && (prevTile.offset == tile.offset-1) && (prevTile.data.length > 0))
			return prevTile.data.slice(-1).map(s => [s[0] - this.timestampOffset, s[1]])
		else {
			return [[NaN, NaN]]
		}
	}

	getNextPositionToConnectToTile(tileIndex) {
		let tile = this.tiles[(tileIndex + this.NUM_TILES) % this.NUM_TILES]
		let nextTile = this.tiles[(tileIndex+1 + this.NUM_TILES) % this.NUM_TILES]
		if ((tile.level == nextTile.level) && (nextTile.offset == tile.offset+1) && (nextTile.data.length > 0))
			return nextTile.data.slice(0,1).map(s => [s[0] - this.timestampOffset, s[1]])
		else {
			return [[NaN, NaN]]
		}
	}


	isTilePositionDirty(tileIndex) {
		let tile = this.tiles[(tileIndex + this.NUM_TILES) % this.NUM_TILES]
		return (tile.level == this.tileLevel) && tile.isPositionDirty

	}

	_updateGlBuffers(gl) {

		// load colormap
		if (this.colorMapTexture === undefined)
			this.colorMapTexture = gltools.createWhiteTexture(gl)
		else if (typeof this.colorMapTexture === "string")
			this.colorMapTexture = this.loadTexture(gl, this.colorMapTexture)


		if (this.timestampOffsetDirty) {

			let startTime = this.plotRange.min
			let endTime = this.plotRange.max

			// compute new offset in the middle of current range
			this.timestampOffset = 0.5*(startTime + endTime)

			// dirty all tiles' positions, as their positions have to be updated for new offset
			this.tiles.forEach(tile => tile.isPositionDirty = true)
			this.tiles.forEach(tile => tile.areAttributesDirty = true)

		}

		if (this.colorsDirty) {
			this.tiles.forEach(tile => tile.areAttributesDirty = true)
		}

    let pixelScale = window.devicePixelRatio || 1.0

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

			// check if neighbouring tiles have been dirtied, which means we have to redo the beginning/end segments
			// and this means attributes (as offsets that have to be recomputed for the connecting segments are attributes)
			let areNeighbourPositionsDirty = this.isTilePositionDirty(tileIndex-1) || this.isTilePositionDirty(tileIndex+1)
			let isPositionDirty = tile.isPositionDirty
			let areAttributesDirty = tile.areAttributesDirty || areNeighbourPositionsDirty

			if (isPositionDirty && tile.data) {

				let samples = tile.data
				tile.positions = samples.map(sample => [sample[0] - this.timestampOffset, sample[1]])
				// FIXME: debugging positions
				// let levelScale = Math.pow(2, tile.level)
				// tile.positions = samples.map((sample, i) => [levelScale*(512*tileIndex + i), i])
				// tile.positions = samples.map((sample, i) => [sample[0] - this.timestampOffset, i])

				let positions = (this.drawPoints || this.drawLines) ? tile.positions.map(pos => [pos, pos, pos, pos]).flat() : tile.positions.map(pos => [pos, [pos[0], 0.0], pos, [pos[0], 0.0]]).flat()
				// let positions = tile.positions.map(pos => [pos, pos, pos, pos]).flat()

				gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
				// make sure to put vertices into the alloted window, even if its not filled
				let dstByteOffset = indexOffset*this.NUM_POSITION_ELEMENTS*Float32Array.BYTES_PER_ELEMENT
				gl.bufferSubData(gl.ARRAY_BUFFER, dstByteOffset, new Float32Array(positions.flat()))

				// colormap based on y-value
				let colorMapValues = tile.positions.map(pos => [pos[1], pos[1], pos[1], pos[1]]).flat()

				gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colorMapValueBuffer)
				let dstByteColor = indexOffset*this.NUM_COLORMAPVALUE_ELEMENTS*Float32Array.BYTES_PER_ELEMENT
				gl.bufferSubData(gl.ARRAY_BUFFER, dstByteColor, new Float32Array(colorMapValues.flat()))

			}

			if (tile.areIndicesDirty) {

				if (this.drawPoints) {
					tile.indices = tile.positions.map( (position, i) => [4*i + 0, 4*i + 1, 4*i + 2, 4*i + 2, 4*i + 3, 4*i + 0].map(k => k + indexOffset) )
				}
				else if (this.drawBars) {
					tile.indices = tile.positions.map( (position, i) => [4*i + 0, 4*i + 1, 4*i + 2, 4*i + 2, 4*i + 1, 4*i + 3].map(k => k + indexOffset) )
				}
				else if (this.drawLines) {
					tile.indices = (tile.positions.map( (position, i) => [4*i + 0, 4*i + 1, 4*i + 2, 4*i + 3].map(k => k + indexOffset) ))
				}

				tile.indexTimes = tile.data.map( sample => sample[0] )
				tile.indexValues = tile.data.map( sample => sample[1] )

				indicesDirty = true
			}

			let orderedIndex = (tileIndex - firstTileIndex + this.tiles.length) % this.tiles.length
			indices[orderedIndex] = tile.indices
			indexTimes[orderedIndex] = tile.indexTimes
			indexValues[orderedIndex] = tile.indexValues

			if (areAttributesDirty) {

				// let pixelScale = window.devicePixelRatio || 1.0
				// half spacing between samples
				let sampleSpacing = Math.pow(2, tile.level)
				let sizes = []

				if ((tile.positions.length > 1 ) && this.drawBars) {
					// let tileStart = (ESDR.computeDataTileStartTime(tile.level, tile.offset) - this.timestampOffset)
					// let tileEnd = (ESDR.computeDataTileStartTime(tile.level, tile.offset+1) - this.timestampOffset)
					let xspacings = tile.positions.slice(0,-1).map((pos, i) => 0.5*(tile.positions[i+1][0] - pos[0]))
					// add beginning and end spacings
					let xspacings1 = [xspacings[0]].concat(xspacings)
					let xspacings2 = xspacings.concat(xspacings.slice(-1))
					let minspacings = xspacings1.map((s, i) => 2.0*Math.min(xspacings1[i], xspacings2[i]))
					sizes =  minspacings.map(s => [s, s, s, s])
				}
				else if (this.drawLines) {
					sizes = (new Array(tile.positions.length)).fill((new Array(4)).fill(this.lineWidth))
				}
				else if (this.drawPoints) {
					sizes = (new Array(tile.positions.length)).fill((new Array(4)).fill(this.pointSize))
				}

				let strokeWidths = (new Array(tile.positions.length)).fill((new Array(4)).fill(1.0/pixelScale))

				let fillColors = (new Array(tile.positions.length)).fill((new Array(4)).fill(this.fillColor).flat())
				// make stroke and fill the same for proper blend even with zero stroke width
				let strokeColors = fillColors

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
				else if (this.drawBars)
				{
					// bars are simple, going left to right
					// y component has to be zero for interpolation of offset distance to work right for fragment shader
					let offsets = (new Array(tile.positions.length)).fill([
						-1.0, 0.0,
						-1.0,-0.0,
						 1.0, 0.0,
						 1.0,-0.0,
					])

					gl.bindBuffer(gl.ARRAY_BUFFER, buffers.offsetBuffer)
					let offsetsDstByte = indexOffset*this.NUM_POSITION_ELEMENTS*Float32Array.BYTES_PER_ELEMENT
					gl.bufferSubData(gl.ARRAY_BUFFER, offsetsDstByte, new Float32Array(offsets.flat()))

				} 
				else if (this.drawLines) {
					let prevPos = this.getPrevPositionToConnectToTile(tileIndex)
					let nextPos = this.getNextPositionToConnectToTile(tileIndex)

					let positions = prevPos.concat(tile.positions, nextPos)
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
						]
					}).flat()

					// remove the two ends
					offsets = offsets.slice(2,-2)


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


			}

		})

		// remove dirty flags AFTER the update loop, as neighbouring tiles check on each other for connecting segment updates
		activeTiles.forEach(tile => {
			tile.areAttributesDirty = false
			tile.areIndicesDirty = false
			tile.isPositionDirty = false
		})
		this.timestampOffsetDirty = false
		this.colorsDirty = false

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

	getValueAroundTime(requestedTime, isInterpolated) {

		if (!requestedTime || !this.indexTimes || !this.indexTimes.length)
			return undefined

		let afterIndex = this._binarySearch(this.indexTimes, t => t > requestedTime)
		let beforeIndex = Math.max(0, afterIndex - 1)

		// limit after to last entry
		afterIndex = Math.min(afterIndex, this.indexTimes.length - 1)

		if (beforeIndex == afterIndex)
			return this.indexValues[beforeIndex]

		let beforeTime = this.indexTimes[beforeIndex]
		let afterTime = this.indexTimes[afterIndex]

		let u = (requestedTime - beforeTime)/(afterTime - beforeTime)

		if (isInterpolated)
			return this.indexValues[beforeIndex]*(1.0-u) + this.indexValues[afterIndex]*u
		else 
			return u < 0.5 ? this.indexValues[beforeIndex] : this.indexValues[afterIndex]
	}

	minMaxValueInRange(range) {
		if (!this.indexTimes || !range)
			return {min: -1.0, max: 1.0}

		let startIndex = this._binarySearch(this.indexTimes, t => t >= range.min)
		let endIndex = this._binarySearch(this.indexTimes, t => t > range.max)

		// no drawing if we can't find the times
		if (startIndex >= this.indexTimes.length)
			return {min: -1.0, max: 1.0}

		// filter out any non-finite numbers that could screw up the min/max
		let validValues = this.indexValues.slice(startIndex, endIndex).filter(y => isFinite(y))

		let min = Math.min(...validValues)
		let max = Math.max(...validValues)
		let center = 0.5*(max+min)
		let diff = Math.max(0.001, max-min)

		if (!isFinite(center))
			center = 0.0

		let valueRange = {
			min: center - 0.5*diff,
			max: center + 0.5*diff,
		}

		console.assert(isFinite(valueRange.min))
		console.assert(isFinite(valueRange.max))

		return valueRange
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

		gl.drawElements((this.drawPoints || this.drawBars) ? gl.TRIANGLES : gl.TRIANGLE_STRIP, numElements*this.getNumIndicesPerSample(), gl.UNSIGNED_INT, startIndex*this.getNumIndicesPerSample()*Uint32Array.BYTES_PER_ELEMENT)

	}

	getVisibleValueRange() {
		let valueRange = this.minMaxValueInRange(this.plotRange)

		// clip to zero if not considering negatives for auto-ranging
		if (!this.isAutoRangingNegatives)
			valueRange.min = 0.0

		let delta = valueRange.max - valueRange.min
		return {min: valueRange.min - 0.05*delta, max: valueRange.max + 0.05*delta}
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

		let {min: miny, max: maxy} = this.getVisibleValueRange()

		// assume that outer coord space is CSS (0,0) at top-left
		// but graph is GL (0,0) at bottom left
		let xscale = this.plotWidth/timeScale
		let yscale = this.plotHeight/(maxy-miny)
		let xshift = pxOffset.x - this.plotWidth*timeRefOffset
		let yshift = pxOffset.y - this.plotHeight + maxy*yscale

		const MV = [
		  xscale,      0, 0, 0,
		       0, -yscale, 0, 0,
				 	 0,      0, 1, 0,
			xshift, yshift, 0, 1
		]

		let sampleSpacing = (0.95 + 0.05*this.drawOverlappingBars)
		let markerScale = this.drawBars ? this.plotWidth*sampleSpacing / timeScale : 1.0

		// gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
		gl.enable(gl.BLEND)
		gl.disable(gl.DEPTH_TEST)

		gl.useProgram(shader.shaderProgram)
		gl.uniformMatrix4fv(shader.uniformLocations.modelViewMatrix, false, MV)
		gl.uniformMatrix4fv(shader.uniformLocations.projectionMatrix, false, PM)
		gl.uniform2fv(shader.uniformLocations.colorMapYRange, [this.colorMapYRange.min, this.colorMapYRange.max])
		gl.uniform1f(shader.uniformLocations.markerScale, markerScale)
		gl.uniform1f(shader.uniformLocations.pixelScale, window.devicePixelRatio || 1.0)

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.colorMapTexture)
		gl.uniform1i(shader.uniformLocations.colorMapSampler, 0)

		this.bindGlBuffers(gl, shader)

		this._drawMarkersInRange(gl, this.plotRange)
	}

} // class ETP

export {ETP}
