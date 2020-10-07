function drawPoints(gl, transform, series, from, to, settings) {
  var program = series.program

  gl.useProgram(program)

  if (program.aPointSizeAttribLocation === undefined) {
    program.aPointSizeAttribLocation = gl.getAttribLocation(program, 'aPointSize')
  }

  if (program.mapMatrixUniformLocation === undefined) {
    program.mapMatrixUniformLocation = gl.getUniformLocation(program, 'mapMatrix')
  }

  if (program.hardFractionUniformLocation === undefined) {
    program.hardFractionUniformLocation = gl.getUniformLocation(program, 'hardFraction')
  }

  gl.vertexAttrib1f(program.aPointSizeAttribLocation, settings.pointSize);

  // attach matrix value to 'mapMatrix' uniform in shader
  gl.uniformMatrix4fv(program.mapMatrixUniformLocation, false, transform);

  // set color for shader
  // gl.uniform4fv(gl.getUniformLocation(series.program, 'color'), settings.color);

  // set hardFraction
  // TODO(rsargent): make sure hardFraction is at least 1 pixel less than 100% for antialiasing
  gl.uniform1f(program.hardFractionUniformLocation, settings.hardFraction);

  // drawArrays takes (start, count) params, not (to, from)
  gl.drawArrays(gl.POINTS, from, to-from);
}

// Converts from latlng to xy, and create WebGL buffer
function prepareSeries(gl, series, settings) {
  // Reuse latlng array for x, y
  series.xy = series.latlng;
  for (var i = 0; i < series.latlng.length; i += 2) {
      var lat = series.latlng[i];
      var lon = series.latlng[i + 1];
      var pixel = LatLongToPixelXY(lat, lon);
      series.xy[i] = pixel.x;
      series.xy[i + 1] = pixel.y;
  }
  delete series.latlng;
  series.glBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, series.glBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, series.xy, gl.STATIC_DRAW);

  // create vertex shader
  var vertexSrc = document.getElementById('pointVertexShader').text;
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexSrc);
  gl.compileShader(vertexShader);

  // create fragment shader
  var fragmentSrc = document.getElementById('pointFragmentShader').text;
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentSrc);
  gl.compileShader(fragmentShader);

  // link shaders to create our program
  series.program = gl.createProgram();
  gl.attachShader(series.program, vertexShader);
  gl.attachShader(series.program, fragmentShader);
  gl.linkProgram(series.program);

  // enable the 'worldCoord' attribute in the shader to receive buffer
  gl.enableVertexAttribArray(gl.getAttribLocation(series.program, 'worldCoord'));

  // tell webgl how buffer is laid out (pairs of x,y coords)
  gl.vertexAttribPointer(gl.getAttribLocation(series.program, 'worldCoord'), 2, gl.FLOAT, false, 0, 0);

  series.colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, series.colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, series.color, gl.STATIC_DRAW);



  // enable the 'aColor' attribute in the shader to receive buffer
  gl.enableVertexAttribArray(gl.getAttribLocation(series.program, 'aColor'));

  // tell webgl how buffer is laid out 
  gl.vertexAttribPointer(gl.getAttribLocation(series.program, 'aColor'), 4, gl.FLOAT, false, 24, 0);

  gl.enableVertexAttribArray(gl.getAttribLocation(series.program, 'aEnabled'));
  gl.vertexAttribPointer(gl.getAttribLocation(series.program, 'aEnabled'), 1, gl.FLOAT, false, 24, 16);

  gl.enableVertexAttribArray(gl.getAttribLocation(series.program, 'aCircled'));
  gl.vertexAttribPointer(gl.getAttribLocation(series.program, 'aCircled'), 1, gl.FLOAT, false, 24, 20);

}

function prepareSeries2(series){
  series.xy = series.latlng;
  for (var i = 0; i < series.latlng.length; i += 2) {
      var lat = series.latlng[i];
      var lon = series.latlng[i + 1];
      var pixel = LatLongToPixelXY(lat, lon);
      series.xy[i] = pixel.x;
      series.xy[i + 1] = pixel.y;
  }
  delete series.latlng;
}

function findIndex(index, series) {
  if (index > series.index[series.index.length - 1]) {
    return series.index.length;
  }
  // Use binary search to find index in array
  var min = 0;
  var max = series.index.length - 1;
  var test = 0;
  while (min < max) {
    test = Math.floor(0.5 * (min + max));
    if (index < series.index[test]) {
      max = test - 1;
    } else if (index > series.index[test]) {
      min = test + 1;
    } else {
      break;
    }
  }
  // If found, return index
  // If failed to find, return "closest" (last index tried)
  return test;
}

function findClosestElements(gl, transform, series, pixelXY, maxDistInPixels) {
  var glXY = divToGl(gl, transform, pixelXY);

  var closest_distsq = 1e30;
  var selectedGL = []; 
  var selectedPixel = []; 
  var closest = []; 

  var offSetXYCoordinate = divToGl(gl, transform, {x: pixelXY.x + maxDistInPixels, y: pixelXY.y + maxDistInPixels}); 
  var mouseXYCoordinate = divToGl(gl, transform, pixelXY); 
  var offSet = Math.sqrt(Math.pow(offSetXYCoordinate.x - mouseXYCoordinate.x, 2) + Math.pow(offSetXYCoordinate.y - mouseXYCoordinate.y, 2));

  for (var i = 0; i < series.xy.length / 2; i++) {
    var distsq = Math.pow(series.xy[i * 2] - glXY.x, 2) + Math.pow(series.xy[i * 2 + 1] - glXY.y, 2);
    if (distsq <= closest_distsq) {
      closest_distsq = distsq + offSet;
      //console.log(closest_distsq);
      closest.push(i); 
      currentGL = {x: series.xy[i * 2], y: series.xy[i * 2 + 1]}
      selectedGL.push(currentGL)
      selectedPixel.push(glToDiv(gl, transform, currentGL)); 
    }
  }

  var eltList = []; 

  for(var i=0; i < selectedPixel.length; i++){
     var dist = Math.sqrt(Math.pow(pixelXY.x - selectedPixel[i].x, 2) + Math.pow(pixelXY.y - selectedPixel[i].y, 2));
     if (dist <= maxDistInPixels) {
      var elt = glToLatLng(selectedGL[i]);
      elt.i = closest[i];
      eltList.push(elt); 
    } 
  }

  return eltList; 
}

// Convert from lat, lng to GL x, y coords in the range x:0-256, y:0-256
// TODO(rsargent): move this to CanvasLayer 
function latLngToGl(latlng) {
  var x = (latlng.lng + 180) * 256 / 360;
  var y = 128 - Math.log(Math.tan((latlng.lat + 90) * Math.PI / 360)) * 128 / Math.PI;
  return {x: x, y: y};
}
      
// Convert from GL x, y coords to lat, lng
// TODO(rsargent): move this to CanvasLayer 
function glToLatLng(xy) {
  var lat = Math.atan(Math.exp((128 - xy.y) * Math.PI / 128)) * 360 / Math.PI - 90;
  var lng = xy.x * 360 / 256 - 180;
  return {lat: lat, lng: lng};
};

// Transform point from map div pixel space to GL space
// TODO(rsargent: move this to CanvasLayer
function divToGl(gl, transform, pixelXY) {
  var viewportXY = {x: pixelXY.x * 2 / gl.canvas.width - 1, 
                    y: 1 - pixelXY.y * 2 / gl.canvas.height};
     
  var transformInv = new Float32Array(16);
  invert4(transformInv, transform);

  return transformM4V2(transformInv, viewportXY);
}

// Transform point from GL space to XY screen space
// TODO(rsargent): move this to CanvasLayer
function glToDiv(gl, transform, glXY) {
  var viewportXY = transformM4V2(transform, glXY);
  return {x: (viewportXY.x + 1) * gl.canvas.width / 2, 
          y: (1 - viewportXY.y) * gl.canvas.height / 2};
}
