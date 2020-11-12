
class ESDR {

	constructor() {
		this.numParallelRequests = 1
		this.feeds = new Map
		this.feedIds = []
		this.apiUrl = 'https://esdr.cmucreatelab.org/api/v1'
		this.selectedChannelIds = [] // an array to respect order
		this.selectedChannels_ = {} // a map for quick testing if a channel is selected
		this.searchCallback_ = (results, isAppendUpdate) => {} // empty function initially
		this.searchQuery_ = undefined
		this.oldSearchQuery_ = undefined
		this.searchResults_ = undefined
		this.dataUpdateTimers = new Map()
		this.channelDataUpdateCallback = (feedId, channelName) => {}
	}

	_separateKeywordsInSearchString(text) {
		// TODO: add support for quoted substrings
		return text.toLowerCase().split(" ")
	}

	_performSearchOn(feedIds, search) {
	  let now = Date.now() / 1000;
	  let recentThreshold = now - 30 * 24 * 60 * 60;

		let searchText = search.text || ""
		let keywords = this._separateKeywordsInSearchString(searchText)
		let searchResults = feedIds.reduce( (results, feedId) => {
			let feed = this.feeds.get(feedId)

			// filter out feeds that are older
			if (search.recentOnly) {
				let feedLastTime = parseFloat(feed.maxTimeSecs || 0.0)
				if (feedLastTime < recentThreshold)
					return results
			}

			let feedName = feed.name.toLowerCase()
			let feedIdString = feedId.toString()
			// match keywords to feed name substring or feedId exact match
			let feedMatches = keywords.some( word => (feedName.indexOf(word) > -1) || (feedIdString == word) )

			// if the feed matches the search, return a result with all channels
			if (feedMatches)
			{
				results.push({feedId: feedId, channels: feed.channelNames})
				return results
			}
			let channelMatches = feed.channelNames ? feed.channelNames.filter(name => keywords.some(word => name.toLowerCase().indexOf(word) > -1)) : []

			if (channelMatches.length > 0)
			{
				results.push({feedId: feedId, channels: channelMatches})
			}

			return results

		}, [])
		return searchResults
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
		else if (this.oldSearchQuery_ == this.searchQuery_ && appendedFeedIds)
		{
			// search only appended feeds
			this.searchResults = this._performSearchOn(appendedFeedIds, this.searchQuery_)
			this.searchCallback_(this.searchResults, false);
		}
		else if (this.oldSearchQuery_ != this.searchQuery_)
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
		if (!feed)
	  	feed = this.feeds.has(feedId) ? `${this.feeds.get(feedId).name} ` : ""
	  let label = `${feed}(${feedId})`
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
	  		feed.channelLabels = feed.channelNames.map( name => this.labelForChannel(feed.id, name, feed) )

	  	feedIds.push(feed.id)
	    this.feeds.set(feed.id, feed)
	  }

	  this.feedIds = this.feedIds.concat(feedIds)

	  // feeds received callback first
	  callback(feedIds, {current: this.feedIds.length, total: feedsJson.totalCount})

	  // update search results with new feeds last
	  this._updateSearch(feedIds)
	}

	getFeedsFromOffset(feedOffset, callback) {
	  let request = new XMLHttpRequest();
	  request.open('GET', `${this.apiUrl}/feeds?offset=${feedOffset}`, true);

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

	dataSourceForChannel(feedId, channelName) {
		let baseUrl = `${this.apiUrl}/feeds/${feedId}/channels/${channelName}/tiles`
		let esdr = this

  	return function(level, offset, callback) {
  		let url = `${baseUrl}/${level}.${offset}`

	  	let request = new XMLHttpRequest();
		  request.open('GET', url, true);

		  request.onload = function() {
		    if (this.status >= 200 && this.status < 400) {
		      // Success!
		      var responseJson = JSON.parse(this.response);

		      callback(JSON.stringify(responseJson.data))

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

} // class ESDR
