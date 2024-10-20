// Load the PDF document
pdfjsLib.getDocument(url).promise.then(function(pdf) {
    // Fetch the first page
    pdf.getPage(1).then(function(page) {
      var scale = 1.5;
      var viewport = page.getViewport({ scale: scale });
  
      // Prepare canvas using PDF page dimensions
      var canvas = document.createElement('canvas');
      var context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
  
      // Render PDF page into canvas context
      var renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      page.render(renderContext);
  
      // Append canvas to body
      document.body.appendChild(canvas);
    });
  });