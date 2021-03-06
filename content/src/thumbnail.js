var html2canvas = require('html2canvas');
var THUMBNAIL_SIZE = 128;
var NUM_ATTEMPTS = 3;

// Public functions
var thumbnail = {
  generateThumbnailDataUrl: function(iframe, callback) {
    // Get the canvas inside the iframe.
    var innerDoc = iframe.contentDocument || iframe.contentWindow.document;
    var innerBody = innerDoc.body;

    // Copy the NodeList into an array.
    var children = Array.prototype.slice.call(innerBody.children);
    // An extra array to store modified elements.
    var hiddenElements = [];

    // Hide the test panel and coordinates before capturing the thumbnail.
    // Keep a copy of the original style settings in the `hiddenElements` array.
    children.forEach(function(child) {
      if (child.tagName.toLowerCase() === 'samp' &&
          (child.className !== 'turtlefield' || child.id == '_testpanel')) {
        hiddenElements.push({
          object: child,
          display: child.style.display
        });
        child.style.display = 'none';
      }
    });

    function onRendered(canvas) {
      // Restore the display attribute of the elements.
      hiddenElements.forEach(function(element) {
        element.object.style.display = element.display;
      });
      callback(getImageDataUrl(canvas));
    }

    function tryHtml2canvas(numAttempts) {
      if (numAttempts > 0) {
        html2canvas(innerBody).then(onRendered, function(e) {
          console.log('html2canvas failed, retrying...');
          tryHtml2canvas(numAttempts - 1);
        });
      } else {
        // If it gets here, that means all attempts have failed.
        // Then just call the callback with empty string.
        callback('');
      }
    }

    // Try calling `html2canvas`.
    tryHtml2canvas(NUM_ATTEMPTS);
  }
}

// Private functions
function getImageDataUrl(canvas) {
  var w = canvas.width;
  var h = canvas.height;
  var ctx = canvas.getContext('2d');
  var imageData = ctx.getImageData(0, 0, w, h);

  // Initialize the coordinates for the image region,
  // topLeft is initialized to bottom right,
  // and bottomRight is initialized to top left.
  var topLeft = { x: h, y: w };
  var bottomRight = { x: 0, y: 0 };

  // Iterate through all the points to find the "interesting" region.
  var x, y, index;
  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      // Every pixel takes up 4 slots in the array, contains R, G, B, A.
      index = (y * w + x) * 4;
      // Thus `index + 3` is the index of the Alpha value.
      if (imageData.data[index + 3] > 0) {
        if (x < topLeft.x) {
          topLeft.x = x;
        }
        if (x > bottomRight.x) {
          bottomRight.x = x;
        }
        if (y < topLeft.y) {
          topLeft.y = y;
        }
        if (y > bottomRight.y) {
          bottomRight.y = y;
        }
      }
    }
  }

  // Calculate the actual image size.
  var imageWidth = bottomRight.x - topLeft.x + 1;
  var imageHeight = bottomRight.y - topLeft.y + 1;

  // This means the thumbnail is blank, should just return.
  if (imageWidth <= 0 || imageHeight <= 0) {
    return '';
  }

  // Find the longer edge and make it a square.
  var longerEdge = Math.max(Math.min(imageWidth, h), Math.min(imageHeight, w));
  var diff = Math.abs((imageWidth - imageHeight) / 2);
  if (imageWidth > imageHeight) {
    topLeft.y = Math.max(topLeft.y - diff, 0);
  } else {
    topLeft.x = Math.max(topLeft.x - diff, 0);
  }

  // Draw the cropped image in a temp canvas and scale it down.
  var tempCanvas = document.createElement('canvas');
  var tempCanvasCtx = tempCanvas.getContext('2d');
  tempCanvas.width = THUMBNAIL_SIZE;
  tempCanvas.height = THUMBNAIL_SIZE;
  if (longerEdge < THUMBNAIL_SIZE) {
    var offset = THUMBNAIL_SIZE / 2 - longerEdge / 2;
    tempCanvasCtx.drawImage(canvas,       // Src canvas.
        topLeft.x, topLeft.y,             // Src coordinates.
        longerEdge, longerEdge,           // Src coordinates.
        offset, offset,                   // Dest coordinates.
        longerEdge, longerEdge);          // Dest size.
  } else {
    tempCanvasCtx.drawImage(canvas,       // Src canvas.
        topLeft.x, topLeft.y,             // Src coordinates.
        longerEdge, longerEdge,           // Src coordinates.
        0, 0,                             // Dest coordinates.
        THUMBNAIL_SIZE, THUMBNAIL_SIZE);  // Dest size.
  }

  // Convert the temp canvas to data url and return.
  return tempCanvas.toDataURL();
}

module.exports = thumbnail;
