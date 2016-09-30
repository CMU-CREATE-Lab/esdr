//======================================================================================================================
// Class for making it easier to work with the Bodytrack Grapher.
//
// Dependencies:
// * jQuery (http://jquery.com/)
// * One of the following:
//   * The CREATE Lab Grapher (https://github.com/CMU-CREATE-Lab/grapher)
//   * The Bodytrack Grapher (https://github.com/BodyTrack/Grapher)
//
// Author: Chris Bartley (bartley@cmu.edu)
//======================================================================================================================

//======================================================================================================================
// VERIFY NAMESPACE
//======================================================================================================================
// Create the global symbol "org" if it doesn't exist.  Throw an error if it does exist but is not an object.
var org;
if (!org) {
   /** @namespace */
   org = {};
}
else {
   if (typeof org != "object") {
      var orgExistsMessage = "Error: failed to create org namespace: org already exists and is not an object";
      alert(orgExistsMessage);
      throw new Error(orgExistsMessage);
   }
}

// Repeat the creation and type-checking for the next level
if (!org.bodytrack) {
   /** @namespace */
   org.bodytrack = {};
}
else {
   if (typeof org.bodytrack != "object") {
      var orgBodytrackExistsMessage = "Error: failed to create org.bodytrack namespace: org.bodytrack already exists and is not an object";
      alert(orgBodytrackExistsMessage);
      throw new Error(orgBodytrackExistsMessage);
   }
}

// Repeat the creation and type-checking for the next level
if (!org.bodytrack.grapher) {
   /** @namespace */
   org.bodytrack.grapher = {};
}
else {
   if (typeof org.bodytrack.grapher != "object") {
      var orgBodytrackGrapherExistsMessage = "Error: failed to create org.bodytrack.grapher namespace: org.bodytrack.grapher already exists and is not an object";
      alert(orgBodytrackGrapherExistsMessage);
      throw new Error(orgBodytrackGrapherExistsMessage);
   }
}
//======================================================================================================================

//======================================================================================================================
// DEPENDECIES
//======================================================================================================================
if (!window['$']) {
   var nojQueryMsg = "The jQuery library is required by org.bodytrack.grapher.PlotManager.js";
   alert(nojQueryMsg);
   throw new Error(nojQueryMsg);
}
//======================================================================================================================

//======================================================================================================================
// CODE
//======================================================================================================================
(function() {

   //  Got this from http://stackoverflow.com/a/9436948/703200
   var isString = function(o) {
      return (typeof o == 'string' || o instanceof String)
   };

   // Got this from http://stackoverflow.com/a/9716488/703200
   var isNumeric = function(n) {
      return !isNaN(parseFloat(n)) && isFinite(n);
   };

   var isNumberOrString = function(o) {
      return isString(o) || isNumeric(o);
   };

   /**
    * The function which the datasource function will call upon success, giving it the tile JSON.  Some implementations
    * can handle either an object or a string, some require one or the other.
    *
    * @callback datasourceSuccessCallbackFunction
    * @param {object|string} json - the tile JSON, as either an object or a string
    */

   /**
    * Datasource function with signature <code>function(level, offset, successCallback)</code> resposible for
    * returning tile JSON for the given <code>level</code> and <code>offset</code>.
    *
    * @callback datasourceFunction
    * @param {number} level - the tile's level
    * @param {number} offset - the tile's offset
    * @param {datasourceSuccessCallbackFunction} successCallback - success callback function which expects to be given the tile JSON
    */

   /**
    * The min and max values for an axis's range.
    *
    * @typedef {Object} AxisRange
    * @property {number} min - the range min
    * @property {number} max - the range max
    */

   /**
    * An axis change event object.
    *
    * @typedef {Object} AxisChangeEvent
    * @property {number} min - the axis's min value
    * @property {number} max - the axis's max value
    * @property {number|null} cursorPosition - the value of the cursor
    * @property {string|null} cursorPositionString - the value of the cursor, expressed as a string
    */

   /**
    * Function for handling axis change events.  Note that the event object passed to the function may be
    * <code>null</code>.
    *
    * @callback axisChangeListenerFunction
    * @param {AxisChangeEvent|null} axisChangeEvent - the <code>{@link AxisChangeEvent}</code>, may be <code>null</code>
    */

   /**
    * The statistics about plot data within a specific time range.
    *
    * @typedef {Object} PlotStatistics
    * @property {number|null} count - number of data points in the range, may be <code>null</code> if unknown
    * @property {boolean} hasData - whether there are any data points in the range
    * @property {number|null} minValue - the minimum Y value in the range, or <code>null</code> (or not present in the object) if there is no data within the range.
    * @property {number|null} maxValue - the maximum Y value in the range, or <code>null</code> (or not present in the object) if there is no data within the range.
    */

   /**
    *
    * @param {AxisRange|number} rangeOrMin - an {@link AxisRange} or a double representing the axis min. If
    * <code>null</code>, undefined, non-numeric, or not an <code>AxisRange</code>, then <code>-1*Number.MAX_VALUE</code>
    * is used instead.
    * @param {number} max - a double representing the axis max. If <code>null</code>, undefined, or non-numeric, then
    * <code>Number.MAX_VALUE</code> is used instead.
    * @returns {AxisRange}
    */
   var validateAxisRange = function(rangeOrMin, max) {
      var min = rangeOrMin;
      if (typeof rangeOrMin == 'object' && rangeOrMin != null) {
         min = rangeOrMin.min;
         max = rangeOrMin.max;
      }
      return {
         min : isNumeric(min) ? min : -1 * Number.MAX_VALUE,
         max : isNumeric(max) ? max : Number.MAX_VALUE
      }
   };

   /**
    * Returns the item in the given <code>hash</code> associated with the given <code>keyToFind</code>. If no such
    * item exists, it returns <code>null</code>. If the <code>keyToFind</code> undefined or <code>null</code>, this
    * method returns the first item found in the hash.  If the hash is empty, it returns <code>null</code>.
    *
    * @private
    * @param {Object} hash - the hash
    * @param {string|number} [keyToFind] - the key of the item to find in the hash
    * @returns {*|null}
    */
   var getItemFromHashOrFindFirst = function(hash, keyToFind) {
      if (typeof hash !== 'undefined' && hash != null) {
         // if the keyToFind is undefined or null, just return the first item in the hash, if any
         if (typeof keyToFind === 'undefined' || keyToFind == null) {
            var keys = Object.keys(hash);
            if (keys.length > 0) {
               return hash[keys[0]];
            }
         }
         else {
            if (keyToFind in hash) {
               return hash[keyToFind];
            }
         }
      }

      return null;
   };

   /**
    * Wrapper class to make it easier to work with a date axis.
    *
    * @class
    * @constructor
    * @param {string} elementId - the DOM element ID for the container div holding the date axis
    */
   org.bodytrack.grapher.DateAxis = function(elementId) {
      var self = this;

      var wrappedAxis = null;

      /**
       * Returns the DOM element ID for the container div holding this axis.
       *
       * @returns {string}
       */
      this.getElementId = function() {
         return elementId;
      };

      /**
       * Returns the wrapped <code>DateAxis</code> object.
       *
       * @returns {DateAxis}
       */
      this.getWrappedAxis = function() {
         return wrappedAxis;
      };

      /**
       * Adds the given function as an axis change listener.  Does nothing if the given <code>listener</code> is not a
       * function.
       *
       * @param {axisChangeListenerFunction} listener - function for handling an <code>{@link AxisChangeEvent}</code>.
       */
      this.addAxisChangeListener = function(listener) {
         if (typeof listener === 'function') {
            wrappedAxis.addAxisChangeListener(listener);
         }
      };

      /**
       * Removes the given axis change listener.  Does nothing if the given <code>listener</code> is not a function.
       *
       * @param {axisChangeListenerFunction} listener - function for handling an <code>{@link AxisChangeEvent}</code>.
       */
      this.removeAxisChangeListener = function(listener) {
         if (typeof listener === 'function') {
            wrappedAxis.removeAxisChangeListener(listener);
         }
      };

      /**
       * Returns the date axis's current range as and object containing <code>mine</code> and <code>max</code> fields.
       *
       * @returns {AxisRange}
       */
      this.getRange = function() {
         return {
            min : wrappedAxis.getMin(),
            max : wrappedAxis.getMax()
         };
      };

      /**
       * Returns the current cursor position.
       *
       * @returns {number}
       */
      this.getCursorPosition = function() {
         return wrappedAxis.getCursorPosition();
      };

      /**
       * Sets the cursor position to the given <code>timeInSecs</code>.  The cursor is hidden if <code>timeInSecs</code>
       * is <code>null</code> or undefined.
       *
       * @param {number} timeInSecs - the time at which the cursor should be placed.
       */
      this.setCursorPosition = function(timeInSecs) {
         wrappedAxis.setCursorPosition(timeInSecs);
      };

      /**
       * Hides the cursor. This is merely a helper method, identical to calling
       * <code>{@link #setCursorPosition setCursorPosition(null)}</code>.
       */
      this.hideCursor = function() {
         wrappedAxis.setCursorPosition(null);
      };

      /**
       * Sets the cursor to the color described by the given <code>colorDescriptor</code>, or to black if the given
       * <code>colorDescriptor</code> is undefined, <code>null</code>, or invalid. The color descriptor can be any valid
       * CSS color descriptor such as a word ("green", "blue", etc.), a hex color (e.g. "#ff0000"), or an RGB color
       * (e.g. "rgb(255,0,0)" or "rgba(0,255,0,0.5)").
       *
       * @param {string} colorDescriptor - a string description of the desired color.
       */
      this.setCursorColor = function(colorDescriptor) {
         wrappedAxis.setCursorColor(colorDescriptor);
      };

      /**
       * Sets the visible range of the axis.
       *
       * @param {AxisRange|number} rangeOrMinTimeSecs - an {@link AxisRange} or a double representing the time in Unix
       * time seconds of the start of the visible time range. If <code>null</code>, undefined, non-numeric, or not an
       * <code>AxisRange</code>, then <code>-1*Number.MAX_VALUE</code> is used instead.
       * @param {number} [maxTimeSecs] - a double representing the time in Unix time seconds of the end of the visible
       * time range. If <code>null</code>, undefined, or non-numeric, then <code>Number.MAX_VALUE</code> is used
       * instead.
       */
      this.setRange = function(rangeOrMinTimeSecs, maxTimeSecs) {
         var validRange = validateAxisRange(rangeOrMinTimeSecs, maxTimeSecs);
         wrappedAxis.setRange(validRange.min, validRange.max);
      };

      /**
       * Constrains the range of the axis so that the user cannot pan/zoom outside the specified range.
       *
       * @param {AxisRange|number} rangeOrMinTimeSecs - an {@link AxisRange} a double representing the minimum time in
       * Unix time seconds of the time range. If <code>null</code>, undefined, non-numeric, or not an
       * <code>AxisRange</code>, then <code>-1*Number.MAX_VALUE</code> is used instead.
       * @param {number} [maxTimeSecs] - a double representing the maximum time in Unix time seconds of the time range. If
       * <code>null</code>, undefined, or non-numeric, then <code>Number.MAX_VALUE</code> is used instead.
       */
      this.constrainRangeTo = function(rangeOrMinTimeSecs, maxTimeSecs) {
         var validRange = validateAxisRange(rangeOrMinTimeSecs, maxTimeSecs);
         wrappedAxis.setMaxRange(validRange.min, validRange.max);
      };

      /**
       * Clears the range constraints by setting bounds to [<code>-1 * Number.MAX_VALUE</code>, <code>Number.MAX_VALUE</code>].
       */
      this.clearRangeConstraints = function() {
         self.constrainRangeTo(null, null)
      };

      /**
       * Constrains the range of the axis so that the user cannot pan/zoom deeper than the specified range.
       *
       * @param {AxisRange|number|null} rangeOrMinTimeSecs - an {@link AxisRange} a double representing the minimum time
       * in Unix time seconds of the time range. If <code>null</code>, undefined, non-numeric, or not an
       * <code>AxisRange</code>, then <code>-1*Number.MAX_VALUE</code> is used instead.
       * @param {number|null} [maxTimeSecs] - a double representing the maximum time in Unix time seconds of the time
       * range. If <code>null</code>, undefined, or non-numeric, then <code>Number.MAX_VALUE</code> is used instead.
       */
      this.constrainMinRangeTo = function(rangeOrMinTimeSecs, maxTimeSecs) {
         var validRange = validateAxisRange(rangeOrMinTimeSecs, maxTimeSecs);
         wrappedAxis.setMinRangeConstraints(validRange.min, validRange.max);
      };

      /**
       * Clears the min range constraints by setting bounds to [<code>-1 * Number.MAX_VALUE</code>,
       * <code>Number.MAX_VALUE</code>].
       */
      this.clearMinRangeConstraints = function() {
         self.constrainMinRangeTo(null, null);
      };

      /**
       * Sets the width of the axis.
       *
       * @param {int} width - the new width
       */
      this.setWidth = function(width) {
         var element = $("#" + elementId);
         element.width(width);
         wrappedAxis.setSize(width, element.height(), SequenceNumber.getNext());
      };

      /**
       * Returns the width of the DateAxis's container div.
       *
       * @returns {int} the width of the DateAxis's container div
       */
      this.getWidth = function() {
         return $("#" + elementId).width();
      };

      // the "constructor"
      (function() {
         wrappedAxis = new DateAxis(elementId, "horizontal");

         // Tell the DateAxis instance the size of its container div
         var dateAxisElement = $("#" + elementId);
         wrappedAxis.setSize(dateAxisElement.width(), dateAxisElement.height(), SequenceNumber.getNext());
      })();
   };

   /**
    * Wrapper class to make it easier to work with a Y axis.
    *
    * @class
    * @constructor
    * @param {string} elementId - the DOM element ID for the container div holding this Y axis
    * @param {number} [yMin=0] - the minimum initial value for the Y axis. Defaults to 0 if undefined, <code>null</code>, or non-numeric.
    * @param {number} [yMax=100] - the maximum initial value for the Y axis. Defaults to 100 if undefined, <code>null</code>, or non-numeric.
    * @param {boolean} [willNotPadRange=false] - whether to pad the range
    */
   org.bodytrack.grapher.YAxis = function(elementId, yMin, yMax, willNotPadRange) {
      var self = this;

      var wrappedAxis = null;

      /**
       * Returns the DOM element ID for the container div holding this axis.
       *
       * @returns {string}
       */
      this.getElementId = function() {
         return elementId;
      };

      /**
       * Returns the wrapped <code>DateAxis</code> object.
       *
       * @returns {DateAxis}
       */
      this.getWrappedAxis = function() {
         return wrappedAxis
      };

      /**
       * Adds the given function as an axis change listener.  Does nothing if the given <code>listener</code> is not a
       * function.
       *
       * @param {axisChangeListenerFunction} listener - function for handling an <code>{@link AxisChangeEvent}</code>.
       */
      this.addAxisChangeListener = function(listener) {
         if (typeof listener === 'function') {
            wrappedAxis.addAxisChangeListener(listener);
         }
      };

      /**
       * Removes the given axis change listener.  Does nothing if the given <code>listener</code> is not a function.
       *
       * @param {axisChangeListenerFunction} listener - function for handling an <code>{@link AxisChangeEvent}</code>.
       */
      this.removeAxisChangeListener = function(listener) {
         if (typeof listener === 'function') {
            wrappedAxis.removeAxisChangeListener(listener);
         }
      };

      /**
       * Returns the Y axis's current range as and object containing <code>mine</code> and <code>max</code> fields.
       *
       * @returns {AxisRange}
       */
      this.getRange = function() {
         if (typeof wrappedAxis.getRange === 'function') {
            return wrappedAxis.getRange();
         } else {
            return {
               min : wrappedAxis.getMin(),
               max : wrappedAxis.getMax()
            };
         }
      };

      /**
       * Sets the visible range of the axis.
       *
       * @param {AxisRange|number} rangeOrMin - an {@link AxisRange} a double representing the minimum value. If <code>null</code>, undefined, non-numeric, or not an
       * <code>AxisRange</code>, then <code>-1*Number.MAX_VALUE</code> is used instead.
       * @param {number} max - the max value. If <code>null</code>, undefined, or non-numeric, then
       * <code>Number.MAX_VALUE</code> is used instead.  This argument is ignored (but required) if the first argument
       * is an {@link AxisRange}.
       * @param {boolean} [willNotPad=false] - whether to pad the range
       */
      this.setRange = function(rangeOrMin, max, willNotPad) {
         var range = validateAxisRange(rangeOrMin, max);

         // pad, if desired
         if (!willNotPad) {
            range = padRange(range);
         }

         wrappedAxis.setRange(range.min, range.max);
      };

      /**
       * Constrains the range of the axis so that the user cannot pan/zoom outside the specified range.
       *
       * @param {AxisRange|number} rangeOrMin - an {@link AxisRange} a double representing the minimum value. If <code>null</code>, undefined, non-numeric, or not an
       * <code>AxisRange</code>, then <code>-1*Number.MAX_VALUE</code> is used instead.
       * @param {number} max - the max value. If <code>null</code>, undefined, or non-numeric, then
       * <code>Number.MAX_VALUE</code> is used instead.  This argument is ignored (but required) if the first argument
       * is an {@link AxisRange}.
       * @param {boolean} [willNotPad=false] - whether to pad the range
       */
      this.constrainRangeTo = function(rangeOrMin, max, willNotPad) {
         var range = validateAxisRange(rangeOrMin, max);

         // pad, if desired
         if (!willNotPad) {
            range = padRange(range);
         }

         wrappedAxis.setMaxRange(range.min, range.max);
      };

      /**
       * Clears the range constraints by setting bounds to [<code>-1 * Number.MAX_VALUE</code>, <code>Number.MAX_VALUE</code>].
       */
      this.clearRangeConstraints = function() {
         self.constrainRangeTo(null, null)
      };

      /**
       * Constrains the range of the axis so that the user cannot pan/zoom deeper than the specified range.
       *
       * @param {AxisRange|number|null} rangeOrMin - an {@link AxisRange} a double representing the minimum value. If
       * <code>null</code>, undefined, non-numeric, or not an <code>AxisRange</code>, then
       * <code>-1*Number.MAX_VALUE</code> is used instead.
       * @param {number|null} max - the max value. If <code>null</code>, undefined, or non-numeric, then
       * <code>Number.MAX_VALUE</code> is used instead.  This argument is ignored (but required) if the first argument
       * is an {@link AxisRange}.
       * @param {boolean} [willNotPad=false] - whether to pad the range
       */
      this.constrainMinRangeTo = function(rangeOrMin, max, willNotPad) {
         var range = validateAxisRange(rangeOrMin, max);

         // pad, if desired
         if (!willNotPad) {
            range = padRange(range);
         }

         wrappedAxis.setMinRangeConstraints(range.min, range.max);
      };

      /**
       * Clears the range constraints by setting bounds to [<code>-1 * Number.MAX_VALUE</code>,
       * <code>Number.MAX_VALUE</code>].
       */
      this.clearMinRangeConstraints = function() {
         self.constrainMinRangeTo(null, null);
      };

      /**
       * Sets the height of the axis.
       *
       * @param {int} height - the new height
       */
      this.setHeight = function(height) {
         var element = $("#" + elementId);
         element.height(height);
         wrappedAxis.setSize(element.width(), height, SequenceNumber.getNext());
      };

      var padRange = function(range) {
         var paddedRange = {
            min : range.min,
            max : range.max
         };

         var yDiff = paddedRange.max - paddedRange.min;
         if (isFinite(yDiff)) {
            var padding;
            if (yDiff < 1e-10) {
               padding = 0.5;
            }
            else {
               padding = 0.05 * yDiff;
            }

            paddedRange.min -= padding;
            paddedRange.max += padding;
         }

         return paddedRange;
      };

      // the "constructor"
      (function() {
         var range = {
            min : isNumeric(yMin) ? yMin : 0,
            max : isNumeric(yMax) ? yMax : 100
         };

         // pad, if desired and possible
         if (!willNotPadRange) {
            range = padRange(range);
         }

         wrappedAxis = new NumberAxis(elementId, "vertical", range);

         // set the size
         var element = $("#" + elementId);
         wrappedAxis.setSize(element.width(), element.height(), SequenceNumber.getNext());
      })();
   };

   /**
    * Wrapper class to make it easier to work with a DataSeriesPlot.
    *
    * @class
    * @constructor
    * @param {string|number} plotId - A identifier for this plot, unique within the PlotContainer.  Must be a number or a string.
    * @param {datasourceFunction} datasource - function with signature <code>function(level, offset, successCallback)</code> resposible for returning tile JSON for the given <code>level</code> and <code>offset</code>
    * @param {org.bodytrack.grapher.DateAxis} dateAxis - the date axis
    * @param {org.bodytrack.grapher.YAxis} yAxis - the Y axis
    * @param {Object} [style] - the style object. A default style is used if undefined, null, or not an object.
    * @param {boolean} [isLocalTime=false] - whether the plot's data uses local time. Defaults to false (UTC).
    */
   org.bodytrack.grapher.DataSeriesPlot = function(plotId, datasource, dateAxis, yAxis, style, isLocalTime) {
      var self = this;

      var DEFAULT_STYLE = {
         "styles" : [
            { "type" : "line", "lineWidth" : 1, "show" : true, "color" : "black" },
            { "type" : "circle", "radius" : 2, "lineWidth" : 1, "show" : true, "color" : "black", "fill" : true }
         ],
         "highlight" : {
            "lineWidth" : 1,
            "styles" : [
               {
                  "type" : "circle",
                  "radius" : 3,
                  "lineWidth" : 0.5,
                  "show" : true,
                  "color" : "#ff0000",
                  "fill" : true
               },
               {
                  "show" : true,
                  "type" : "value",
                  "fillColor" : "#000000",
                  "marginWidth" : 10,
                  "font" : "7pt Helvetica,Arial,Verdana,sans-serif",
                  "verticalOffset" : 7,
                  "numberFormat" : "###,##0.#"
               }
            ]
         }
      };

      var wrappedPlot = null;

      /**
       * Returns the plot's ID.
       *
       * @returns {string|number}
       */
      this.getId = function() {
         return plotId;
      };

      /**
       * Returns the wrapped <code>DataSeriesPlot</code> object.
       *
       * @returns {DataSeriesPlot}
       */
      this.getWrappedPlot = function() {
         return wrappedPlot;
      };

      /**
       * Gets statistcs about the data within the specified time range.  Note that some implementations may limit the
       * time range for the statistics to the current visible date range.
       *
       * @param {AxisRange|number} rangeOrMinTimeSecs - an {@link AxisRange} or a double representing the time in Unix
       * time seconds of the start of the visible time range. If <code>null</code>, undefined, non-numeric, or not an
       * <code>AxisRange</code>, then <code>-1*Number.MAX_VALUE</code> is used instead.
       * @param {number} [maxTimeSecs] - a double representing the time in Unix time seconds of the end of the visible
       * time range. If <code>null</code>, undefined, or non-numeric, then <code>Number.MAX_VALUE</code> is used
       * instead.
       * @returns {PlotStatistics}
       */
      this.getStatisticsWithinRange = function(rangeOrMinTimeSecs, maxTimeSecs) {
         var validRange = validateAxisRange(rangeOrMinTimeSecs, maxTimeSecs);

         var rawStatistics;
         if (typeof wrappedPlot.getSimpleStatistics === 'function') {
            rawStatistics = wrappedPlot.getSimpleStatistics(validRange.min, validRange.max);
         } else if (typeof wrappedPlot.getMinMaxValuesWithinTimeRange === 'function') {
            var result = wrappedPlot.getMinMaxValuesWithinTimeRange(validRange.min, validRange.max);
            rawStatistics = {
               count : null,
               y_min : result ? result.min : null,
               y_max : result ? result.max : null,
               has_data : !!(result && result.min != null && result.max != null)
            }
         }

         return {
            count : rawStatistics['count'],
            hasData : rawStatistics['has_data'],
            minValue : rawStatistics['has_data'] ? rawStatistics['y_min'] : null,
            maxValue : rawStatistics['has_data'] ? rawStatistics['y_max'] : null
         };
      };

      /**
       * Sets the plot's cursor to the color described by the given <code>colorDescriptor</code>, or to black if the
       * given <code>colorDescriptor</code> is undefined, <code>null</code>, or invalid. The color descriptor can be any
       * valid CSS color descriptor such as a word ("green", "blue", etc.), a hex color (e.g. "#ff0000"), or an RGB
       * color (e.g. "rgb(255,0,0)" or "rgba(0,255,0,0.5)").
       *
       * @param {string} colorDescriptor - a string description of the desired color.
       */
      this.setCursorColor = function(colorDescriptor) {
         var theStyle = self.getStyle();

         if (!("cursor" in theStyle)) {
            theStyle["cursor"] = { color : null };
         }
         theStyle["cursor"]['color'] = colorDescriptor;

         self.setStyle(theStyle);
      };

      /**
       * A data point object.
       *
       * @typedef {Object} DataPoint
       * @property {number} value - the data point's value
       * @property {number} date - the data point's timestamp
       * @property {string} valueString - the data point's value, expressed as a string
       * @property {string} dateString - the data point's timestamp, expressed as a string
       * @property {string} comment - the comment associated with the data point, or <code>null</code> if no comment exists
       */

      /**
       * Function for handling data point events.  Note that the object passed to the function may be <code>null</code>.
       *
       * @callback dataPointListenerFunction
       * @param {DataPoint|null} dataPoint - the {@link DataPoint}
       */

      /**
       * Adds the given function as a data point listener.  Does nothing if the given <code>listener</code> is not a
       * function.
       *
       * @param {dataPointListenerFunction} listener - function for handling a <code>DataPoint</code> event.
       */
      this.addDataPointListener = function(listener) {
         if (typeof listener === 'function') {
            wrappedPlot.addDataPointListener(listener);
         }
      };

      /**
       * Removes the given data point listener.  Does nothing if the given <code>listener</code> is not a function.
       *
       * @param {dataPointListenerFunction} listener - function for handling a <code>DataPoint</code> event.
       */
      this.removeDataPointListener = function(listener) {
         if (typeof listener === 'function') {
            wrappedPlot.removeDataPointListener(listener);
         }
      };

      /**
       * Returns the plot's current style.
       *
       * @returns {Object} the style
       */
      this.getStyle = function() {
         return wrappedPlot.getStyle();
      };

      /**
       * Sets the plot's style.
       *
       * @param {Object} the style
       */
      this.setStyle = function(style) {
         return wrappedPlot.setStyle(style);
      };

      /**
       * Returns the closest <code>DataPoint</code> in this plot to the given <code>timeInSecs</code>, within the window
       * of time <code>[timeInSecs - numSecsBefore, timeInSecs + numSecsAfter]</code>.  Returns <code>null</code> if no
       * point exists in the time window.
       *
       * @param timeInSecs - the time, in seconds, around which the window of time to look for the closest point is defined
       * @param numSecsBefore - when defining the time window in which to look for the closest point, this is the number of seconds before the timeInSecs
       * @param numSecsAfter - when defining the time window in which to look for the closest point, this is the number of seconds after the timeInSecs
       * @returns {DataPoint|null}
       */
      this.getClosestDataPointToTimeWithinWindow = function(timeInSecs, numSecsBefore, numSecsAfter) {
         return wrappedPlot.getClosestDataPointToTimeWithinWindow(timeInSecs, numSecsBefore, numSecsAfter);
      };

      // the "constructor"
      (function() {
         if (typeof style !== 'object' || style == null) {
            style = JSON.parse(JSON.stringify(DEFAULT_STYLE));
         }

         wrappedPlot = new DataSeriesPlot(datasource,
                                          dateAxis.getWrappedAxis(),
                                          yAxis.getWrappedAxis(),
               {
                  "style" : style,
                  "localDisplay" : !!isLocalTime
               });
      })();
   };

   /**
    * Wrapper class to make it easier to work with a plot container.
    *
    * @class
    * @constructor
    * @param {string} elementId - the DOM element ID for the container div holding this plot container
    * @param {org.bodytrack.grapher.DateAxis} dateAxis - the date axis
    */
   org.bodytrack.grapher.PlotContainer = function(elementId, dateAxis) {
      var self = this;

      var wrappedPlotContainer = null;
      var yAxesAndPlotCount = {};
      var plotsAndYAxes = {};

      /**
       * Returns the DOM element ID for the container div holding this plot container.
       *
       * @returns {string}
       */
      this.getElementId = function() {
         return elementId;
      };

      /**
       * Returns the {@link org.bodytrack.grapher.YAxis YAxis} for the specified DOM element ID.  Returns
       * <code>null</code> if no such axis exists. If the given <code>yAxisElementId</code> is undefined or <code>null</code>,
       * this method returns the first Y axis found, or <code>null</code> if none have been added.
       *
       * @param {string} [yAxisElementId] - the DOM element ID for the container div holding the desired Y axis
       * @returns {org.bodytrack.grapher.YAxis}
       */
      this.getYAxis = function(yAxisElementId) {
         var yAxisAndPlotCount = getItemFromHashOrFindFirst(yAxesAndPlotCount, yAxisElementId);
         if (yAxisAndPlotCount) {
            return yAxisAndPlotCount.yAxis;
         }

         return null;
      };

      /**
       * Returns the {@link org.bodytrack.grapher.DataSeriesPlot YAxis} with the specified <code>plotId</code>. Returns
       * <code>null</code> if no such plot exists.  If the given <code>plotId</code> is undefined or <code>null</code>,
       * this method returns the first plot found, or <code>null</code> if none have been added.
       *
       * @param {string|number} [plotId] - A identifier for the plot, unique within the PlotContainer.  Must be a number or a string.
       * @returns {org.bodytrack.grapher.DataSeriesPlot}
       */
      this.getPlot = function(plotId) {
         var plotAndYAxis = getItemFromHashOrFindFirst(plotsAndYAxes, plotId);
         if (plotAndYAxis) {
            return plotAndYAxis.plot;
         }

         return null;
      };

      /**
       * Adds a data series plot to the plot container. The plot will be associated with the Y axis specified by the
       * given <code>yAxisElementId</code> (the Y axis may be shared with other plots, if you wish).
       *
       * @param {string|number} plotId - A identifier for this plot, unique within the PlotContainer.  Must be a number or a string.
       * @param {datasourceFunction} datasource - function with signature <code>function(level, offset, successCallback)</code> resposible for returning tile JSON for the given <code>level</code> and <code>offset</code>
       * @param {string} yAxisElementId - the DOM element ID for the container div holding this plot's Y axis
       * @param {number} [minValue=0] - the minimum initial value for the Y axis (if the Y axis is created for this plot). Defaults to 0 if undefined, <code>null</code>, or non-numeric.
       * @param {number} [maxValue=100] - the maximum initial value for the Y axis (if the Y axis is created for this plot). Defaults to 100 if undefined, <code>null</code>, or non-numeric.
       * @param {Object} [style] - the style object. A default style is used if undefined, null, or not an object.
       * @param {boolean} [isLocalTime=false] - whether the plot's data uses local time. Defaults to false (UTC).
       */
      this.addDataSeriesPlot = function(plotId, datasource, yAxisElementId, minValue, maxValue, style, isLocalTime) {
         // validation
         if (!isNumberOrString(plotId)) {
            throw new Error("The plotId must be a number or a string.")
         }

         if (plotId in plotsAndYAxes) {
            throw new Error("The plotId must be unique to the PlotContainer.")
         }

         if (typeof datasource !== 'function') {
            throw new Error("The datasource must be a function.");
         }

         if (!isNumberOrString(yAxisElementId)) {
            throw new Error("The yAxisElementId must be a number or a string.")
         }

         if (typeof minValue === 'undefined' || minValue == null) {
            minValue = 0;
         }
         else if (!isNumeric(minValue)) {
            throw new Error("The minValue must be a number.")
         }

         if (typeof maxValue === 'undefined' || maxValue == null) {
            maxValue = 100;
         }
         else if (!isNumeric(maxValue)) {
            throw new Error("The maxValue must be a number.")
         }

         // create the Y axis, if necessary
         var yAxis = null;
         if (yAxisElementId in yAxesAndPlotCount) {
            // this Y axis is already used by another plot, so just get the axis and increment its plot count
            yAxis = yAxesAndPlotCount[yAxisElementId].yAxis;
            yAxesAndPlotCount[yAxisElementId].plotCount++;
         }
         else {
            // this is a new Y axis, so create it and initialize its plot count to 1
            yAxis = new org.bodytrack.grapher.YAxis(yAxisElementId,    // DOM element ID
                                                    minValue,          // initial min value for the y axis
                                                    maxValue);         // initial max value for the y axis

            yAxesAndPlotCount[yAxisElementId] = {
               yAxis : yAxis,
               plotCount : 1
            };
         }

         // create the plot
         var plot = new org.bodytrack.grapher.DataSeriesPlot(plotId, datasource, dateAxis, yAxis, style, isLocalTime);

         plotsAndYAxes[plotId] = {
            plot : plot,
            yAxisElementId : yAxisElementId
         };

         // finally, add the plot to the plot container
         wrappedPlotContainer.addPlot(plot.getWrappedPlot());
      };

      /**
       * Removed the plot with the given <code>plotId</code> from this PlotContainer.
       *
       * @param {string|number} plotId - A identifier for the plot to remove, unique within the PlotContainer.  Must be a number or a string.
       */
      this.removePlot = function(plotId) {
         if (plotId in plotsAndYAxes) {
            var plot = plotsAndYAxes[plotId].plot.getWrappedPlot();
            var yAxisElementId = plotsAndYAxes[plotId].yAxisElementId;

            // remove the plot from the PlotContainer
            wrappedPlotContainer.removePlot(plot);

            // remove the plot from our collection
            delete plotsAndYAxes[plotId];

            // decrement the number of plots using this Y axis
            yAxesAndPlotCount[yAxisElementId].plotCount--;

            // see whether this Y axis is used by any other plots.  If not, remove it.
            if (yAxesAndPlotCount[yAxisElementId].plotCount <= 0) {
               delete yAxesAndPlotCount[yAxisElementId];
               // TODO: figure out a better way to remove the contents of the y axis
               $("#" + yAxisElementId).find("canvas").remove();
            }
         }
      };

      /**
       * Removes all plots from this PlotContainer.
       */
      this.removeAllPlots = function() {
         Object.keys(plotsAndYAxes).forEach(function(plotId) {
            self.removePlot(plotId);
         });
      };

      /**
       * Sets the cursor for each contained plot to the color described by the given <code>colorDescriptor</code>, or to
       * black if the given <code>colorDescriptor</code> is undefined, <code>null</code>, or invalid. The color
       * descriptor can be any valid CSS color descriptor such as a word ("green", "blue", etc.), a hex color
       * (e.g. "#ff0000"), or an RGB color (e.g. "rgb(255,0,0)" or "rgba(0,255,0,0.5)").
       *
       * @param {string} colorDescriptor - a string description of the desired color.
       */
      this.setCursorColor = function(colorDescriptor) {
         // iterate over every plot and set the cursor color in each
         Object.keys(plotsAndYAxes).forEach(function(plotId) {
            plotsAndYAxes[plotId].plot.setCursorColor(colorDescriptor);
         });
      };

      /**
       * Sets the width of the PlotContainer.
       *
       * @param {int} width - the new width
       */
      this.setWidth = function(width) {
         var element = $("#" + elementId);
         element.width(width);
         wrappedPlotContainer.setSize(width, element.height(), SequenceNumber.getNext());
      };

      /**
       * Sets the height of the PlotContainer and all of its Y axes to the given height.
       *
       * @param {int} height - the new height
       */
      this.setHeight = function(height) {
         var element = $("#" + elementId);
         element.height(height);
         wrappedPlotContainer.setSize(element.width(), height, SequenceNumber.getNext());

         // update the height of the Y axes
         Object.keys(yAxesAndPlotCount).forEach(function(yAxisElementId) {
            var yAxis = yAxesAndPlotCount[yAxisElementId].yAxis;
            yAxis.setHeight(height);
         });
      };

      /**
       * Sets whether autoscaling and autoscale padding are enabled, if supported by the underlying grapher; otherwise does nothing.
       *
       * @param {boolean} isEnabled - whether autoscale is enabled.
       * @param {boolean} [isPaddingEnabled] - whether padding of the autoscaled Y axis is enabled; ignored if
       * <code>isEnabled</code> is <code>false</code>. Defaults to <code>false</code> if <code>undefined</code> or <code>null</code>.
       */
      this.setAutoScaleEnabled = function(isEnabled, isPaddingEnabled) {
         if (typeof wrappedPlotContainer.setAutoScaleEnabled === 'function') {
            wrappedPlotContainer.setAutoScaleEnabled(!!isEnabled, !!isPaddingEnabled);
         } else {
            console.log("WARN: the underlying grapher does not support autoscaling.");
         }
      };

      // the "constructor"
      (function() {
         // The CREATE Lab grapher expects the date axis to be passed in as the 4th element.  The BodyTrack grapher only
         // expects 3 args, so passing the date axis won't hurt anything
         wrappedPlotContainer = new PlotContainer(elementId, false, [], dateAxis.getWrappedAxis());

         // set the width to be the same width as its DateAxis
         self.setWidth(dateAxis.getWidth());
      })();
   };

   /**
    * Creates a <code>PlotManager</code> associated with date axis specified by the given
    * <code>dateAxisElementId</code>. If <code>minTimeSecs</code> and <code>maxTimeSecs</code> are not specified, the
    * visible time range defaults to the past 24 hours.
    *
    * @class
    * @constructor
    * @param {string} dateAxisElementId - the DOM element ID for the container div into which the date axis should be added
    * @param {number} [minTimeSecs=24 hours ago] - a double representing the time in Unix time seconds of the start of the visible time range
    * @param {number} [maxTimeSecs=now] - a double representing the time in Unix time seconds of the end of the visible time range
    */
   org.bodytrack.grapher.PlotManager = function(dateAxisElementId, minTimeSecs, maxTimeSecs) {
      var self = this;

      var dateAxis = null;
      var plotContainers = {};

      var isWindowWidthResizeListeningEnabled = false;
      var widthCalculator = null;

      /**
       * Returns the <code>DateAxis</code> object representing the date axis.
       *
       * @returns {org.bodytrack.grapher.DateAxis} the DateAxis object
       */
      this.getDateAxis = function() {
         return dateAxis;
      };

      /**
       * Returns the {@link org.bodytrack.grapher.YAxis YAxis} for the specified DOM element ID.  Returns
       * <code>null</code> if no such axis exists. If the given <code>yAxisElementId</code> is undefined or
       * <code>null</code>, this method returns the first Y axis found in the first PlotContainer found, or
       * <code>null</code> if no Y axes have been added to any PlotContainer.
       *
       * @param {string} [yAxisElementId] - the DOM element ID for the container div holding the desired Y axis
       * @returns {org.bodytrack.grapher.YAxis}
       */
      this.getYAxis = function(yAxisElementId) {
         // iterate over the PlotContainers this way instead of using self.forEachPlotContainer() so that we can return
         // as soon as we find a matching Y axis.
         var plotContainerElementIds = Object.keys(plotContainers);
         for (var i = 0; i < plotContainerElementIds.length; i++) {
            var plotContainerElementId = plotContainerElementIds[i];
            var plotContainer = plotContainers[plotContainerElementId];
            var yAxis = plotContainer.getYAxis(yAxisElementId);
            if (yAxis != null) {
               return yAxis;
            }
         }

         return null;
      };

      /**
       * Returns the first plot found with the given <code>plotId</code>. Note that since the <code>plotId</code> need
       * only be unique within its {@link org.bodytrack.grapher.PlotContainer PlotContainer}, it is possible to have
       * more than one plot with the same <code>plotId</code> within a PlotManager.  Thus, this is merely a convenience
       * method which iterates over all PlotContainers looking for the specified plot and returns the first one found.
       * If no matching plot is found, this method returns null.  If the given <code>plotId</code> is undefined or
       * <code>null</code>, this method returns the first plot found in the first PlotContainer found, or
       * <code>null</code> if no plots have been added to any PlotContainer.
       *
       * @param {string|number} [plotId] - A identifier for the plot, unique within its {@link org.bodytrack.grapher.PlotContainer PlotContainer}.  Must be a number or a string.
       * @returns {org.bodytrack.grapher.DataSeriesPlot|null}
       */
      this.getPlot = function(plotId) {
         // iterate over the PlotContainers this way instead of using self.forEachPlotContainer() so that we can return
         // as soon as we find a matching plot.
         var plotContainerElementIds = Object.keys(plotContainers);
         for (var i = 0; i < plotContainerElementIds.length; i++) {
            var plotContainerElementId = plotContainerElementIds[i];
            var plotContainer = plotContainers[plotContainerElementId];
            var plot = plotContainer.getPlot(plotId);
            if (plot != null) {
               return plot;
            }
         }

         return null;
      };

      /**
       * Returns the {@link org.bodytrack.grapher.PlotContainer PlotContainer} for the specified DOM element ID. Returns
       * <code>null</code> if no such plot container exists. If the given <code>plotContainerElementId</code> is
       * undefined or <code>null</code>, this method returns the first PlotContainer found, or <code>null</code> if none
       * have been added.
       *
       * @param {string} [plotContainerElementId] - the DOM element ID for the container div holding the desired plot container.
       * @returns {org.bodytrack.grapher.PlotContainer}
       */
      this.getPlotContainer = function(plotContainerElementId) {
         return getItemFromHashOrFindFirst(plotContainers, plotContainerElementId);
      };

      /**
       * Adds a {@link org.bodytrack.grapher.PlotContainer PlotContainer} for the specified DOM element ID. If the
       * PlotContainer has already been added, a new one is not created.  Returns the PlotContainer.
       *
       * @param {string} plotContainerElementId - the DOM element ID for the container div holding the plot container
       * @returns {org.bodytrack.grapher.PlotContainer}
       */
      this.addPlotContainer = function(plotContainerElementId) {
         if (!(plotContainerElementId in plotContainers)) {
            plotContainers[plotContainerElementId] = new org.bodytrack.grapher.PlotContainer(plotContainerElementId, dateAxis);
         }

         return plotContainers[plotContainerElementId];
      };

      /**
       * Removes the plotContainer with the given <code>plotContainerId</code> from this PlotManager.
       *
       * @param {string|number} plotContainerId - A identifier for the plotContainer to remove, unique within the PlotManager.  Must be a number or a string.
       */
      this.removePlotContainer = function(plotContainerElementId) {
        plotContainers[plotContainerElementId].removeAllPlots();
        delete plotContainers[plotContainerElementId];
      };

      /**
       * Removes all PlotContainers from PlotManger.
       */
      this.removeAllPlotContainers = function() {
        Object.keys(plotContainers).forEach(function(plotContainerElementId) {
          self.removePlotContainer(plotContainerElementId);
        });
      };

      /**
       * Function used by a {@link org.bodytrack.grapher.PlotContainer PlotContainer} iterator, used for performing an operation on a given PlotContainer.
       *
       * @callback plotContainerIteratorFunction
       * @param {org.bodytrack.grapher.PlotContainer} plotContainer - the {@link org.bodytrack.grapher.PlotContainer PlotContainer} object
       */

      /**
       * Method for iterating over each of the {@link org.bodytrack.grapher.PlotContainer PlotContainer} instances. Does
       * nothing if the given <code>plotContainerIteratorFunction</code> is not a function.
       *
       * @param {plotContainerIteratorFunction} plotContainerIteratorFunction
       */
      this.forEachPlotContainer = function(plotContainerIteratorFunction) {
         if (typeof plotContainerIteratorFunction === 'function') {
            Object.keys(plotContainers).forEach(function(elementId) {
               plotContainerIteratorFunction(plotContainers[elementId]);
            });
         }
      };

      /**
       * Helper method for adding a plot, shorthand for
       * <code>plotManager.addPlotContainer('plot_container').addDataSeriesPlot(...)</code>.
       *
       * @param {string|number} plotId - A identifier for this plot, unique within the {@link org.bodytrack.grapher.PlotContainer PlotContainer}.  Must be a number or a string.
       * @param {datasourceFunction} datasource - function with signature <code>function(level, offset, successCallback)</code> resposible for returning tile JSON for the given <code>level</code> and <code>offset</code>
       * @param {string} plotContainerElementId - the DOM element ID for the container div into which this plot should be added
       * @param {string} yAxisElementId - the DOM element ID for the container div holding this plot's Y axis
       * @param {number} [minValue=0] - the minimum initial value for the Y axis (if the Y axis is created for this plot). Defaults to 0 if undefined, <code>null</code>, or non-numeric.
       * @param {number} [maxValue=100] - the maximum initial value for the Y axis (if the Y axis is created for this plot). Defaults to 100 if undefined, <code>null</code>, or non-numeric.
       * @param {Object} [style] - the style object. A default style is used if undefined, null, or not an object.
       * @param {boolean} [isLocalTime=false] - whether the plot's data uses local time. Defaults to false (UTC).
       *
       * @see org.bodytrack.grapher.PlotContainer#addDataSeriesPlot
       */
      this.addDataSeriesPlot = function(plotId, datasource, plotContainerElementId, yAxisElementId, minValue, maxValue, style, isLocalTime) {
         self.addPlotContainer(plotContainerElementId).addDataSeriesPlot(plotId,
                                                                         datasource,
                                                                         yAxisElementId,
                                                                         minValue,
                                                                         maxValue,
                                                                         style,
                                                                         isLocalTime);
      };

      /**
       * Helper function which calculates and returns the desired width of the date axis and all plot containers managed
       * by this {@link org.bodytrack.grapher.PlotManager PlotManager}.
       *
       * @callback widthCalculatorFunction
       * @returns {int} the desired width of the date axis
       */

      /**
       * Set whether the PlotManager should auto-resize the width of the date axis and all plot containers upon resize
       * of the browser window. Although the <code>widthCalculatorFunction</code> function is optional, it must be
       * provided at least once (either here or via {@link #setWidthCalculator}) in order for auto-resizing to do
       * anything.  After setting it, you are then free to call this function with only the first argument to toggle
       * auto-resizing.  If the second argument is undefined <code>null</code>, or not a function, the stored function
       * will not be changed.
       *
       * @param {boolean} willAutoResizeWidth - whether the PlotManager should auto resize the width of the date axis
       * and all plot containers upon resize of the browser window.
       * @param {widthCalculatorFunction} [widthCalculatorFunction] - function which calculates and returns the desired width of the date axis
       */
      this.setWillAutoResizeWidth = function(willAutoResizeWidth, widthCalculatorFunction) {
         isWindowWidthResizeListeningEnabled = willAutoResizeWidth;

         if (typeof widthCalculatorFunction === 'function') {
            widthCalculator = widthCalculatorFunction;
         }

         if (isWindowWidthResizeListeningEnabled) {
            updateWidth();
         }
      };

      /**
       * Sets the width calculator if the given <code>widthCalculatorFunction</code> is a function.  Otherwise, sets
       * the calculator to <code>null</code>.
       *
       * @param widthCalculatorFunction
       */
      this.setWidthCalculator = function(widthCalculatorFunction) {
         if (typeof widthCalculatorFunction === 'function') {
            widthCalculator = widthCalculatorFunction;
         }
         else {
            widthCalculator = null;
         }
      };

      /**
       * Sets the width of the date axis and all plot containers to the given width.
       *
       * @param {int} newDesiredWidth - the new width
       */
      this.setWidth = function(newDesiredWidth) {
         dateAxis.setWidth(newDesiredWidth);

         // update the width of the PlotContainers
         self.forEachPlotContainer(function(plotContainer) {
            plotContainer.setWidth(newDesiredWidth);
         });
      };

      var updateWidth = function() {
         if (isWindowWidthResizeListeningEnabled && widthCalculator != null) {
            self.setWidth(widthCalculator());
         }
      };

      /**
       * Sets the cursor to the color described by the given <code>colorDescriptor</code>, or to black if the given
       * <code>colorDescriptor</code> is undefined, <code>null</code>, or invalid. The color descriptor can be any valid
       * CSS color descriptor such as a word ("green", "blue", etc.), a hex color (e.g. "#ff0000"), or an RGB color
       * (e.g. "rgb(255,0,0)" or "rgba(0,255,0,0.5)").
       *
       * @param {string} colorDescriptor - a string description of the desired color.
       */
      this.setCursorColor = function(colorDescriptor) {
         // first set the cursor color in the date axis
         dateAxis.setCursorColor(colorDescriptor);

         // now iterate over every plot container and set the cursor color in each
         self.forEachPlotContainer(function(plotContainer) {
            plotContainer.setCursorColor(colorDescriptor);
         });
      };

      // the "constructor"
      (function() {
         dateAxis = new org.bodytrack.grapher.DateAxis(dateAxisElementId);

         // if the user didn't specify the initial visible time range, default to showing the past 24 hours
         if (!isNumeric(minTimeSecs) || !isNumeric(maxTimeSecs)) {
            // default the date axis to the last 24 hours
            maxTimeSecs = Date.now() / 1000;
            minTimeSecs = maxTimeSecs - (24 * 60 * 60);
         }

         // set the initial time range for the date axis
         dateAxis.setRange(minTimeSecs, maxTimeSecs);

         // set up window resize listener
         $(window).resize(updateWidth);
      })();
   };
})();