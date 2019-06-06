// filter_feeds.js
// lists feed IDs of all active feeds from a product
// can modify to make esdr website show active/inactive channels and feeds

var feedsURL = "https://esdr.cmucreatelab.org/api/v1/feeds?fields=id,userId,productId,deviceId,name&where=productId=68";
  //var inactiveFeeds = [];
var feeds = $.getJSON(feedsURL);
var activeFeeds = [];
var inactiveFeeds = [];

var feedsInfo;

$.when(feeds).then(function(jsonResponse){
  //console.log(jsonResponse.data.rows);
  feedsInfo = jsonResponse.data.rows;
  
  var timeBound = 1546300800; //jan 1 2019  
  var activeFeeds = [];
  var queryArr = [];
  
  // loop through each feed
  for (var i=0; i<feedsInfo.length; i++){
    var id = feedsInfo[i].id;
    var recentUrl = "https://esdr.cmucreatelab.org/api/v1/feeds/"+id+"/most-recent";
    var start = ("https://esdr.cmucreatelab.org/api/v1/feeds/").length;
    var end = ("/most-recent").length;

    var channelPromise = $.getJSON(recentUrl);
    queryArr.push(channelPromise);
    
    $.when(channelPromise).then(function(recentInfo){
      var active = false;
      var channels = recentInfo.data.channels
      var cid = this.url.substring(start,this.url.length-end);

      for (var c in channels){
        var channel = channels[c];
        var sampleTime = channel.mostRecentDataSample.timeSecs;
        if (sampleTime > timeBound){
          active = true;
        }
      }
      
      if (active) activeFeeds.push(cid);
      else inactiveFeeds.push(cid);
    });
  }
  
  $.when.apply($, queryArr).then(function(){
    //console.log(activeFeeds);
    document.getElementById("active-feeds").innerHTML = activeFeeds.join("<br>");
    document.getElementById("inactive-feeds").innerHTML = inactiveFeeds.join("<br>");
  })
});

