var feedsURL = "https://esdr.cmucreatelab.org/api/v1/feeds?fields=id,userId,productId,deviceId,name&where=productId=68";
  //var inactiveFeeds = [];
var feeds = $.getJSON(feedsURL);
var activeFeeds = [];
var inactiveFeeds = [];

var activeFeedsDict = {};
var activeFeeds2 = [];

var feedsInfo;


$.when(feeds).then(function(jsonResponse){
  //console.log(jsonResponse.data.rows);
  feedsInfo = jsonResponse.data.rows;
  
  var timeBound = 1546300800; //jan 1 2019  


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
      
      //console.log(channels);
      if ("PM025" in channels){
        var sampleTime = channels.PM025.mostRecentDataSample.timeSecs;
        if (sampleTime > timeBound){
          active = true;
          console.log("active");
          activeFeeds.push(cid);
        } 
        else {
          console.log("contains PM025 but not active");
          inactiveFeeds.push(0-cid);
        }
      }
      else{
        console.log("no PM025", cid, Object.keys(channels))
        inactiveFeeds.push(cid);
      }
//      for (var c in channels){
//        var channel = channels[c];
//        var sampleTime = channel.mostRecentDataSample.timeSecs;
//        if (sampleTime > timeBound){
//          active = true;
//        }
//      }

//      if (active) activeFeeds.push(cid);
//      else inactiveFeeds.push(cid);
    });
  }
  
  $.when.apply($, queryArr).then(function(){
    //console.log(activeFeeds);
    document.getElementById("active-feeds").innerHTML = activeFeeds.join("<br>");
    document.getElementById("inactive-feeds").innerHTML = inactiveFeeds.join("<br>");
    //console.log(activeFeedsDict);
    
    var queries2 = [];
    
    for (var i=0; i<activeFeeds.length; i++){
        var feedURL = "https://esdr.cmucreatelab.org/api/v1/feeds/" + activeFeeds[i];// + "?fields=id,name,latitude,longitude";
        var p = $.getJSON(feedURL);
        queries2.push(p);
        $.when(p).then(function(response){
          var data = response.data;
          if (!("PM2_5" in data.channelSpecs.channels)){
            console.log(data.id);
          }
          console.log(Object.keys(data.channelSpecs.channels));
          var info = {"name":data.name, 
                      "sensors":{
                        "PM25":{
                        "sources":[{
                          "feed":data.id,
                          "channel":"PM025"}]}}};
          var info_str = JSON.stringify(info);
          activeFeeds2.push("[<br>"+info_str+",<br>"+
                            data.latitude+",<br>"+
                            data.longitude+"<br>]");
        })
    }
    
    $.when.apply($, queries2).then(function(){
      console.log(Object.keys(activeFeeds2));
      document.getElementById("active-feeds").innerHTML = activeFeeds2.join(",<br>");
      //document.getElementById("active-feeds").innerHTML = activeFeeds.join("<br>");
      console.log(activeFeeds.length);
    });
  })
});


//function makeArrElem(data){
//  var obj = {"name": data.name, ""}
//}
