(function(){
'use strict';

// Draw the graph
var currentData,
  visualizeArray = [],
  valueArray     = [],
  dateArray      = [],
  tooltips       = [],
  visualizeState = [true],
  yMax,
  xMax,
  numhlines = 8,
  numvlines = 10,
  //angle,
  day,
  line, scatter, combo,
  colors = [
      '#0000dd','#dd0000','#21B6A8','#87907D','#ec6d66',
      '#177F75','#B6212D','#B67721','#da2d8b','#7F5417',
      '#FF8000','#61e94c','#FFCC00','#68BD66','#179CE8',
      '#30769E','#758a09','#00CCFF','#FFC080','#4086AA',
      '#0000AA','#AA6363','#AA9900','#1A8BC0','#758a09',
      '#dd3100','#af2a30','#179999','#a92e03','#f30320',
      '#579108','#ce9135','#acd622','#e46e46','#53747d',
      '#36a62a','#12c639','#f51b2b','#985d27','#3595d5',
      '#c28551','#d52192','#695faf','#de2426','#295d5a',
      '#824b2d','#e82a3c','#fcd11a','#2b4c04','#3011fd',
      '#af2a30','#c456d1','#025df6','#0ab24f','#c0d962',
      '#62369f','#fb453c','#0487a4','#ce9e07','#2b407e'
  ],
  currentSelection=-1;

/*
  Shows the linecountForm or an error if no data is there
*/
function selectBox() {
  var box=$('#selectBox')
  
  //Initialize select box with elements
  if(valueArray.length > 0) {
    
    var maxIndex = Math.min(valueArray.length, colors.length);
    
    // Fill the select box
    for(var i=0; i<parseInt(maxIndex/2, 10); ++i) {
      box.append(jQuery('<option />', {'value': i, text: 'Wertepaar '+(i+1)}));
    }
    $('#selectBox option').eq(0).prop('selected', true);

    // Handle the Dropdown selection
    box.on('change', function (e) {
      var i = $(this).val();
      
      if(currentSelection!=-1){
        visualizeState[currentSelection*2] = false;
        visualizeState[currentSelection*2+1] = false;
      }
      visualizeState[i*2] = true;
      visualizeState[i*2+1] = true;
      currentSelection=i;
      
      // Create the visualization array
      initializeVisualizationArray();

      // Update the graph
      line.original_data = visualizeArray;

      // Redraw
      graphNS.redraw();
    });

    // Show the form and hide the error
    $('#noDataLabel').fadeOut(undefined, function() {
      // Show the data and finish progress bar
      $('.customSelect').fadeIn(undefined,
        NProgress.done);
    });
  } else {
    $('.customSelect').fadeOut(undefined, function() {
      // Show the data and finish progress bar
      $('#noDataLabel').fadeIn(undefined,
        NProgress.done);
    });
  }
}

/*
  Creates the labels for the graph, depending on the width of the screen
*/
function createLabels() {
  dateArray = [];

  /*// The maximum amount of tooltips is 10; if the window gets smaller these amount is reduced.
  var maxTooltips = Math.min(10, Math.round($('#data').width()/80)),
    skip        = Math.max(1, Math.round(currentData.length/maxTooltips)),
    numhlines = Math.min(10, Math.round($('#data').height()/50));

  // Save the dates in the dateArray; we want 10 dates max,
  // equally distributed over the available dates
  for(var i=currentData.length-1; i>=0; i-=skip) {
    dateArray.unshift([moment(currentData[i].date).format("HH:mm:ss"),i]);
  }
  numvlines = dateArray.length;*/
  for(var i=0; i<currentData.length; i++) {
    dateArray.push([moment(currentData[i].date).format("HH:mm:ss"), i]);
  }
  numvlines = dateArray.length-1;
  xMax=numvlines;
}

/*
  Set the values in the vizualisation array.
*/
function initializeVisualizationArray() {
  var tmp;

  visualizeArray = [];
  // Place the values in the vizualization array
  for(var i=0; i<valueArray.length; ++i) {
    // Just visualize when the checkbox is checked
    if(visualizeState[i]) {
      tmp = valueArray[i];
    } else {
      tmp = [];
    }

    visualizeArray.push(tmp);
  }
}

/*
  Rearranges the data, so it can be properly visualized in a line graph.
*/
function arrangeData(data) {
  if(data === undefined || data.length === 0) return;
  // Save the current data
  currentData = data;
  /*  Create a large enough array to store the values of each sensor;
    since there can "pop up" new values from a new sensor at any time,
    or old ones disappear, it is necessary to check for the amount of
    values on both ends of the data array and pick the maximum. */
  valueArray = new Array(Math.max(data[0].values.length, data[data.length-1].values.length));

  // Save the current day
  day = moment(data[0].date).format("DD-MMMM-YYYY");

  // Create the labels
  createLabels();

  var currVal;
  //(re)initialize height;
  yMax = 1;
  // Get the values out of the data
  // We need to iterate through the values array from behind, so we have the first values for the first graph
  for(var i=valueArray.length-1; i>=0; --i) {
    valueArray[i] = [];
    // Get the last element and push it in the valueArray
    for(var k=0; k<data.length; ++k) {
      currVal = data[k].values.pop();

      // Check if the current value is bigger than the max val
      if(currVal > yMax) yMax = currVal - currVal%numhlines + numhlines;

      valueArray[i].push(currVal);
    }
  }
  /*
    The first array of valueArray are now all first values (one sensor)
    of the data object. The first element of this array is the earliest
    value while the last one is the latest. We are able to draw multiple
    lines, for each sensor one, with this.
  */

  // Initialize the visualizeState array
  var curr;
  for(var i = 1; i<valueArray.length; ++i) {
    if(visualizeState[i] === undefined) visualizeState[i] = false;
  }

  // Init the vizualisation array
  initializeVisualizationArray();

  // Make the tooltips
  tooltips = [];
  for(var i=0; i<valueArray.length; ++i) {
    tooltips[i] = [];
    for(var k=0; k<valueArray[i].length; ++k) {
      // Save the values in the tooltips
      tooltips[i].push(""+valueArray[i][k]);
    }
  }
}

// This function returns the proper tooltip for the graph
// Index is the index of the tooltip of the visible graphs starting at 0
function getTooltip(index) {
  var curr;

  // We have to find the tooltip from the tooltips of the visible graphs, so we have to skip the invisible ones
  for(var i=0; i<tooltips.length; ++i) {
    // Check if the graph is visible; if not then skip this one
    if(!visualizeState[i]) continue;

    // Save the current array for easier handling
    curr = tooltips[i];

    // If index is smaller than the length of the current tooltip array, we have reached the correct graph
    if(index < curr.length) return curr[index];

    // If not, we reduce the index
    index -= curr.length;
  }

  // We didn't find a tooltip, so we return nothing
}

// READY
$(document).ready(function() {
  // Set up the Socket.IO connection
  var socket = io.connect('http://'+window.location.host+'/data', {transports: ['xhr-polling']});
  
  // First message
  socket.on('first', function(message) {
    if(message === undefined) return;
    
    // Arrange the data
    arrangeData(message.data);
    
    // Better interface for the select box
    $('#selectBox').customSelect();
    
    // Initialise the select box
    selectBox();
           
    // Create the graph
    scatter = new RGraph.Scatter('graph', [])
      .Set('labels', dateArray)
      .Set('ymax', yMax)
      .Set('xmax', xMax)
      .Set('scale.round', true)
      .Set('background.grid.autofit.numhlines', numhlines)
      .Set('background.grid.autofit.numvlines', numvlines)
      .Set('ylabels.count', numhlines)
      .Set('numyticks',numhlines*2)
           .Set('numxticks',numvlines)
           .Set('noendtick.bottom',false);
           
               
    line = new RGraph.Line('graph', visualizeArray)
      .Set('colors', colors)
      .Set('linewidth', 2)
      .Set('title', day)
      .Set('ylabels',false)
      .Set('numyticks',0)
      .Set('numxticks',0)
      // .Set('title.xaxis.pos', .15)
      // .Set('gutter.bottom', 45)
      // .Set('text.size', 11)
      .Set('background.grid.hlines',false)
      .Set('background.grid.vlines',false)
      .Set('tickmarks', 'circle')
      .Set('tooltips', getTooltip)
      .Set('ymax', yMax)
      .Set('xmax', xMax)
      //.Set('scale.round', true);
           

    //combo = new RGraph.CombinedChart(scatter, line);
    // Draw
    line.Draw();
    scatter.Draw();
    
    // Save it in the graph namespace
    graphNS.graph = [scatter,line];
    
    // Trigger change of the select to show the values at start
    $('#selectBox').trigger('change');
    
    // Show the graph
    graphNS.showData();
    
  });
  // New data event
  socket.on('data', function(message) {
    if(message === undefined) return;

    // Arrange the data
    arrangeData(message.data);

    // Update the graph
    line.original_data = visualizeArray;
    scatter.Set('labels', dateArray)
        .Set('ymax', yMax)
        .Set('background.grid.autofit.numvlines', numvlines)
            
    line.Set('title', day)
      .Set('ymax', yMax);

    // Redraw
    graphNS.redraw();
  });

  // Resize event; let the labels fit the page width
  graphNS.resize = function() {
    createLabels();
    line.Set('labels', dateArray)
    .Set('chart.background.grid.autofit.numvlines', numvlines)        
    .Set('chart.numxticks',numvlines);
  };
});

})();