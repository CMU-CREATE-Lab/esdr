


class ESDR {

	constructor(geographicBounds) {
		this.numParallelRequests = 1

		this.geographicBounds = geographicBounds
		this.feeds = new Map
		this.feedIds = []
		this.apiUrl = 'https://esdr.cmucreatelab.org/api/v1'
		this.selectedChannelIds = [] // an array to respect order
		this.selectedChannels_ = {} // a map for quick testing if a channel is selected
		this.searchCallback_ = (results, isAppendUpdate) => {} // empty function initially
		this.searchQuery_ = undefined
		this.oldSearchQuery_ = undefined
		this.searchResults_ = undefined

		// tile fetching related things
		this.dataUpdateTimers = new Map()
		this.channelDataUpdateCallback = (feedId, channelName) => {}
		this.tileCache = new Map()
	}

	_separateKeywordsInSearchString(text) {
		// TODO: add support for quoted substrings
		return text.toLowerCase().split(" ")
	}

	_performSearchOn(feedIds, search) {
	  let now = Date.now() / 1000;
	  let recentThreshold = now - 30 * 24 * 60 * 60;

	  let mapBounds = (search.mapOnly && search.mapBounds) ? search.mapBounds : undefined;

	  // pre filter if we're filtering by map bounds
	  if (mapBounds && feedIds)
	  {
	  	feedIds = this.feedsInGeoBox(mapBounds.getSouthWest(), mapBounds.getNorthEast())
	  	// rejectedFeedIds = this.feedsOutsideGeoBox(mapBounds.getSouthWest(), mapBounds.getNorthEast())
	  }

		let searchText = search.text || ""
		let keywords = this._separateKeywordsInSearchString(searchText)
		let searchResults = feedIds.reduce( (results, feedId) => {
			let feed = this.feeds.get(feedId)

			// filter out feeds that are older
			if (search.recentOnly) {
				let feedLastTime = parseFloat(feed.maxTimeSecs || 0.0)
				if (feedLastTime < recentThreshold) {
					results.rejectedFeedIds.push(feedId)
					return results
				}
			}

			// reject if not on map
			if (mapBounds && ((feed.latlng && !mapBounds.contains(feed.latlng)) || !feed.latlng))
			{
					results.rejectedFeedIds.push(feedId)
					return results
			}
			

			let feedName = feed.name.toLowerCase()
			let feedIdString = feedId.toString()

			// match keywords to feed name substring or feedId exact match
			let isBooleanAndSearch = true

			let feedWordMatch = word => (feedName.indexOf(word) > -1) || (feedIdString == word)

			let feedMatches = isBooleanAndSearch ? keywords.every( feedWordMatch ) : keywords.some( feedWordMatch )

			// if the feed matches the search, return a result with all channels
			if (feedMatches)
			{
				results.found.push({feedId: feedId, channels: feed.channelNames})
				return results
			}

			let channelLabels = Array.from((feed.channelLabels && feed.channelLabels.values()) || [])

			let nameMatch = isBooleanAndSearch ? (name => keywords.every(word => name.toLowerCase().indexOf(word) > -1)) : (name => keywords.some(word => name.toLowerCase().indexOf(word) > -1))

			// FIXME: this is a dirty hack to fix the channel name regression
			let channelMatches = channelLabels.filter( nameMatch ).map(label => label.slice(label.indexOf(".")+1))

			if (channelMatches.length > 0)
			{
				results.found.push({feedId: feedId, channels: channelMatches})
			}

			return results

		}, {found: [], rejectedFeedIds: []})
		return searchResults.found
	}

	static areMapBoundsEqual(a, b) {
	  return (a && b && (a.getSouthWest().lng() == b.getSouthWest().lng()) && (a.getNorthEast().lng() == b.getNorthEast().lng()) && (a.getSouthWest().lat() == b.getSouthWest().lat()) && (a.getNorthEast().lat() == b.getNorthEast().lat()))
	 }

	static hasSearchQueryChanged(oldQuery, newQuery) {
		// if we didn't have an old query, but have a new one, yes it changed
		if (!oldQuery && newQuery)
			return true

		let mapBoundsChanged = ESDR.areMapBoundsEqual(oldQuery.mapBounds, newQuery.mapBounds)
		let mapOnlyChanged = oldQuery.mapOnly == newQuery.mapOnly
		// map filter only changed if mapOnly changes, or mapOnly is now active and bounds change
		let mapFilterChanged = (mapOnly && mapBoundsChanged) || mapOnlyChanged

		let recentOnlyChanged = oldQuery.recentOnly == newQuery.recentOnly
		let searchTextChanged = oldQuery.text == newQuery.text

		return mapFilterChanged || recentOnlyChanged || searchTextChanged
	}

	_updateSearch(appendedFeedIds) {
		// empty search means all the feeds
		if (this.searchQuery_ === undefined || this.searchQuery_ == {})
		{
			let searchResults = []
			let feedIds = appendedFeedIds ? appendedFeedIds : this.feeds.keys()

			// do nothing if there's nothing to report
			if (feedIds === undefined) {
				this.searchResults_ = undefined
				this.searchCallback_([], appendedFeedIds !== undefined);
				return
			}

			for (let feedId of feedIds)
			{
				let channelNames = this.channelNamesForFeed(feedId)
				searchResults.push({feedId: feedId, channels: channelNames})
			}
			this.searchResults_ = searchResults
			this.searchCallback_(searchResults, appendedFeedIds !== undefined);
		}
		else if (!ESDR.hasSearchQueryChanged(this.oldSearchQuery_, this.searchQuery_) && appendedFeedIds)
		{
			// search only appended feeds
			this.searchResults = this._performSearchOn(appendedFeedIds, this.searchQuery_)
			this.searchCallback_(this.searchResults, false);
		}
		else if (ESDR.hasSearchQueryChanged(this.oldSearchQuery_, this.searchQuery_))
		{
			this.searchResults = this._performSearchOn(Array.from(this.feeds.keys()), this.searchQuery_)
			this.searchCallback_(this.searchResults, false);
		}
	}

	updateQuery(queryUpdate) {
		let query = Object.assign({}, this.searchQuery_ || {}, queryUpdate)
		this.searchQuery_ = query;
		this._updateSearch()
}

	set searchQuery(query) {
		this.oldSearchQuery_ = this.searchQuery_
		this.searchQuery_ = query
		this._updateSearch()
	}
	get searchQuery() {
		if (!this.searchQuery_)
			return {}
		// return a copy of the query to detect changes
		// not ideal, as deep changes wouldn't be seen
		return Object.assign({}, this.searchQuery_)
	}

	set searchCallback(callback) {
		this.searchCallback_ = callback
		this._updateSearch()
	}

	// feed is optional, if not provided it is looked up
	channelNamesForFeed(feedId, feed) {
		if (!feed)
			feed = this.feeds.get(feedId)
		if (feed && feed.channelBounds && feed.channelBounds.channels) {
			return Object.keys(feed.channelBounds.channels)
		}
		else
			return undefined
	}

	// feed is optional, if it's empty the feed is looked up
	// this is so that labels can be generated when receiving feeds
	labelForFeed(feedId, feed) {
		// try look up feed if not suppled
		if (!feed)
	  	feed = this.feeds.get(feedId)
	  // if feed is still empty, we can't name it
	  let feedName = feed ? `${feed.name} ` : ""
	  let label = `${feedName}(${feedId})`
	  return label
	}

	// feed is optional
	labelForChannel(feedId, channelName, feed) {
	  let feedLabel = this.labelForFeed(feedId, feed)
	  let label = `${feedLabel}.${channelName}`
	  return label
	}


	feedsReceived(feedsJson, endOffset, callback) {
	  // feedsJson.limit contains how big the batches are
	  let endFeedsReceived = feedsJson.rows.length + feedsJson.offset;

	  // kick off another GET if we haven't received all feeds, yet
	  if ((endFeedsReceived < endOffset) && (endFeedsReceived < feedsJson.totalCount))
	  {
	  	if (feedsJson.offset == 0) {
	  		// if this was the first batch, kick off several parallel requests
	  		let numParallelRequests = this.numParallelRequests

	  		let batchLimit = feedsJson.limit
	  		let feedsRemaining = endOffset - endFeedsReceived;
	  		let requestsRemaining = Math.ceil(feedsRemaining / batchLimit)
	  		let requestsPerWorker = Math.floor(requestsRemaining / numParallelRequests)
	  		let remainder = requestsRemaining - requestsPerWorker*numParallelRequests

	  		for (let i = 0; i < numParallelRequests; i++) {
	  			let start = requestsPerWorker*i
	  			let end = requestsPerWorker*(i+1)
	  			// the last batch handles what remains
	  			if (i+1 == numParallelRequests)
	  				end += remainder
	    		let workerStartOffset = endFeedsReceived + batchLimit*start
	    		let workerEndOffset = endFeedsReceived + batchLimit*end

	    		this.getFeedsFromOffset(workerStartOffset, (feedsJson) => this.feedsReceived(feedsJson, workerEndOffset, callback))
	  		}
	  	}
	  	else {
	    	this.getFeedsFromOffset(endFeedsReceived, (feedsJson) => this.feedsReceived(feedsJson, endOffset, callback))
	  	}
	  }

	  let feedIds = []
	  for (let feed of feedsJson.rows) {
	  	// create channel labels if feed has channels
	  	feed.channelNames = this.channelNamesForFeed(feed.id, feed)
	  	if (feed.channelNames)
	  		feed.channelLabels = new Map(feed.channelNames.map( name => [name, this.labelForChannel(feed.id, name, feed)] ))

	  	let longitude = parseFloat(feed.longitude)
	  	let latitude = parseFloat(feed.latitude)
	  	if (isFinite(longitude) && isFinite(latitude)) {
	  		feed.latlng = {lat: latitude, lng: longitude}
	  	}

	  	feedIds.push(feed.id)
	    this.feeds.set(feed.id, feed)
	  }

	  this.feedIds = this.feedIds.concat(feedIds)

	  // create map area pre-filtering structures, so that dragging things around the map aren't sluggish when filtering for map area is enabled
	  let mappedFeeds = Array.from(this.feeds.values()).filter(feed => feed.latlng)

		this.longitudeSortedFeeds = mappedFeeds.map(feed => [feed.latlng.lng, feed.id]).sort((a,b) => a[0]-b[0])
		this.latitudeSortedFeeds = mappedFeeds.map(feed => [feed.latlng.lat, feed.id]).sort((a,b) => a[0]-b[0])




	  // feeds received callback first
	  callback(feedIds, {current: this.feedIds.length, total: feedsJson.totalCount})

	  // update search results with new feeds last
	  this._updateSearch(feedIds)
	}

	/**
	 * Return 0 <= i <= array.length such that !predicate(array[i - 1]) && predicate(array[i]).
	 */
	static binarySearch(array, predicate) {
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

	feedsInGeoBox(sw, ne) {

		// binsearch lng/lat to find range covered in box
		let latArray = this.latitudeSortedFeeds || []
		let latLo = ESDR.binarySearch(latArray, e => e[0] >= sw.lat())
		let latHi = ESDR.binarySearch(latArray, e => e[0] > ne.lat())

		if (latLo >= latHi) // same indices indicate nothing found
			return []

		let lngArray = this.longitudeSortedFeeds || []
		let lngLo = ESDR.binarySearch(lngArray, e => e[0] >= sw.lng())
		let lngHi = ESDR.binarySearch(lngArray, e => e[0] > ne.lng())

		if (lngLo >= lngHi)
			return []

		// find intersection of lat/lng results, eg. only those that have both
		let lngSet = new Set(lngArray.slice(lngLo, lngHi).map(e => e[1]))
		let intersectArray = latArray.slice(latLo, latHi).map(e => e[1]).filter(e => lngSet.has(e))

		// return only the feedIds
		return intersectArray

	}

	getFeedsFromOffset(feedOffset, callback) {
	  let request = new XMLHttpRequest();
	  if (this.geographicBounds) {
	  	// if a geographicBounds is set, only get feeds in that area to speed up getting a list of sensors and more importantly their coordinates
	  	// this is for live data display in a fixed window, eg. plumeviz
	  	// https://esdr.cmucreatelab.org/api/v1/feeds?whereAnd=productId=69,latitude%3E=39.420978,latitude%3C=40.756547,longitude%3E=-81.451293,longitude%3C=-79.677010

	  	request.open('GET', `${this.apiUrl}/feeds?offset=${feedOffset}&whereAnd=latitude%3E=${this.geographicBounds.min.lat},latitude%3C=${this.geographicBounds.max.lat},longitude%3E=${this.geographicBounds.min.lng},longitude%3C=${this.geographicBounds.max.lng}`, true);

	  } else {
	  	request.open('GET', `${this.apiUrl}/feeds?offset=${feedOffset}`, true);

	  }

	  request.onload = function() {
	    if (this.status >= 200 && this.status < 400) {
	      // Success!
	      var responseJson = JSON.parse(this.response);

	      callback(responseJson.data)
	    } else {
	      // We reached our target server, but it returned an error
	      console.log(`encountenered ${this.status} as the response status trying to get ESDR feeds from offset ${feedOffset}`)
	    }
	  };

	  request.onerror = function() {
	      console.log(`encountenered an error trying to get ESDR feeds from offset ${feedOffset}`)
	  };

	  request.send();
	}

	loadFeeds(loadCallback) {
		this.getFeedsFromOffset(0, (feedsJson) => {
			this.feedsReceived(feedsJson, feedsJson.totalCount, loadCallback)
		})
	}

	selectChannelWithId(channelId, isSelected) {
		if (!isSelected && this.isChannelSelected(channelId))
		{
			this.selectedChannels_[channelId] = undefined
			this.selectedChannelIds = this.selectedChannelIds.filter( (elId) => elId != channelId )
		}
		else if (isSelected && !this.isChannelSelected(channelId))
		{
			this.selectedChannels_[channelId] = channelId
			this.selectedChannelIds.push(channelId)
		}
	}

	selectedFeeds() {
		return new Set(this.selectedChannelIds.map(channelId => parseInt(channelId.slice(0, channelId.indexOf(".")))))
	}

	isChannelSelected(channelId)
	{
		return !!this.selectedChannels_[channelId]
	}

	_dataUpdatedForChannel(feedId, channelName) {
		// this collapses calls in a 300ms window to just one call when no more updates happen
		let channelId = `${feedId}.${channelName}`
		let timer = this.dataUpdateTimers.get(channelId)

		if (timer)
			clearTimeout(timer)

		timer = setTimeout(this._dataUpdateTimeoutCallback, 300, this, channelId, feedId, channelName)
		this.dataUpdateTimers.set(channelId, timer)
	}

	_dataUpdateTimeoutCallback(esdr, channelId, feedId, channelName) {
		// use esdr as `this` is the window because this is a callback for a timer
		esdr.dataUpdateTimers.delete(channelId)

		esdr.channelDataUpdateCallback(feedId, channelName)
	}

	/**
		@return compute ESDR tile level so that graph shows at least one full tile in the given range
	*/
	static computeDataTileLevel(range) {
		let width = range.max - range.min
		return width > 0 ? Math.floor(Math.log2(width / 512)) : undefined
	}

	/**
		@return compute ESDR tile offset for a given UNIX Epoch time and tile level
	*/
	static computeDataTileOffset(time, level) {
		let tileWidth = Math.pow(2, level + 9)
		return Math.floor(time / tileWidth)
	}

	/**
		@return reverse calculation of Epoch Time at start of a tile from level and offset
	*/
	static computeDataTileStartTime(level, offset) {
		// +9 because 2^9 = 512, the number of samples per tile
		return Math.pow(2, level + 9) * offset
	}


	dataSourceForChannel(feedId, channelName) {
		let baseUrl = `${this.apiUrl}/feeds/${feedId}/channels/${channelName}/tiles`
		let esdr = this

		// create new cache data structures as necessary
		let feedCache = this.tileCache.get(feedId) || new Map
		let channelCache = feedCache.get(channelName) || new Map
		feedCache.set(channelName, channelCache)
		this.tileCache.set(feedId, feedCache)


  	return function(level, offset, callback) {
  		let tileId = `${level}.${offset}`

  		// check if it's already cached, in that case no fetching
  		let cachedTileData = esdr.tileCache.get(feedId).get(channelName).get(tileId)
  		if (typeof cachedTileData == "function") {
  			// we have a closure from a previous call waiting on the data
  			// just add our callback and wait together!
  			cachedTileData(callback)
  			return
  		}
  		else if (cachedTileData) {
  			// the cachedTileData was not a function, so it's the actual data, we can just deliver it immediately
  			callback(cachedTileData)
  			return
  		}
  		else {
  			// we have no request in progress, so lets start keeping a list of callbacks
  			// cacheFun captures the callbacks variable and adds subsequent calls to it
  			let callbacks = [callback]
  			let cacheFun = function(aCallback) {
  				if (aCallback)
  					callbacks.push(aCallback)

  				return callbacks
  			}
  			esdr.tileCache.get(feedId).get(channelName).set(tileId, cacheFun)
  		}


  		let url = `${baseUrl}/${tileId}`

	  	let request = new XMLHttpRequest();
		  request.open('GET', url, true);

		  request.onload = function() {
		    if (this.status >= 200 && this.status < 400) {
		      // Success!
		      var responseJson = JSON.parse(this.response);

		      // get and execute the cacheFun to retrieve the list of callbacks
		      let callbacks = esdr.tileCache.get(feedId).get(channelName).get(tileId)()

		      // replace callback with actual data
		      esdr.tileCache.get(feedId).get(channelName).set(tileId, responseJson.data)

		      callbacks.forEach( storedCallback => storedCallback(responseJson.data) )
		      // callback(JSON.stringify(responseJson.data))

		      esdr._dataUpdatedForChannel(feedId, channelName)

		    } else {
		      // We reached our target server, but it returned an error
		      console.log(`encountenered ${this.status} as the response status trying to get ESDR tile ${level}.${offset}`)
		    }
		  };

		  request.onerror = function() {
		      console.log(`encountenered an error trying to get ESDR tile ${level}.${offset}`)
		  };

		  request.send();
  	}


	}

	getExportLink(feedId, channelName, fromTime, toTime, format, timezone) {
		let baseUrl = `${this.apiUrl}/feeds/${feedId}/channels/${channelName}/export?`
  	let browserParams = new URLSearchParams()
  	browserParams.set("from", fromTime.toFixed(3))
  	browserParams.set("to", toTime.toFixed(3))
  	// timezone optional, no timezone means unix epoch timestamps
  	if (timezone)
  		browserParams.set("timezone", timezone)
  	browserParams.set("format", format)

  	return baseUrl + browserParams.toString()
	}

	/**
		This function tries to find a color mapping for a given channel.
		@return a color map with a color map texture image name and range for applying it
	*/
	static sparklineColorMap(feedId, channelName) {
		if ((channelName.indexOf("tVOC") == 0) || (channelName.indexOf("tvoc") == 0)) {
			return {texture: "img/colorscale-tVOC_0_7000_ppb.png", range: {min: 0.0, max: 7000.0}}
		}
		else if (channelName.indexOf("PM2") == 0) {
			return {texture: "img/colorscale-PM25_0_300_ug.png", range: {min: 0.0, max: 300.0}}
		}
		else if (channelName.indexOf("SO2_PPM") == 0) {
			return {texture: "img/colorscale-SO2_0_804_ppb.png", range: {min: 0.0, max: 0.804}}
		}
		else if (channelName.indexOf("SO2_PPB") == 0) {
			return {texture: "img/colorscale-SO2_0_804_ppb.png", range: {min: 0.0, max: 804.0}}
		}
		else if (channelName.indexOf("SO2") == 0) {
			return {texture: "img/colorscale-SO2_0_804_ppb.png", range: {min: 0.0, max: 804.0}}
		}
		else if (channelName.indexOf("pm_sensor_voltage") == 0) {
			return {texture: "img/colorscale-rainbow.png", range: {min: 0.2, max: 4.0}}
		}
		else {
			return {texture: undefined, range: undefined}
		}
	}


} // class ESDR


class TiledDataEvaluator {

	constructor(dataSource) {
		this.tileDataSource = dataSource


		this.aggregator = {
			accuracyLevel: 0, // level zero means aggregate from tile that covers the whole window
			histogramLimits: [], // values delimiting histogram buckets, including end limits
		}

		this.currentLevel = undefined
		this.currentTiles = new Map()

		this.meanValueCallback = undefined // (range, mean, count) => {}
		this.currentValueCallback = undefined // (time, value, count) => {}
		this.histogramCallback = undefined // (range, mean, count) => {}
		this.currentRange = {min: undefined, max: undefined}
	}

	_tileInCurrentRange(level, offset) {
		return this.currentTiles.has(`${level}.${offset}`)
	}

	fetchTile({level, offset}) {
		if (!this.tileDataSource) {
			console.warn("attempting to fetch tile without data source in place, ignoring")
			return
		}

		this.currentTiles.set(`${level}.${offset}`, "requested")

		let plotter = this

		this.tileDataSource(level, offset, (tileJson) => {
			if (!plotter._tileInCurrentRange(level, offset)) {
				// if data is returned for tiles that aren't in current range, ignore them
				return
			}

			// filter rows of [time, mean, stdev, count] so that only count > 0 is kept
			let tileData = tileJson.data.filter( sample => sample[3] > 0 )

			// we actually have a new tile 
			let tile = {
				level: level,
				offset: offset,
				data: tileData,
			}


			// kick off processing
			plotter._tileReceived(tile)
		})
	}

	_haveIncompleteTiles() {
		return Array.from(this.currentTiles.values()).some( obj => obj === "requested")
	}

	_tileReceived(jsonTile) {
		// console.log("tileReceived", jsonTile)
		let tileSpec = `${jsonTile.level}.${jsonTile.offset}`
		if (jsonTile.level != this.currentLevel) {
			// reject tiles that are of the wrong level
			return
		}
		if (!this.currentTiles.has(tileSpec)) {
			// reject tiles that aren't what we're currently looking for
			return
		}

		this.currentTiles.set(tileSpec, jsonTile)

		// check if tiles are still in flight
		if (this._haveIncompleteTiles()) {
			// not done, yet, waiting for further tiles
			// do nothing
		}
		else {
			// compute value when all tiles have arrived
			this._combineTileData()
			this._computeValues()
		}

	}

	tileRangeForTimeRange(levelFactor, range) {
		console.assert(isFinite(range.min), isFinite(range.max))
		let level = ESDR.computeDataTileLevel(range) + levelFactor
		let startIndex = ESDR.computeDataTileOffset(range.min, level)
		let lastIndex = ESDR.computeDataTileOffset(range.max, level)

		let offsets = []
		for (let i = startIndex; i <= lastIndex; ++i) {
			offsets.push(i)
		}
		return {level: level, offsets: offsets}
	}

	setCurrentTime(currentTime, invalidateData) {

		if (this.currentTime == currentTime)
			return

		if ((currentTime < this.currentRange.min) || (currentTime > this.currentRange.max)) {
			console.warn("setCurrentTime exceeds current time range", currentTime, this.currentRange)
		}

		this.currentTime = currentTime

		if (invalidateData && !this.currentSamples && this.currentValueCallback)
			this.currentValueCallback(undefined, undefined, undefined)
		
		if (this.currentSamples && this.currentValueCallback)
		{
			this._computeCurrentValue()
		}
	}

	_numericArraysEqual(lista, listb) {
		if (!lista || !listb)
			return false
		if (lista.length != listb.length)
			return false;
		for (let i = 0; i < lista.length; ++i) {
			if (lista[i] != listb[i])
				return false
		}
		return true
	}

	setHistogramLimits(histogramLimits, invalidateData) {

		if (this._numericArraysEqual(this.aggregator.histogramLimits, histogramLimits))
			return

		this.aggregator.histogramLimits = histogramLimits

		if (invalidateData && !this.currentSamples && this.histogramCallback)
			this.histogramCallback(undefined)
		
		if (this.currentSamples)
		{
			this._computeHistogram()
		}
	}

	setCurrentRange(timeRange, invalidateData) {

		if ((timeRange.min === this.currentRange.min) && (timeRange.max === this.currentRange.max)) {
			// time range didn't change, do nothing
			return
		}


		// first, figure out which tiles we need
		let tileRange = this.tileRangeForTimeRange(this.aggregator.accuracyLevel, timeRange)

		this.currentRange = timeRange

		// next figure out which tiles we actually need to fetch
		// this is an optimization so that we don't recompute things unnecessarily, even though the tile data source is expected to cache tiles already
		let levelNeeded = tileRange.level
		if (levelNeeded != this.currentLevel) {
			// console.log("setCurrentRange need to fetch all tiles")
			// we're fetching tiles from a different level, so just fetch all
			if (invalidateData)
				this._invalidateCallbackData()
			console.assert(isFinite(levelNeeded))
			this.currentLevel = levelNeeded
			this.currentTiles = new Map()
			this.currentSamples = undefined
			tileRange.offsets.forEach( offset => this.fetchTile({level: levelNeeded, offset: offset}) )
		}
		else {
			// if we're on the current level
			// console.log("setCurrentRange might need to fetch some tiles")
			if (invalidateData)
				this._invalidateCallbackData()
			let currentOffsets = new Set(Array.from(this.currentTiles.keys()).map( (tileSpec) => parseInt(tileSpec.slice(tileSpec.indexOf(".")+1)) ))
			let neededOffsets = tileRange.offsets.filter(offset => !currentOffsets.has(offset))
			if (neededOffsets.length > 0) {
				this.currentSamples = undefined
				neededOffsets.forEach( offset => this.fetchTile({level: levelNeeded, offset: offset}) )
			}
			else {
				// console.log("got all the tiles")
				// if we've already got all tiles needed, try to compute the value immediately (though it won't compute if some tiles are still in flight)
				this._computeValues()
			}
		}
	}

	_invalidateCallbackData() {
		if (this.meanValueCallback)
			this.meanValueCallback(undefined, undefined, undefined)
		if (this.currentValueCallback)
			this.currentValueCallback(undefined, undefined, undefined)
		if (this.histogramCallback)
			this.histogramCallback(undefined)		
	}

	_combineTileData() {
		// this function assumes this.currentTiles is complete (all tiles have been received)
		let sortedTiles = Array.from(this.currentTiles.values()).sort( (a,b) => a.offset - b.offset )

		// concat all tile data together
		let samples = sortedTiles.reduce((acc, tile) => acc.concat(tile.data), [])

		// compute an aggregate with pre-computed cumulative sums to be able to do the averaging in O(1) when computing the value later
		let aggregate = samples.reduce( (acc, e) => {
				let sum = acc.sum + e[1]
				let count = acc.count + e[3]
				acc.cumsum.push({value: sum, count: count})
				return {
					sum: sum, 
					count: count, 
					cumsum: acc.cumsum
				}
			}, 
			{sum: 0.0, count: 0, cumsum: []}
		)

		this.currentAggregate = aggregate
		this.currentSamples = samples
	}

	_computeMeanValue() {
		// do nothing if no callback is set
		if (!this.meanValueCallback)
			return

		let iLo = ESDR.binarySearch(this.currentSamples, e => e[0] >= this.currentRange.min)
		let iHi = ESDR.binarySearch(this.currentSamples, e => e[0] > this.currentRange.max)

		if (iLo == iHi) {
			// undefined current value
			this.meanValueCallback(this.currentRange, undefined, 0)
		}
		else {
			let sum = this.currentAggregate.cumsum[iHi].value - this.currentAggregate.cumsum[iLo].value
			let count = this.currentAggregate.cumsum[iHi].count - this.currentAggregate.cumsum[iLo].count
			let mean = sum / count
			this.meanValueCallback(this.currentRange, mean, count)
		}
	}

	_computeCurrentValue() {
		// do nothing if no callback is set
		if (!this.currentValueCallback || !this.currentTime)
			return

		let iCurrent = ESDR.binarySearch(this.currentSamples, e => e[0] >= this.currentTime) - 1

		if ((iCurrent >= this.currentSamples.length) || (iCurrent < 0)) {
			// undefined current value
			this.currentValueCallback(this.currentTime, undefined, 0)
		}
		else {
			this.currentValueCallback(this.currentTime, this.currentSamples[iCurrent][1], this.currentSamples[iCurrent][3])
		}
	}

	_computeHistogram() {
		// do nothing if no callback is set
		if (!this.histogramCallback)
			return

		let histogram = this.aggregator.histogramLimits.slice(0, -1).map(e => 0)

		for (let s of this.currentSamples) {
			let val = s[1]
			let count = s[3]

			let iLo = ESDR.binarySearch(this.aggregator.histogramLimits, lim => val >= lim)

			if (iLo < histogram.length)
				histogram[iLo] = histogram[iLo] + count
		}

		this.histogramCallback(histogram)

	}

	_computeValues() {
		// nothing to compute until samples have been populated
		if (!this.currentSamples)
			return

		this._computeCurrentValue()
		this._computeMeanValue()
		this._computeHistogram()
	}

} // class TiledDataEvaluator





export {ESDR, TiledDataEvaluator}

