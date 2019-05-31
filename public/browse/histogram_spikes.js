function Histogram(jsonURL, xMax){
  
if (jsonURL == undefined)
  //jsonURL = "https://esdr.cmucreatelab.org/api/v1/feeds/26154/channels/benzene_qa_v2,benzene_v2/export?from=1558182242.096208&to=1558299081.131782&format=json";
  alert("no channels selected");

function humanTime(t){ 
  var date = new Date(t * 1000);
  var day = date.getDay();
  var month = date.getMonth();
  var hr = date.getHours();
  var min = date.getMinutes();
  formatter = d3.format("02");
  return formatter(hr) + ":" + formatter(min);
}

// Get max of all values (for y axis bounds)
function getMaxValue(data, channel){
  var allVals = data.map(function(elem){return elem[channel]});
  return d3.max(allVals);
}

// Get avg of vals in bin
function binAvg(b, channel){
  var vals = b.map(function(d){return d[channel]})
  var sum = vals.reduce(function(a,b){return a+b});
  return sum / b.length;
}

// Do stuff w json
d3.json(jsonURL, function(json){  
  var allBins = new Array(json.channel_names.length);
  console.log("num channels=" + json.channel_names.length);
  makeAllHisto(json);
});

// Make all histograms
function makeAllHisto(json){
  for (var i=1; i <= json.channel_names.length; i++){
    console.log(json.channel_names[i-1]);
    makeHistogram(json, i);
  }
}
  
// Make one histogram from json arr and channel #
function makeHistogram(json, channel, numBins=15, 
                        color="#69b3a2", opacity=0.5){   
  
// Set the dimensions, padding, margins of the graph
var totalWidth = 500;
var totalHeight = 400;
var margin = {top: 10, right: 30, bottom: 60, left: 40},
    width = totalWidth - margin.left - margin.right,
    height = totalHeight - margin.top - margin.bottom;
var yAxisPad = 20;
var xLabelY = height + margin.bottom; //distance from top of page
var xAxisHeight = height-margin.bottom;

// Append the svg object to the body of the page
var svg = d3.select("#histogram")
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform",
          "translate(" + margin.left + "," + margin.top + ")");
  
  // process stuff
  var data = json.data;

  var startTime = data[0][0];
  var endTime = data[data.length-1][0];


  //HISTOGRAM DATA
  // X axis: scale 
  if (xMax == undefined)
    xMax = getMaxValue(data, channel);
  console.log("x max=" + xMax);
  var x = d3.scaleLinear()
      .domain([0,xMax])
      .range([0, width]);

  // Set the parameters for the histogram
  var histogram = d3.histogram()
      .value(function(d) { return d[channel]; })   // x values
      .domain(x.domain())  // domain of x
      .thresholds(x.ticks(numBins)); // numbers of bins

  // Get the bins
  var bins = histogram(data);
  console.log("bins=");console.log(bins);

  // Height of bars
  function getHeight(d){
    return d.length;
  }

  // Scale Y axis
  var yMax = d3.max(bins, getHeight)
  console.log("y max="+yMax);
  var y = d3.scaleLinear()
      .domain([0, yMax])
      .range([height, margin.top * 2]);

  //DRAW HISTOGRAM, don't modify

//    // Draw light background
//    var padx   = 0 - margin.left;
//    var pady = 0 -  margin.top;
//    svg.append("rect")
//    .attr("transform","translate("+ padx + "," + pady + ")")
//    .attr("width", width + margin.left + margin.right)
//    .attr("height", height + margin.top + margin.bottom)
//    .attr("fill", "orange");

  // Add title
  var start = new Date(startTime * 1000);
  var end = new Date(endTime * 1000);
  svg.append("text")
    .attr("transform","translate("+width/2+","+margin.top+")")
    .style("font-size",12)
    .style("text-anchor","middle")
    .text(start.toDateString()+
              " to "+end.toDateString() + 
              " for \'" + json.channel_names[channel-1] + "\'");

  // Draw x axis and format to human time
  svg.append("g")
      .attr("transform", "translate(" + yAxisPad + "," + height + ")")
      //.call(d3.axisBottom(x).tickFormat(humanTime)); 
      .call(d3.axisBottom(x))
      .selectAll("text")
        .style("text-anchor","end")
        .attr("dx", "-0.8em")
        .attr("dy", "0.15em")
        .attr("transform", "rotate(-65)"); 
  svg.append("text")             
      .attr("transform",
            "translate(" + (width/2) + " ," + 
                           (xLabelY) + ")")
      .style("text-anchor", "middle")
      .text("Value");

  // Draw y axis
  svg.append("g")
      .attr("transform", "translate(" + yAxisPad + ",0)")
      .call(d3.axisLeft(y));
  svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x",0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .text("Num. occurences");

  // Append the bar rectangles to the svg element
  function drawBars(bins,x,y,getHeight,color,opacity){
    svg.selectAll("rect")
        .data(bins)
        .enter()
        .append("rect")
          .attr("x", yAxisPad+1)
          .attr("y", 0)
          .attr("transform", function(d) {
              return "translate("+x(d.x0)+","+y(getHeight(d))+")"; })
          .attr("width", function(d) { return x(d.x1) - x(d.x0) -1 ; })
          .attr("height", function(d) { return height - y(getHeight(d));}) 
          .style("fill", color)
          .attr("fill-opacity", opacity);
  }
  drawBars(bins,x,y,getHeight,color,opacity);
//  var bar = svg.selectAll(".bar").data(data);
}





}
