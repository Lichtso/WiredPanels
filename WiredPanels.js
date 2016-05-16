/* jslint node: true, esnext: true */
/* global document, window */

'use strict';

var colaLayout = require('webcola').Layout;

module.exports = function (parentElement) {
  document.body.addEventListener('keydown', this.handleKeyboard.bind(this));
  this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  parentElement.appendChild(this.svg);
  this.svg.parentNode.classList.add('WiredPanels');
  this.svg.parentNode.onmousemove = function (event) {
    if (!this.panelToDrag)
      return true;
    var rect = this.svg.getBoundingClientRect();
    this.panelToDrag.px = event.pageX - rect.left - window.pageXOffset + this.config.panelMargin / 2;
    this.panelToDrag.py = event.pageY - rect.top - window.pageYOffset + this.config.panelMargin / 2;
    this.tickGraph();
    return false;
  }.bind(this);
  this.svg.parentNode.ontouchmove = function (event) {
    return this.svg.parentNode.onmousemove(event.touches[0]);
  }.bind(this);
  this.svg.parentNode.onmouseup = function (event) {
    if (!this.panelToDrag)
      return true;
    colaLayout.dragEnd(this.panelToDrag);
    this.panelToDrag = undefined;
    return false;
  }.bind(this);
  this.svg.parentNode.ontouchend = function (event) {
    return this.svg.parentNode.onmouseup(event.touches[0]);
  }.bind(this);

  this.panelsGroup = this.createElement('g', this.svg);
  this.wiresGroup = this.createElement('g', this.svg);
  var svgDefs = this.createElement('defs', this.svg);
  /* var arrowMarker = this.createElement('marker', svgDefs);
  arrowMarker.setAttribute('id', 'arrowMarker');
  arrowMarker.setAttribute('refX', 6);
  arrowMarker.setAttribute('refY', 3);
  arrowMarker.setAttribute('markerWidth', 7);
  arrowMarker.setAttribute('markerHeight', 6);
  arrowMarker.setAttribute('orient', 'auto');
  var arrowPath = this.createElement('path', arrowMarker);
  arrowPath.setAttribute('d', 'M0,1L5,3L0,5z'); */

  var blurFilter = this.createElement('filter', svgDefs);
  blurFilter.setAttribute('id', 'blurFilter');
  blurFilter.setAttribute('x', -0.5);
  blurFilter.setAttribute('y', -0.5);
  blurFilter.setAttribute('width', 4);
  blurFilter.setAttribute('height', 4);
  var feGaussianBlur = this.createElement('feGaussianBlur', blurFilter);
  feGaussianBlur.setAttribute('in', 'SourceGraphic');
  feGaussianBlur.setAttribute('result', 'blur');
  feGaussianBlur.setAttribute('stdDeviation', 3);
  var feComponentTransfer = this.createElement('feComponentTransfer', blurFilter);
  feComponentTransfer.setAttribute('in', 'blur');
  feComponentTransfer.setAttribute('result', 'brighter');
  var feFunc = this.createElement('feFuncA', feComponentTransfer);
  feFunc.setAttribute('type', 'linear');
  feFunc.setAttribute('slope', 2.5);
  var feMerge = this.createElement('feMerge', blurFilter);
  this.createElement('feMergeNode', feMerge).setAttribute('in', 'brighter');
  this.createElement('feMergeNode', feMerge).setAttribute('in', 'SourceGraphic');

  this.layoutEngine = new colaLayout()
    .linkDistance(this.config.panelDistance)
    .avoidOverlaps(true);
  this.panels = this.layoutEngine._nodes;
  this.wires = new Set();
};

module.exports.prototype.config = {
  panelDistance: 150,
  panelMargin: 24,
  panelPadding: 12,
  panelCornerRadius: 10,
  socketRadius: 5,
  fontSize: 12,
  wireStyle: 'hybrid',
  headSocket: true,
  segmentLines: true
};

module.exports.prototype.deleteSocket = function (socket) {
  if (this.cursorSocket == socket)
    this.cursorPanel = undefined;
  for (var pair of socket.wiresPerPanel)
    for (var wire of pair[1])
      wire.deathFlag = true;
};

module.exports.prototype.tickSocket = function (posX, posY, element) {
  element.x = posX + parseInt(element.getAttribute('cx'));
  element.y = posY + parseInt(element.getAttribute('cy'));
};

module.exports.prototype.tickGraph = function () {
  this.layoutEngine._running = true;
  this.layoutEngine._alpha = 0.1;
  for (var i = 0; i < 5; ++i)
    if (this.layoutEngine.tick())
      break;

  var trash = new Set();
  for (var j = 0; j < this.panels.length; ++j) {
    var panel = this.panels[j];
    if (panel.deathFlag) {
      if (panel.socket)
        this.deleteSocket(panel.socket);
      for (var i = 0; i < panel.leftSide.length; ++i)
        this.deleteSocket(panel.leftSide[i].socket);
      for (var i = 0; i < panel.rightSide.length; ++i)
        this.deleteSocket(panel.rightSide[i].socket);
      this.dirtyFlag = true;
      trash.add(panel.group);
      this.panels.splice(j, 1);
      --j;
      continue;
    }
    var posX = panel.x - panel.width / 2,
      posY = panel.y - panel.height / 2;
    panel.group.setAttribute('transform', 'translate(' + posX + ', ' + posY + ')');
    if (panel.socket)
      this.tickSocket(posX, posY, panel.socket);
    for (var i = 0; i < panel.leftSide.length; ++i)
      this.tickSocket(posX, posY, panel.leftSide[i].socket);
    for (var i = 0; i < panel.rightSide.length; ++i)
      this.tickSocket(posX, posY, panel.rightSide[i].socket);
  }

  for (var wire of this.wires) {
    if (wire.deathFlag) {
      this.dirtyFlag = true;
      trash.add(wire.path);
      this.disconnectSockets(wire, wire.srcSocket, wire.dstPanel);
      this.disconnectSockets(wire, wire.dstSocket, wire.srcPanel);
      if (wire.srcPanel != wire.dstPanel) {
        this.disconnectPanels(wire.srcPanel, wire.dstPanel);
        this.disconnectPanels(wire.dstPanel, wire.srcPanel);
      }
      this.wires.delete(wire);
      continue;
    }
    switch (this.config.wireStyle) {
      case 'straight':
        wire.path.setAttribute('d', 'M' + wire.srcSocket.x + ',' + wire.srcSocket.y + 'L' + wire.dstSocket.x + ',' + wire.dstSocket.y);
        break;
      case 'vertical':
        wire.path.setAttribute('d', 'M' + wire.srcSocket.x + ',' + wire.srcSocket.y + 'C' + wire.dstSocket.x + ',' +
          wire.srcSocket.y + ' ' + wire.srcSocket.x + ',' + wire.dstSocket.y + ' ' + wire.dstSocket.x + ',' + wire.dstSocket.y);
        break;
      case 'horizontal':
        wire.path.setAttribute('d', 'M' + wire.srcSocket.x + ',' + wire.srcSocket.y + 'C' + wire.srcSocket.x + ',' +
          wire.dstSocket.y + ' ' + wire.dstSocket.x + ',' + wire.srcSocket.y + ' ' + wire.dstSocket.x + ',' + wire.dstSocket.y);
        break;
      case 'hybrid':
        if (Math.abs(wire.srcSocket.x - wire.dstSocket.x) < Math.abs(wire.srcSocket.y - wire.dstSocket.y))
          wire.path.setAttribute('d', 'M' + wire.srcSocket.x + ',' + wire.srcSocket.y + 'C' + wire.dstSocket.x + ',' +
            wire.srcSocket.y + ' ' + wire.srcSocket.x + ',' + wire.dstSocket.y + ' ' + wire.dstSocket.x + ',' + wire.dstSocket.y);
        else
          wire.path.setAttribute('d', 'M' + wire.srcSocket.x + ',' + wire.srcSocket.y + 'C' + wire.srcSocket.x + ',' +
            wire.dstSocket.y + ' ' + wire.dstSocket.x + ',' + wire.srcSocket.y + ' ' + wire.dstSocket.x + ',' + wire.dstSocket.y);
        break;
      case 'gravity':
        var diffX = wire.dstSocket.x - wire.srcSocket.x;
        var maxY = Math.max(wire.dstSocket.y, wire.srcSocket.y) + 20;
        wire.path.setAttribute('d', 'M' + wire.srcSocket.x + ',' + wire.srcSocket.y + 'C' + (wire.srcSocket.x + diffX * 0.25)
          + ',' + maxY + ' ' + (wire.srcSocket.x + diffX * 0.75) + ',' + maxY + ' ' + wire.dstSocket.x + ',' + wire.dstSocket.y);
        break;
    }
  }

  for (var element of trash) {
    element.classList.remove('fadeIn');
    element.classList.add('fadeOut');
  }
  window.setTimeout(function () {
    for (var element of trash)
      element.parentNode.removeChild(element);
  }.bind(this), 250);

  this.syncGraph();
};

module.exports.prototype.handleKeyboard = function (event) {
  var rect = this.svg.getBoundingClientRect();
  if (!this.cursorPanel || rect.width === 0 || rect.height === 0)
    return;
  event.stopPropagation();
  if (event.keyCode == 13 && this.cursorSocket.onactivation) {
    this.cursorSocket.onactivation(event);
    return false;
  }
  var index = this.getIndexOfSocket(this.cursorPanel, this.cursorSocket);
  if (index < 0) {
    switch (event.keyCode) {
      case 37:
        this.cursorFollowWire();
        return false;
      case 38:
        this.setCursorIndex(index + 1);
        return false;
      case 39:
        this.setCursorIndex(-index);
        return false;
      case 40:
        this.setCursorIndex(index - 1);
        return false;
    }
  } else if (index > 0) {
    switch (event.keyCode) {
      case 37:
        this.setCursorIndex(-index);
        return false;
      case 38:
        this.setCursorIndex(index - 1);
        return false;
      case 39:
        this.cursorFollowWire();
        return false;
      case 40:
        this.setCursorIndex(index + 1);
        return false;
    }
  } else {
    switch (event.keyCode) {
      case 37:
        this.setCursorIndex(index - 1);
        return false;
      case 38:
        this.cursorFollowWire();
        return false;
      case 39:
        this.setCursorIndex(index + 1);
        return false;
      case 40:
        return false;
    }
  }
  return true;
};

module.exports.prototype.createElement = function (tag, parentNode) {
  var element = document.createElementNS(this.svg.namespaceURI, tag);
  parentNode.appendChild(element);
  return element;
};

module.exports.prototype.setActivationHandlers = function (element) {
  var activation = function (event) {
    if (element.onactivation)
      element.onactivation(event);
    return false;
  }.bind(this);
  element.onmousedown = activation;
  element.ontouchstart = activation;
};

module.exports.prototype.syncPanelSide = function (width, side, isLeft) {
  for (var i = 0; i < side.length; ++i) {
    var segment = side[i];
    if (segment.deathFlag) {
      this.deleteSocket(segment.socket);
      side.group.removeChild(side.group.childNodes[i * 2 + 1]);
      side.group.removeChild(side.group.childNodes[i * 2]);
      side.splice(i, 1);
      --i;
      continue;
    }

    if (!segment.socket) {
      segment.socket = this.createElement('circle', side.group);
      segment.socket.classList.add('socket');
      segment.socket.wiresPerPanel = new Map();
      segment.socket.setAttribute('r', this.config.socketRadius);
      this.setActivationHandlers(segment.socket);
      segment.label = this.createElement('text', side.group);
      segment.label.setAttribute('text-anchor', (isLeft) ? 'start' : 'end');
      segment.label.textContent = 'undefined';
      this.setActivationHandlers(segment.label);
    }
    var posY = (i + 1) * this.config.panelPadding * 2;

    segment.socket.x = Math.round((isLeft) ? this.config.panelPadding : width - this.config.panelPadding);
    segment.socket.y = Math.round(posY + this.config.panelPadding);
    segment.socket.setAttribute('cx', segment.socket.x);
    segment.socket.setAttribute('cy', segment.socket.y);

    segment.label.setAttribute('x', Math.round((isLeft) ? this.config.panelPadding * 2 : width - this.config.panelPadding *
      2));
    segment.label.setAttribute('y', Math.round(posY + this.config.panelPadding + this.config.fontSize * 0.4));
  }
};

module.exports.prototype.syncPanel = function (panel) {
  var segmentCount = Math.max(panel.leftSide.length, panel.rightSide.length);
  var width = 200;
  var height = (segmentCount + 1) * this.config.panelPadding * 2;

  if (!panel.group) {
    panel.group = this.createElement('g', this.panelsGroup);
    panel.group.classList.add('fadeIn');

    panel.group.onmousedown = function (event) {
      this.panelToDrag = panel;
      colaLayout.dragStart(panel);
      return false;
    }.bind(this);
    panel.group.ontouchstart = function (event) {
      return panel.group.onmousedown(event.touches[0]);
    }.bind(this);
    panel.group.onmouseover = colaLayout.mouseOver.bind(colaLayout, panel);
    panel.group.onmouseout = colaLayout.mouseOut.bind(colaLayout, panel);

    panel.rect = this.createElement('rect', panel.group);
    panel.rect.classList.add('panel');
    panel.rect.setAttribute('rx', this.config.panelCornerRadius);
    panel.rect.setAttribute('ry', this.config.panelCornerRadius);

    if (this.config.headSocket) {
      panel.socket = this.createElement('circle', panel.group);
      panel.socket.classList.add('socket');
      panel.socket.wiresPerPanel = new Map();
      panel.socket.y = Math.round(-this.config.panelPadding);
      panel.socket.setAttribute('cy', panel.socket.y);
      panel.socket.setAttribute('r', this.config.socketRadius);
      this.setActivationHandlers(panel.socket);
    }

    panel.label = this.createElement('text', panel.group);
    panel.label.setAttribute('text-anchor', 'middle');
    panel.label.setAttribute('y', Math.round(this.config.panelPadding + this.config.fontSize * 0.4));
    panel.label.textContent = 'undefined';
    this.setActivationHandlers(panel.label);

    panel.leftSide.group = this.createElement('g', panel.group);
    panel.rightSide.group = this.createElement('g', panel.group);
    if (this.config.segmentLines) {
      panel.lines = [];
      panel.lines.group = this.createElement('g', panel.group);
      panel.lines.group.classList.add('panel');
    }
  }

  panel.rect.setAttribute('width', width);
  panel.rect.setAttribute('height', height);
  var halfWidth = Math.round(width / 2);
  if (panel.socket)
    panel.socket.setAttribute('cx', halfWidth);
  panel.label.setAttribute('x', halfWidth);

  this.syncPanelSide(width, panel.leftSide, true);
  this.syncPanelSide(width, panel.rightSide, false);
  if (panel.lines) {
    for (var i = panel.lines.group.childNodes.length - 1; i >= segmentCount; --i)
      panel.lines.group.removeChild(panel.lines.group.childNodes[i]);
    panel.lines.splice(segmentCount);

    for (var i = panel.lines.group.childNodes.length; i < segmentCount; ++i) {
      var posY = (i + 1) * this.config.panelPadding * 2;
      panel.lines[i] = this.createElement('path', panel.lines.group);
      panel.lines[i].setAttribute('d', 'M0,' + posY + 'h' + width);
    }
  }

  panel.width = width + this.config.panelMargin;
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
  var panel = {};
  panel.leftSide = Array(segementsLeft);
  for (var i = 0; i < segementsLeft; ++i)
    panel.leftSide[i] = {};
  panel.rightSide = Array(segementsRight);
  for (var i = 0; i < segementsRight; ++i)
    panel.rightSide[i] = {};
  return this.initializePanel(panel);
};

module.exports.prototype.hasSocketAtIndex = function (panel, index) {
  if (index < 0)
    return panel.leftSide[-index - 1] !== undefined;
  else if (index > 0)
    return panel.rightSide[index - 1] !== undefined;
  else
    return panel.socket !== undefined;
};

module.exports.prototype.getSocketAtIndex = function (panel, index) {
  if (index < 0)
    return panel.leftSide[-index - 1].socket;
  else if (index > 0)
    return panel.rightSide[index - 1].socket;
  else
    return panel.socket;
};

module.exports.prototype.getIndexOfSocket = function (panel, socket) {
  if (panel.socket === socket)
    return 0;
  for (var i = 0; i < panel.leftSide.length; ++i)
    if (panel.leftSide[i].socket === socket)
      return -i - 1;
  for (var i = 0; i < panel.rightSide.length; ++i)
    if (panel.rightSide[i].socket === socket)
      return i + 1;
  return undefined;
};

module.exports.prototype.connectPanels = function (srcPanel, dstPanel) {
  var entry = srcPanel.interPanelLinks.get(dstPanel);
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
  var entry = srcPanel.interPanelLinks.get(dstPanel);
  if (entry.arc > 1)
    --entry.arc;
  else {
    if (entry.wire)
      this.layoutEngine._links.splice(this.layoutEngine._links.indexOf(entry.wire), 1);
    srcPanel.interPanelLinks.delete(dstPanel);
  }
};

module.exports.prototype.connectSockets = function (wire, srcSocket, dstPanel) {
  var set;
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
  var set = srcSocket.wiresPerPanel.get(dstPanel);
  if (!set.has(wire))
    return false;
  set.delete(wire);
  if (set.size === 0)
    srcSocket.wiresPerPanel.delete(dstPanel);
  return true;
};

module.exports.prototype.initializeWire = function (wire) {
  if (!this.connectSockets(wire, wire.srcSocket, wire.dstPanel))
    return;
  this.connectSockets(wire, wire.dstSocket, wire.srcPanel);
  wire.path = this.createElement('path', this.wiresGroup);
  wire.path.classList.add('wire');
  wire.path.classList.add('fadeIn');
  if (wire.srcPanel != wire.dstPanel) {
    var entry = this.connectPanels(wire.srcPanel, wire.dstPanel);
    this.connectPanels(wire.dstPanel, wire.srcPanel);
    if (entry.arc == 1) {
      entry.wire = {
        source: wire.srcPanel,
        target: wire.dstPanel
      };
      this.layoutEngine._links.push(entry.wire);
    }
  }
  this.wires.add(wire);
  this.dirtyFlag = true;
  return wire;
};

module.exports.prototype.delete = function (element) {
  element.deathFlag = true;
  this.dirtyFlag = true;
};

module.exports.prototype.createWireHelper = function (srcPanel, dstPanel, srcIndex, dstIndex) {
  var wire = {};
  wire.srcPanel = srcPanel;
  wire.dstPanel = dstPanel;
  wire.srcSocket = this.getSocketAtIndex(wire.srcPanel, srcIndex);
  wire.dstSocket = this.getSocketAtIndex(wire.dstPanel, dstIndex);
  return this.initializeWire(wire);
};

module.exports.prototype.syncGraph = function () {
  if (!this.dirtyFlag)
    return;
  this.dirtyFlag = false;
  var rect = this.svg.getBoundingClientRect();
  this.layoutEngine.size([rect.width, rect.height]);
  this.layoutEngine.start();
  this.tickGraph();
};

module.exports.prototype.setCursorSocket = function (socket) {
  if (this.cursorSocket)
    this.cursorSocket.classList.remove('cursor');
  this.cursorSocket = socket;
  if (socket)
    this.cursorSocket.classList.add('cursor');
};

module.exports.prototype.setCursorIndex = function (index) {
  if (!this.cursorPanel || !this.hasSocketAtIndex(this.cursorPanel, index))
    return false;
  this.setCursorSocket(this.getSocketAtIndex(this.cursorPanel, index));
  return true;
};

module.exports.prototype.cursorFollowWire = function () {
  if (!this.cursorPanel || this.cursorSocket.wiresPerPanel.size != 1)
    return false;
  var set = this.cursorSocket.wiresPerPanel.values().next().value;
  if (set.size != 1)
    return false;
  var wire = set.values().next().value;
  this.cursorPanel = (this.cursorPanel == wire.srcPanel) ? wire.dstPanel : wire.srcPanel;
  this.setCursorSocket((this.cursorSocket == wire.srcSocket) ? wire.dstSocket : wire.srcSocket);
  return true;
};
