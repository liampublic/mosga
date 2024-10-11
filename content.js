let isHighlightingEnabled = false;
let highlightOverlay;
let highlightColors = ['#FFFF00', '#90EE90', '#ADD8E6', '#FFB6C1', '#FFA500'];
let highlightedRanges = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleHighlight") {
    isHighlightingEnabled = !isHighlightingEnabled;
    if (isHighlightingEnabled) {
      createOverlay();
      document.addEventListener('mouseup', handleSelection);
    } else {
      removeOverlay();
      document.removeEventListener('mouseup', handleSelection);
    }
    sendResponse({status: "Highlighting " + (isHighlightingEnabled ? "enabled" : "disabled")});
  } else if (request.action === "clearHighlights") {
    clearHighlights();
    sendResponse({status: "Highlights cleared"});
  }
  return true;
});

function createOverlay() {
  highlightOverlay = document.createElement('div');
  highlightOverlay.id = 'web-highlighter-overlay';
  highlightOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 9999;
  `;
  document.body.appendChild(highlightOverlay);
}

function removeOverlay() {
  if (highlightOverlay && highlightOverlay.parentNode) {
    highlightOverlay.parentNode.removeChild(highlightOverlay);
  }
}

function handleSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  highlightRange(range);

  selection.removeAllRanges();
}

function highlightRange(range) {
  const startNode = range.startContainer;
  const endNode = range.endContainer;
  const commonAncestor = range.commonAncestorContainer;

  const color = getNextColor();

  if (startNode === endNode) {
    createHighlightForNode(startNode, range.startOffset, range.endOffset, color);
  } else {
    const nodeIterator = document.createNodeIterator(commonAncestor, NodeFilter.SHOW_TEXT);
    let currentNode;
    let highlightStarted = false;

    while (currentNode = nodeIterator.nextNode()) {
      if (currentNode === startNode) {
        createHighlightForNode(currentNode, range.startOffset, currentNode.length, color);
        highlightStarted = true;
      } else if (currentNode === endNode) {
        createHighlightForNode(currentNode, 0, range.endOffset, color);
        break;
      } else if (highlightStarted) {
        createHighlightForNode(currentNode, 0, currentNode.length, color);
      }
    }
  }
}

function createHighlightForNode(textNode, startOffset, endOffset, color) {
  const range = document.createRange();
  range.setStart(textNode, startOffset);
  range.setEnd(textNode, endOffset);

  const clientRects = range.getClientRects();
  for (let i = 0; i < clientRects.length; i++) {
    createHighlightElement(clientRects[i], color);
  }
}

function createHighlightElement(rect, color) {
  const highlight = document.createElement('div');
  highlight.className = 'web-highlighter-highlight';
  
  const existingHighlights = getExistingHighlightsAtRect(rect);
  
  if (existingHighlights.length > 0) {
    const existingColor = getComputedStyle(existingHighlights[0]).backgroundColor;
    highlight.style.cssText = `
      position: absolute;
      background-image: repeating-linear-gradient(
        45deg,
        ${color} 0px,
        ${color} 10px,
        ${existingColor} 10px,
        ${existingColor} 20px
      );
      opacity: 0.5;
      pointer-events: none;
      top: ${rect.top + window.pageYOffset}px;
      left: ${rect.left + window.pageXOffset}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
    `;
  } else {
    highlight.style.cssText = `
      position: absolute;
      background-color: ${color};
      opacity: 0.3;
      pointer-events: none;
      top: ${rect.top + window.pageYOffset}px;
      left: ${rect.left + window.pageXOffset}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
    `;
  }
  
  highlightOverlay.appendChild(highlight);
}

function getExistingHighlightsAtRect(rect) {
  const existingHighlights = Array.from(highlightOverlay.children);
  return existingHighlights.filter(highlight => {
    const highlightRect = highlight.getBoundingClientRect();
    return (
      rect.left < highlightRect.right &&
      rect.right > highlightRect.left &&
      rect.top < highlightRect.bottom &&
      rect.bottom > highlightRect.top
    );
  });
}

function getNextColor() {
  return highlightColors[Math.floor(Math.random() * highlightColors.length)];
}

function clearHighlights() {
  if (highlightOverlay) {
    highlightOverlay.innerHTML = '';
  }
  highlightedRanges = [];
}