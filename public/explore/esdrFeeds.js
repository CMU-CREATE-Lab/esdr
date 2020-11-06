
class ESDR {

	constructor() {
		this.feeds = {}
		this.apiUrl = 'https://esdr.cmucreatelab.org/api/v1'
		this.selectedChannelIds = [] // an array to respect order
		this.selectedChannels_ = {} // a map for quick testing if a channel is selected
		this.searchCallback_ = (results, isAppendUpdate) => {} // empty function initially
		this.searchQuery_ = undefined
	}

	_updateSearch(appendedFeedIds) {
		// empty search means all the feeds
		if (this.searchQuery === undefined || searchQuery == {})
		{
			let searchResults = []
			let feedIds = appendedFeedIds ? appendedFeedIds : this.feeds.keys

			// do nothing if there's nothing to report
			if (feedIds === undefined)
				return

			for (let feedId of feedIds)
			{
				let channelNames = this.channelNamesForFeed(feedId)
				searchResults.push({feedId: feedId, channels: channelNames})
			}
			this.searchCallback_(searchResults, appendedFeedIds !== undefined);
		}
		else
		{
			// else do the actual search
		}
	}

	set searchQuery(query) {
		this.searchQuery_ = query
		this._updateSearch()
	}

	set searchCallback(callback) {
		this.searchCallback_ = callback
		this._updateSearch()
	}

	channelNamesForFeed(feedId) {
		let feed = this.feeds[feedId]
		if (feed && feed.channelBounds && feed.channelBounds.channels) {
			return feed.channelBounds.channels.keys
		}
		else
			return undefined
	}

	feedsReceived(feedsJson, callback) {
	  // feedsJson.limit contains how big the batches are
	  let numFeedsReceived = feedsJson.rows.length + feedsJson.offset;

	  let numFeedsTotal = feedsJson.totalCount

	  // kick off another GET if we haven't received all feeds, yet
	  if (numFeedsReceived < numFeedsTotal)
	  {
	    this.getFeedsFromOffset(numFeedsReceived, (feedsJson) => this.feedsReceived(feedsJson, callback))
	  }

	  let feedIds = []
	  for (let feed of feedsJson.rows) {

	  	feedIds.push(feed.id)
	    this.feeds[feed.id] = feed
	  }

	  // update search results with new feeds
	  this._updateSearch(feedIds)

	  callback(feedIds, {current: numFeedsReceived, total: numFeedsTotal})
	}

	getFeedsFromOffset(feedOffset, callback) {

	  var request = new XMLHttpRequest();
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
			this.feedsReceived(feedsJson, loadCallback)
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

} // class ESDR
