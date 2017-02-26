/* jslint node: true, esnext: true */
/* global document, window */
'use strict';

const colaLayout = require('webcola').Layout;

function isOfType(obj, type) {
	return Object.prototype.toString.call(obj) === '[object '+type+']';
}

module.exports = function (parentElement) {
  document.body.addEventListener('keydown', this.handleKeyboard.bind(this));
  this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  parentElement.appendChild(this.svg);
  this.svg.parentNode.classList.add('WiredPanels');
  this.svg.parentNode.onmousedown = function (event) {
    this.deselectAll();
    event.stopPropagation();
    return true;
  }.bind(this);
  this.svg.parentNode.ontouchstart = function (event) {
    return this.svg.parentNode.onmousedown(event.touches[0]);
  }.bind(this);
  this.svg.parentNode.onmousemove = function (event) {
    if (!this.dragging)
      return false;
    this.draggingMoved = true;
    if (isOfType(this.dragging, 'Map')) {
      this.dragging.forEach(function (dragging, node) {
        this.transformPanelMousePos(event, 'p', node, '', dragging);
      }, this);
      this.tickGraph();
    } else if (this.dragging.srcSocket) {
      if (!this.dragging.path) {
        this.initializeWire(this.dragging);
        this.dragging.path.setAttribute('pointer-events', 'none');
      }
      const rect = this.svg.getBoundingClientRect();
      this.dragging.dstSocket.circle.x = event.pageX - rect.left - window.pageXOffset;
      this.dragging.dstSocket.circle.y = event.pageY - rect.top - window.pageYOffset;
      this.tickWire(this.dragging);
    }
    event.stopPropagation();
    return true;
  }.bind(this);
  this.svg.parentNode.ontouchmove = function (event) {
    return this.svg.parentNode.onmousemove(event.touches[0]);
  }.bind(this);
  this.svg.parentNode.onmouseup = function (event) {
    if (!this.dragging)
      return false;
    if (isOfType(this.dragging, 'Map')) {
      this.dragging.forEach(function (dragging, node) {
        colaLayout.dragEnd(node);
      }, this);
      for (let panel of this.selection.panels)
        panel.rect.classList.remove('selected');
      this.selection.panels.clear();
    } else if (this.dragging.path) {
      this.selection.wires.delete(this.dragging);
      this.wires.delete(this.dragging);
      this.deleteElements([this.dragging.path]);
    }
    delete this.dragging;
    event.stopPropagation();
    return true;
  }.bind(this);
  this.svg.parentNode.ontouchend = function (event) {
    return this.svg.parentNode.onmouseup(event.touches[0]);
  }.bind(this);

  const svgDefs = this.createElement('defs', this.svg);
  const blurFilter = this.createElement('filter', svgDefs);
  blurFilter.setAttribute('id', 'blurFilter');
  blurFilter.setAttribute('x', -10);
  blurFilter.setAttribute('y', -10);
  blurFilter.setAttribute('width', 20);
  blurFilter.setAttribute('height', 20);
  const feGaussianBlur = this.createElement('feGaussianBlur', blurFilter);
  feGaussianBlur.setAttribute('in', 'SourceGraphic');
  feGaussianBlur.setAttribute('result', 'blur');
  feGaussianBlur.setAttribute('stdDeviation', 3);
  const feComponentTransfer = this.createElement('feComponentTransfer', blurFilter);
  feComponentTransfer.setAttribute('in', 'blur');
  feComponentTransfer.setAttribute('result', 'brighter');
  const feFunc = this.createElement('feFuncA', feComponentTransfer);
  feFunc.setAttribute('type', 'linear');
  feFunc.setAttribute('slope', 2.5);
  const feMerge = this.createElement('feMerge', blurFilter);
  this.createElement('feMergeNode', feMerge).setAttribute('in', 'brighter');
  this.createElement('feMergeNode', feMerge).setAttribute('in', 'SourceGraphic');

  this.panelsGroup = this.createElement('g', this.svg);
  this.wiresGroup = this.createElement('g', this.svg);
  this.layoutEngine = new colaLayout()
    .linkDistance(this.config.panelDistance)
    .avoidOverlaps(true);
  this.panels = this.layoutEngine._nodes;
  this.wires = new Set();
  this.selection = {
    sockets: new Set(),
    wires: new Set(),
    panels: new Set()
  };
};

module.exports.prototype.transformPanelMousePos = function (event, dstPrefix, dst, srcPrefix, src) {
    const rect = this.svg.getBoundingClientRect();
    dst[dstPrefix+'x'] = event.pageX - rect.left - window.pageXOffset + this.config.panelMargin / 2 - src[srcPrefix+'x'];
    dst[dstPrefix+'y'] = event.pageY - rect.top - window.pageYOffset + this.config.panelMargin / 2 - src[srcPrefix+'y'];
};

module.exports.prototype.config = {
  panelWidth: 300,
  panelDistance: 150,
  panelMargin: 24,
  panelPadding: 12,
  panelCornerRadius: 10,
  socketRadius: 5,
  fontSize: 12,
  wireStyle: 'hybrid',
  headSocket: true,
  panelLines: true
};

module.exports.prototype.deleteSocket = function (socket) {
  this.dirtyFlag = true;
  this.selection.sockets.delete(socket);
  for (const pair of socket.wiresPerPanel)
    for (const wire of pair[1])
      wire.deathFlag = true;
};

module.exports.prototype.tickSocket = function (posX, posY, socket) {
  let element = socket.circle;
  element.x = posX + parseInt(element.getAttribute('cx'));
  element.y = posY + parseInt(element.getAttribute('cy'));
};

module.exports.prototype.tickWire = function (wire) {
  const src = wire.srcSocket.circle, dst = wire.dstSocket.circle;
  switch (this.config.wireStyle) {
    case 'straight':
      wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'L' + dst.x + ',' + dst.y);
      break;
    case 'vertical':
      wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'C' + dst.x + ',' + src.y + ' ' + src.x + ',' + dst.y + ' ' + dst.x + ',' + dst.y);
      break;
    case 'horizontal':
      wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'C' + src.x + ',' + dst.y + ' ' + dst.x + ',' + src.y + ' ' + dst.x + ',' + dst.y);
      break;
    case 'hybrid':
      if (Math.abs(src.x - dst.x) < Math.abs(src.y - dst.y))
        wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'C' + dst.x + ',' + src.y + ' ' + src.x + ',' + dst.y + ' ' + dst.x + ',' + dst.y);
      else
        wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'C' + src.x + ',' + dst.y + ' ' + dst.x + ',' + src.y + ' ' + dst.x + ',' + dst.y);
      break;
    case 'gravity':
      const diffX = dst.x - src.x;
      const maxY = Math.max(dst.y, src.y) + 20;
      wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'C' + (src.x + diffX * 0.25) + ',' + maxY + ' ' + (src.x + diffX * 0.75) + ',' + maxY + ' ' + dst.x + ',' + dst.y);
      break;
  }
};

module.exports.prototype.tickGraph = function () {
  this.layoutEngine._running = true;
  this.layoutEngine._alpha = 0.1;
  for (let i = 0; i < 5; ++i)
    if (this.layoutEngine.tick())
      break;

  let trash = new Set();
  for (let j = 0; j < this.panels.length; ++j) {
    const panel = this.panels[j];
    if (panel.deathFlag) {
      this.selection.panels.delete(panel);
      if (panel.circle)
        this.deleteSocket(panel);
      for (let i = 0; i < panel.leftSide.length; ++i)
        this.deleteSocket(panel.leftSide[i]);
      for (let i = 0; i < panel.rightSide.length; ++i)
        this.deleteSocket(panel.rightSide[i]);
      trash.add(panel.group);
      this.panels.splice(j, 1);
      --j;
      continue;
    }
    const posX = panel.x - panel.width / 2,
          posY = panel.y - panel.height / 2;
    panel.group.setAttribute('transform', 'translate(' + posX + ', ' + posY + ')');
    if (panel.circle)
      this.tickSocket(posX, posY, panel);
    for (let i = 0; i < panel.leftSide.length; ++i)
      this.tickSocket(posX, posY, panel.leftSide[i]);
    for (let i = 0; i < panel.rightSide.length; ++i)
      this.tickSocket(posX, posY, panel.rightSide[i]);
  }

  for (const wire of this.wires) {
    if (wire.deathFlag) {
      this.selection.wires.delete(wire);
      this.dirtyFlag = true;
      trash.add(wire.path);
      if(wire.srcPanel && wire.dstPanel) {
        this.disconnectSockets(wire, wire.srcSocket, wire.dstPanel);
        this.disconnectSockets(wire, wire.dstSocket, wire.srcPanel);
        if (wire.srcPanel != wire.dstPanel) {
          this.disconnectPanels(wire.srcPanel, wire.dstPanel);
          this.disconnectPanels(wire.dstPanel, wire.srcPanel);
        }
      }
      this.wires.delete(wire);
      continue;
    }
    this.tickWire(wire);
  }

  this.deleteElements(trash);
  this.syncGraph();
};

module.exports.prototype.deleteElements = function (trash) {
  for (const element of trash) {
    element.classList.remove('fadeIn');
    element.classList.add('fadeOut');
  }
  window.setTimeout(function () {
    for (const element of trash)
      element.parentNode.removeChild(element);
  }.bind(this), 250);
};

module.exports.prototype.handleKeyboard = function (event) {
  if (this.svg.parentNode.querySelector('svg:hover') == null || event.ctrlKey)
    return;
  event.stopPropagation();
  event.preventDefault();
  switch (event.keyCode) {
    case 8:
      this.iterateSelection(function(type, element, node) {
        if (node.ondeletion)
          node.ondeletion(type, element, node);
      });
      this.deselectAll();
      this.syncGraph();
      break;
    case 13:
      this.iterateSelection(function(type, element, node) {
        if (node.onactivation)
          node.onactivation(type, element, node);
      });
      break;
    case 37:
      break;
    case 38:
      break;
    case 39:
      break;
    case 40:
      break;
  }
};

module.exports.prototype.setHandlers = function (type, element, node) {
  element.onmousedown = function (event) {
    this.draggingMoved = false;
    if (event.shiftKey)
      this.setSelected(type, element, node, 'toggle');
    else switch (type) {
      case 'panels':
        this.setSelected(type, element, node, true);
        this.dragging = new Map();
        this.selection.panels.forEach(function (node) {
          let dragging = {};
          this.dragging.set(node, dragging);
          this.transformPanelMousePos(event, '', dragging, 'p', node);
          colaLayout.dragStart(node);
        }, this);
        break;
      case 'sockets':
        this.dragging = {type: node.type, srcSocket: node, dstSocket: {circle: {}}};
        break;
    }
    event.stopPropagation();
    return true;
  }.bind(this);
  element.ontouchstart = function (event) {
    return element.onmousedown(event.touches[0]);
  }.bind(this);
  element.onmouseup = function (event) {
    if (event.shiftKey)
      return true;
    if (!this.draggingMoved) {
      if (node.onactivation)
        node.onactivation(type, element, node);
    } else if (this.dragging && this.dragging.path) {
      if (node.onwireconnect)
        node.onwireconnect(type, element, node, this.dragging);
    }
  }.bind(this);
  element.ontouchstop = function (event) {
    return element.onmouseup(event.touches[0]);
  }.bind(this);
};

module.exports.prototype.createElement = function (tag, parentNode) {
  const element = document.createElementNS(this.svg.namespaceURI, tag);
  parentNode.appendChild(element);
  return element;
};

module.exports.prototype.setSelected = function (type, element, node, newValue) {
  const oldValue = this.selection[type].has(node);
  if (newValue == oldValue)
    return oldValue;
  if (newValue == 'toggle')
    newValue = !oldValue;
  if (newValue) {
    this.selection[type].add(node);
    element.classList.add('selected');
  } else {
    this.selection[type].delete(node);
    element.classList.remove('selected');
  }
  return newValue;
};

module.exports.prototype.iterateSelection = function (callback) {
  for (let socket of this.selection.sockets)
    callback('sockets', socket.circle, socket);
  for (let wire of this.selection.wires)
    callback('wires', wire.path, wire);
  for (let panel of this.selection.panels)
    callback('panels', panel.rect, panel);
};

module.exports.prototype.deselectAll = function () {
  this.iterateSelection(function(type, element, node) {
    element.classList.remove('selected');
  });
  this.selection.sockets.clear();
  this.selection.wires.clear();
  this.selection.panels.clear();
};

module.exports.prototype.syncPanelSide = function (panel, width, side, isLeft) {
  for (let i = 0; i < side.length; ++i) {
    const socket = side[i];
    if (socket.deathFlag) {
      this.deleteSocket(socket);
      side.group.removeChild(side.group.childNodes[i * 2 + 1]);
      side.group.removeChild(side.group.childNodes[i * 2]);
      side.splice(i, 1);
      --i;
      continue;
    }

    if (!socket.circle) {
      socket.circle = this.createElement('circle', side.group);
      socket.circle.classList.add('socket');
      socket.circle.classList.add(socket.type);
      socket.circle.setAttribute('r', this.config.socketRadius);
      this.setHandlers('sockets', socket.circle, socket);
      socket.label = this.createElement('text', side.group);
      socket.label.setAttribute('text-anchor', (isLeft) ? 'start' : 'end');
      socket.wiresPerPanel = new Map();
      socket.panel = panel;
    }
    const posY = (i + 1) * this.config.panelPadding * 2;

    socket.circle.x = Math.round((isLeft) ? this.config.panelPadding : width - this.config.panelPadding);
    socket.circle.y = Math.round(posY + this.config.panelPadding);
    socket.circle.setAttribute('cx', socket.circle.x);
    socket.circle.setAttribute('cy', socket.circle.y);

    socket.label.setAttribute('x', Math.round((isLeft) ? this.config.panelPadding * 2 : width - this.config.panelPadding * 2));
    socket.label.setAttribute('y', Math.round(posY + this.config.panelPadding + this.config.fontSize * 0.4));
  }
};

module.exports.prototype.syncPanel = function (panel) {
  if (!panel.group) {
    panel.group = this.createElement('g', this.panelsGroup);
    panel.group.classList.add('fadeIn');

    panel.rect = this.createElement('rect', panel.group);
    panel.rect.classList.add('panel');
    panel.rect.classList.add(panel.type);
    panel.rect.setAttribute('rx', this.config.panelCornerRadius);
    panel.rect.setAttribute('ry', this.config.panelCornerRadius);

    panel.panel = panel;
    this.setHandlers('panels', panel.rect, panel);
    panel.rect.onmouseover = colaLayout.mouseOver.bind(colaLayout, panel);
    panel.rect.onmouseout = colaLayout.mouseOut.bind(colaLayout, panel);

    if (this.config.headSocket) {
      panel.circle = this.createElement('circle', panel.group);
      panel.circle.classList.add('socket');
      panel.circle.classList.add(panel.type);
      panel.circle.y = Math.round(-this.config.panelPadding);
      panel.circle.setAttribute('cy', panel.circle.y);
      panel.circle.setAttribute('r', this.config.socketRadius);
      this.setHandlers('sockets', panel.circle, panel);
      panel.wiresPerPanel = new Map();
    }

    panel.label = this.createElement('text', panel.group);
    panel.label.setAttribute('text-anchor', 'middle');
    panel.label.setAttribute('y', Math.round(this.config.panelPadding + this.config.fontSize * 0.4));
    panel.label.textContent = 'undefined';

    panel.leftSide.group = this.createElement('g', panel.group);
    panel.rightSide.group = this.createElement('g', panel.group);
    if (this.config.panelLines) {
      panel.lines = [];
      panel.lines.group = this.createElement('g', panel.group);
      panel.lines.group.classList.add('panel');
      panel.lines.group.classList.add(panel.type);
    }
  }

  this.syncPanelSide(panel, this.config.panelWidth, panel.leftSide, true);
  this.syncPanelSide(panel, this.config.panelWidth, panel.rightSide, false);

  const socketCount = Math.max(panel.leftSide.length, panel.rightSide.length);
  const height = (socketCount + 1) * this.config.panelPadding * 2;
  panel.rect.setAttribute('width', this.config.panelWidth);
  panel.rect.setAttribute('height', height);
  const halfWidth = Math.round(this.config.panelWidth / 2);
  if (panel.circle)
    panel.circle.setAttribute('cx', halfWidth);
  panel.label.setAttribute('x', halfWidth);

  if (panel.lines) {
    for (let i = panel.lines.group.childNodes.length - 1; i >= socketCount; --i)
      panel.lines.group.removeChild(panel.lines.group.childNodes[i]);
    panel.lines.splice(socketCount);

    for (let i = panel.lines.group.childNodes.length; i < socketCount; ++i) {
      const posY = (i + 1) * this.config.panelPadding * 2;
      panel.lines[i] = this.createElement('path', panel.lines.group);
      panel.lines[i].setAttribute('d', 'M0,' + posY + 'h' + this.config.panelWidth);
      panel.lines[i].classList.add('noHover');
    }
  }

  panel.width = this.config.panelWidth + this.config.panelMargin;
  panel.height = height + this.config.panelMargin;
  return panel;
};

module.exports.prototype.initializePanel = function (panel) {
  panel.interPanelLinks = new Map();
  this.syncPanel(panel);
  this.panels.push(panel);
  this.dirtyFlag = true;
  return panel;
};

module.exports.prototype.createPanelHelper = function (segementsLeft, segementsRight) {
  const panel = {};
  panel.leftSide = Array(segementsLeft);
  for (let i = 0; i < segementsLeft; ++i)
    panel.leftSide[i] = {};
  panel.rightSide = Array(segementsRight);
  for (let i = 0; i < segementsRight; ++i)
    panel.rightSide[i] = {};
  return this.initializePanel(panel);
};

module.exports.prototype.getSocketAtIndex = function (panel, index) {
  if (index < 0)
    return panel.leftSide[-index-1];
  else if (index > 0)
    return panel.rightSide[index-1];
  else
    return panel;
};

module.exports.prototype.getIndexOfSocket = function (panel, socket) {
  if (panel === socket)
    return 0;
  for (let i = 0; i < panel.leftSide.length; ++i)
    if (panel.leftSide[i] === socket)
      return -i - 1;
  for (let i = 0; i < panel.rightSide.length; ++i)
    if (panel.rightSide[i] === socket)
      return i + 1;
  return undefined;
};

module.exports.prototype.connectPanels = function (srcPanel, dstPanel) {
  let entry = srcPanel.interPanelLinks.get(dstPanel);
  if (entry)
    ++entry.arc;
  else {
    entry = {
      arc: 1
    };
    srcPanel.interPanelLinks.set(dstPanel, entry);
  }
  return entry;
};

module.exports.prototype.disconnectPanels = function (srcPanel, dstPanel) {
  const entry = srcPanel.interPanelLinks.get(dstPanel);
  if (entry.arc > 1)
    --entry.arc;
  else {
    if (entry.wire)
      this.layoutEngine._links.splice(this.layoutEngine._links.indexOf(entry.wire), 1);
    srcPanel.interPanelLinks.delete(dstPanel);
  }
};

module.exports.prototype.connectSockets = function (wire, srcSocket, dstPanel) {
  let set;
  if (!srcSocket.wiresPerPanel.has(dstPanel)) {
    set = new Set();
    srcSocket.wiresPerPanel.set(dstPanel, set);
  } else {
    set = srcSocket.wiresPerPanel.get(dstPanel);
    if (set.has(wire))
      return false;
  }
  set.add(wire);
  return true;
};

module.exports.prototype.disconnectSockets = function (wire, srcSocket, dstPanel) {
  if (!srcSocket.wiresPerPanel.has(dstPanel))
    return false;
  const set = srcSocket.wiresPerPanel.get(dstPanel);
  if (!set.has(wire))
    return false;
  set.delete(wire);
  if (set.size === 0)
    srcSocket.wiresPerPanel.delete(dstPanel);
  return true;
};

module.exports.prototype.initializeWire = function (wire) {
  if (wire.srcPanel && wire.dstPanel) {
    if (!this.connectSockets(wire, wire.srcSocket, wire.dstPanel) ||
        !this.connectSockets(wire, wire.dstSocket, wire.srcPanel))
      return;
    if (wire.srcPanel != wire.dstPanel) {
      const entry = this.connectPanels(wire.srcPanel, wire.dstPanel);
      this.connectPanels(wire.dstPanel, wire.srcPanel);
      if (entry.arc == 1) {
        entry.wire = {
          source: wire.srcPanel,
          target: wire.dstPanel
        };
        this.layoutEngine._links.push(entry.wire);
      }
    }
  }
  wire.path = this.createElement('path', this.wiresGroup);
  wire.path.classList.add('wire');
  wire.path.classList.add('fadeIn');
  wire.path.classList.add(wire.type);
  this.setHandlers('wires', wire.path, wire);
  this.wires.add(wire);
  this.dirtyFlag = true;
  return wire;
};

module.exports.prototype.delete = function (element) {
  element.deathFlag = true;
  this.dirtyFlag = true;
};

module.exports.prototype.createWireHelper = function (type, srcPanel, dstPanel, srcIndex, dstIndex) {
  const wire = { type: type, srcPanel: srcPanel, dstPanel: dstPanel };
  wire.srcSocket = this.getSocketAtIndex(wire.srcPanel, srcIndex);
  wire.dstSocket = this.getSocketAtIndex(wire.dstPanel, dstIndex);
  return this.initializeWire(wire);
};

module.exports.prototype.syncGraph = function () {
  if (!this.dirtyFlag)
    return;
  this.dirtyFlag = false;
  const rect = this.svg.getBoundingClientRect();
  this.layoutEngine.size([rect.width, rect.height]);
  this.layoutEngine.start();
  this.tickGraph();
};
