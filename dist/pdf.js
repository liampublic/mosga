pdfjsLib.getDocument(url).promise.then((function(e){e.getPage(1).then((function(e){var t=e.getViewport({scale:1.5}),n=document.createElement("canvas"),i=n.getContext("2d");n.height=t.height,n.width=t.width;var o={canvasContext:i,viewport:t};e.render(o),document.body.appendChild(n)}))}));