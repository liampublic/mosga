// Add this type definition at the top of your file
type CaretPosition = {
  offsetNode: Node;
  offset: number;
};

interface HighlightedRange {
  elements: HTMLElement[];
  color: string;
}

let isHighlightingEnabled = false;
let highlightOverlay;
let highlightColors = ['#FFFF00', '#90EE90', '#ADD8E6', '#FFB6C1', '#FFA500'];
let highlightedRanges: HighlightedRange[] = [];

let currentNode: Node | null = null;
let currentOffset: number = 0;
let cursorElement: HTMLElement | null = null;
let cursorInterval: number | null = null;
let mainContentElement: Element | null = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleHighlight") {
    isHighlightingEnabled = !isHighlightingEnabled;
    if (isHighlightingEnabled) {
      addHighlightStyles();
      document.addEventListener('mouseup', highlightSelection);
    setupVimNavigation();
    } else {
      clearHighlights();
      document.removeEventListener('mouseup', highlightSelection);
      document.removeEventListener('keydown', handleVimKeys);
      if (cursorElement) {
        cursorElement.remove();
        cursorElement = null;
      }
      if (cursorInterval) {
        clearInterval(cursorInterval);
        cursorInterval = null;
      }
    }
    sendResponse({status: "Highlighting " + (isHighlightingEnabled ? "enabled" : "disabled")});
  } else if (request.action === "clearHighlights") {
    clearHighlights();
    sendResponse({status: "Highlights cleared"});
  }
  return true;
});

function addHighlightStyles() {
  const style = document.createElement('style');
  style.textContent = `
    mark.web-highlighter-highlight {
      background-color: inherit !important;
      color: inherit;
      padding: 0;
      margin: 0;
      display: inline;
      font-size: inherit;
      font-weight: inherit;
      line-height: inherit;
      text-decoration: inherit;
    }
  `;
  document.head.appendChild(style);
}

function highlightSelection(): void {
  console.log('highlightSelection called');
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    console.log('No selection range');
    return;
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    console.log('Range is collapsed, not highlighting');
    return;
  }

  console.log('Selection range:', range);

  const color = getNextColor();
  const highlightedElements = createHighlightElements(range, color);

  if (highlightedElements.length > 0) {
    highlightedRanges.push({
      elements: highlightedElements,
      color: color
    });
    console.log('Added highlights to highlightedRanges:', highlightedElements);
  }

  selection.removeAllRanges();
  console.log('Selection cleared');
}

function createHighlightElements(range: Range, color: string): HTMLElement[] {
  console.log('createHighlightElements called with range:', range);
  const highlightedElements: HTMLElement[] = [];

  let count = 0;

  const iterator = document.createNodeIterator(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = iterator.nextNode()) !== null) {
    count++;

    console.log('count', count);
    if (count > 500) {
      return highlightedElements;
    }

    if (!range.intersectsNode(node)) {
      continue;
    }

    const start = (node === range.startContainer) ? range.startOffset : 0;
    const end = (node === range.endContainer) ? range.endOffset : node.textContent!.length;

    if (start !== end) {
      const mark = document.createElement('mark');
      mark.className = 'web-highlighter-highlight';
      mark.style.backgroundColor = color;
      mark.style.color = 'inherit';
      
      const highlightedText = node.textContent!.substring(start, end);
      mark.textContent = highlightedText;
      
      const originalText = node.textContent!;
      node.textContent = originalText.substring(0, start);
      node.parentNode!.insertBefore(mark, node.nextSibling);
      if (end < originalText.length) {
        const remainingText = document.createTextNode(originalText.substring(end));
        node.parentNode!.insertBefore(remainingText, mark.nextSibling);
      }

      highlightedElements.push(mark);
    }

    if (node === range.endContainer) {
      break;
    }
  }

  console.log('Created highlight elements:', highlightedElements);
  return highlightedElements;
}

let colorIndex = 0;
const colors: string[] = ['yellow', 'lightgreen', 'lightblue', 'pink', 'orange'];

function getNextColor(): string {
  const color = colors[colorIndex];
  colorIndex = (colorIndex + 1) % colors.length;
  return color;
}

function clearHighlights() {
  console.log('clearHighlights called');
  highlightedRanges.forEach(highlight => {
    highlight.elements.forEach(element => {
      if (element && element.parentNode) {
        const parent = element.parentNode;
        const textNode = document.createTextNode(element.textContent || '');
        parent.replaceChild(textNode, element);
        console.log('Removed highlight:', element);
      }
    });
  });
  highlightedRanges = [];
  console.log('All highlights cleared');
}

function setupVimNavigation() {
  identifyMainContent();
  document.addEventListener('keydown', handleVimKeys);
  createCursorElement();
}

function createCursorElement() {
  cursorElement = document.createElement('div');
  cursorElement.style.cssText = `
    position: absolute;
    width: 8px;
    height: 16px;
    background-color: #00FF00;
    opacity: 0.7;
    z-index: 10000;
    pointer-events: none;
    transition: all 0.1s ease;
  `;
  document.body.appendChild(cursorElement);

  // Add blinking effect
  cursorInterval = setInterval(() => {
    cursorElement!.style.visibility = cursorElement!.style.visibility === 'hidden' ? 'visible' : 'hidden';
  }, 530); // Blink every 530ms, similar to Vim's default
}

function handleVimKeys(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return; // Don't interfere with input fields
  }

  if (!currentNode) {
    currentNode = document.body;
    currentOffset = 0;
  }

  switch (event.key) {
    case 'h':
      moveCursor(-1);
      break;
    case 'l':
      moveCursor(1);
      break;
    case 'j':
      moveDown();
      break;
    case 'k':
      moveUp();
      break;
    case 'w':
      moveWordForward();
      break;
    case 'b':
      moveWordBackward();
      break;
    case '0':
      moveToStartOfLine();
      break;
    case '$':
      moveToEndOfLine();
      break;
  }

  event.preventDefault();
  updateCursorPosition();
}

function getNextVisibleTextNode(node: Node): Node | null {
  let nextNode = getNextTextNode(node);
  while (nextNode && !isVisibleTextNode(nextNode)) {
    nextNode = getNextTextNode(nextNode);
  }
  return nextNode;
}

function getPreviousVisibleTextNode(node: Node): Node | null {
  let prevNode = getPreviousTextNode(node);
  while (prevNode && !isVisibleTextNode(prevNode)) {
    prevNode = getPreviousTextNode(prevNode);
  }
  return prevNode;
}

interface WordPosition {
  node: Node;
  offset: number;
}

function findNextWord(node: Node, offset: number): WordPosition | null {
  let currentNode: Node | null = node;
  let currentOffset = offset;

  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const text = currentNode.textContent!.slice(currentOffset);
      const match = text.match(/\S+\s+\S/);
      if (match) {
        return {
          node: currentNode,
          offset: currentOffset + match.index! + match[0].length - 1
        };
      } else if (text.match(/\S+$/)) {
        const nextNode = getNextVisibleTextNode(currentNode);
        if (nextNode) {
          return {
            node: nextNode,
            offset: 0
          };
        }
      }
    }
    const nextNode = getNextVisibleTextNode(currentNode);
    if (nextNode) {
      currentNode = nextNode;
      currentOffset = 0;
    } else {
      break;
    }
  }
  return null;
}

function findPreviousWord(node: Node, offset: number): WordPosition | null {
  let currentNode: Node | null = node;
  let currentOffset = offset;

  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const text = currentNode.textContent!.slice(0, currentOffset);
      const match = text.match(/\S+\s*$/);
      if (match) {
        return {
          node: currentNode,
          offset: match.index!
        };
      }
    }
    const prevNode = getPreviousVisibleTextNode(currentNode);
    if (prevNode) {
      currentNode = prevNode;
      currentOffset = currentNode.textContent!.length;
    } else {
      break;
    }
  }
  return null;
}

function moveWordForward(): void {
  const nextWord = findNextWord(currentNode!, currentOffset);
  if (nextWord) {
    currentNode = nextWord.node;
    currentOffset = nextWord.offset;
    updateCursorPosition();
  }
}

function moveWordBackward(): void {
  const prevWord = findPreviousWord(currentNode!, currentOffset);
  if (prevWord) {
    currentNode = prevWord.node;
    currentOffset = prevWord.offset;
    updateCursorPosition();
  }
}

function moveCursor(direction: number): void {
  if (currentNode && currentNode.nodeType === Node.TEXT_NODE) {
    currentOffset += direction;
    if (currentOffset < 0) {
      const prevNode = getPreviousVisibleTextNode(currentNode);
      if (prevNode) {
        currentNode = prevNode;
        currentOffset = currentNode.textContent!.length - 1;
      } else {
        currentOffset = 0;
      }
    } else if (currentOffset > currentNode.textContent!.length - 1) {
      const nextNode = getNextVisibleTextNode(currentNode);
      if (nextNode) {
        currentNode = nextNode;
        currentOffset = 0;
      } else {
        currentOffset = currentNode.textContent!.length - 1;
      }
    }
  } else {
    const textNodes = getVisibleTextNodesIn(currentNode!);
    if (textNodes.length > 0) {
      currentNode = textNodes[0];
      currentOffset = direction > 0 ? 0 : currentNode.textContent!.length - 1;
    }
  }
  updateCursorPosition();
}

function getVisibleTextNodesIn(node: Node): Node[] {
  return getTextNodesIn(node).filter(isVisibleTextNode);
}

function findNearestPositionVertically(node: Node, offset: number, direction: 'up' | 'down'): CaretPosition | null {
  if (!node || !node.parentElement) {
    console.error('Invalid node or parent element');
    return null;
  }

  let rect: DOMRect;
  try {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    rect = range.getBoundingClientRect();
  } catch (e) {
    console.error('Error getting bounding rect:', e);
    rect = node.parentElement.getBoundingClientRect();
  }

  if (!rect || rect.top === undefined) {
    console.error('Unable to get valid bounding rectangle');
    return null;
  }

  const x = rect.left;
  let y = direction === 'up' ? rect.top - 1 : rect.bottom + 1;

  const computedStyle = window.getComputedStyle(node.parentElement);
  const lineHeight = parseInt(computedStyle.lineHeight) || parseInt(computedStyle.fontSize) || 20;
  const searchRange = lineHeight * 1.5;
  let closestPosition: CaretPosition | null = null;
  let closestDistance = Infinity;

  for (let i = 0; i < searchRange; i++) {
    const testY = direction === 'up' ? y - i : y + i;
    const newPosition = document.caretRangeFromPoint(x, testY);
    
    if (newPosition && newPosition.startContainer !== node) {
      try {
        const newRect = newPosition.getBoundingClientRect();
        const distance = Math.abs(newRect.top - rect.top);
        
        if (distance < closestDistance) {
          closestPosition = {
            offsetNode: newPosition.startContainer,
            offset: newPosition.startOffset
          };
          closestDistance = distance;
        }
      } catch (e) {
        console.error('Error getting bounding rect for new position:', e);
        continue;
      }
    }
    
    if (closestPosition && i > lineHeight) {
      break;
    }
  }

  return closestPosition;
}

function moveUp(): void {
  try {
    const position = findNearestPositionVertically(currentNode!, currentOffset, 'up');
    if (position) {
      updatePositionIfValid(position);
    }
  } catch (e) {
    console.error('Error in moveUp:', e);
  }
}

function moveDown(): void {
  try {
    const position = findNearestPositionVertically(currentNode!, currentOffset, 'down');
    if (position) {
      updatePositionIfValid(position);
    }
  } catch (e) {
    console.error('Error in moveDown:', e);
  }
}

function updatePositionIfValid(position: CaretPosition): void {
  
  if (!position || !position.offsetNode) {
    console.error('Invalid position');
    return;
  }

  let node: Node | null = position.offsetNode;
  let offset = position.offset;

  while (node && node.nodeType !== Node.TEXT_NODE) {
    node = getNextContentNode(node);
  }

  if (node && node.parentElement && isContentNode(node.parentElement)) {
    currentNode = node;
    currentOffset = offset;
    updateCursorPosition();
  } else {
    console.error('Unable to find valid text node');
  }
}

function moveToStartOfLine(): void {
  const range = document.createRange();
  range.setStart(currentNode!, currentOffset);
  const clientRect = range.getBoundingClientRect();
  const startOfLine = document.caretRangeFromPoint(0, clientRect.top + clientRect.height / 2);
  if (startOfLine) {
    currentNode = startOfLine.startContainer;
    currentOffset = startOfLine.startOffset;
  }
}

function moveToEndOfLine(): void {
  const range = document.createRange();
  range.setStart(currentNode!, currentOffset);
  const clientRect = range.getBoundingClientRect();
  const endOfLine = document.caretRangeFromPoint(document.documentElement.clientWidth - 1, clientRect.top + clientRect.height / 2);
  if (endOfLine) {
    currentNode = endOfLine.endContainer;
    currentOffset = endOfLine.endOffset;
  }
}

function getCurrentWord(): string {
  if (!currentNode || currentNode.nodeType !== Node.TEXT_NODE) {
    return '';
  }

  const text = currentNode.textContent!;
  let start = currentOffset;
  let end = currentOffset;

  while (start > 0 && !/\s/.test(text[start - 1])) {
    start--;
  }

  while (end < text.length && !/\s/.test(text[end])) {
    end++;
  }

  return text.slice(start, end);
}

function getTextNodesIn(node: Node): Node[] {
  const textNodes: Node[] = [];
  if (node.nodeType === Node.TEXT_NODE) {
    textNodes.push(node);
  } else {
    const children = node.childNodes;
    for (let i = 0; i < children.length; i++) {
      textNodes.push(...getTextNodesIn(children[i]));
    }
  }
  return textNodes;
}

function getNextTextNode(node: Node): Node | null {
  while (node && node.nextSibling === null) {
    node = node.parentNode!;
  }
  if (!node) {
    return null;
  }
  node = node.nextSibling!;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node;
    }
    if (node.firstChild) {
      node = node.firstChild;
    } else {
      while (node && node.nextSibling === null) {
        node = node.parentNode!;
      }
      if (node) {
        node = node.nextSibling!;
      }
    }
  }
  return null;
}

function getPreviousTextNode(node: Node): Node | null {
  while (node && node.previousSibling === null) {
    node = node.parentNode!;
  }
  if (!node) {
    return null;
  }
  node = node.previousSibling!;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node;
    }
    if (node.lastChild) {
      node = node.lastChild;
    } else {
      while (node && node.previousSibling === null) {
        node = node.parentNode!;
      }
      if (node) {
        node = node.previousSibling!;
      }
    }
  }
  return null;
}

function identifyMainContent(): void {
  const possibleElements = [
    document.querySelector('article'),
    document.querySelector('main'),
    document.querySelector('.main-content'),
    document.querySelector('#content'),
    document.body
  ];
  
  mainContentElement = possibleElements.find(el => el !== null) || null;
}

function isWithinMainContent(node: Node): boolean {
  return mainContentElement !== null && mainContentElement.contains(node);
}

function isInformationDense(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  
  const text = node.textContent || '';
  const html = (node as Element).innerHTML;
  
  const ratio = text.length / html.length;
  
  return ratio > 0.5;
}

function isContentNode(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  
  const tagName = (node as Element).tagName.toLowerCase();
  const ignoredTags = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'button', 'input', 'textarea', 'select'];
  
  if (ignoredTags.includes(tagName)) return false;
  
  const computedStyle = window.getComputedStyle(node as Element);
  if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return false;
  
  const className = (node as Element).className.toLowerCase();
  if (className.includes('nav') || className.includes('menu') || className.includes('sidebar')) return false;
  
  if (!isInformationDense(node)) return false;
  
  return true;
}

function getNextContentNode(node: Node): Node | null {
  let current: Node | null = node;
  while (current) {
    if (current.firstChild && isContentNode(current)) {
      current = current.firstChild;
    } else if (current.nextSibling) {
      current = current.nextSibling;
    } else {
      while (current.parentNode && !current.parentNode.nextSibling) {
        current = current.parentNode;
      }
      if (!current.parentNode) {
        return null;
      }
      current = current.parentNode.nextSibling;
    }
    if (current && current.nodeType === Node.TEXT_NODE && current.textContent?.trim() !== '') {
      return current;
    }
    if (current && current.nodeType === Node.ELEMENT_NODE && isContentNode(current) && current.textContent?.trim() !== '') {
      return current.firstChild;
    }
  }
  return null;
}

function getPreviousContentNode(node: Node): Node | null {
  let current: Node | null = node;
  while (current) {
    if (current.previousSibling) {
      current = current.previousSibling;
      while (current.lastChild && isContentNode(current)) {
        current = current.lastChild;
      }
    } else if (current.parentNode) {
      current = current.parentNode;
    } else {
      return null;
    }
    if (current.nodeType === Node.TEXT_NODE && current.textContent!.trim() !== '') {
      return current;
    }
    if (current.nodeType === Node.ELEMENT_NODE && isContentNode(current) && current.textContent!.trim() !== '') {
      return current.lastChild;
    }
  }
  return null;
}

// Add these function declarations
function isVisibleTextNode(node: Node): boolean {
  // Implementation needed
  return true; // Placeholder
}

function updateCursorPosition(): void {
  // Implementation needed
}

// You might need to add more function declarations or implementations
// depending on what's used in your actual code but not shown in the snippets.
