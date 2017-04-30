/* jslint node: true, esnext: true */
/* global document, window */
'use strict';


export default class WiredPanels {
  constructor(parentElement) {
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
      const rect = this.svg.getBoundingClientRect(),
        mouseX = event.pageX - rect.left - window.pageXOffset,
        mouseY = event.pageY - rect.top - window.pageYOffset;
      if (this.dragging.srcSocket) {
        if (!this.dragging.path) {
          this.initializeWire(this.dragging);
          this.dragging.path.setAttribute('pointer-events', 'none');
        }
        this.dragging.dstSocket.circle.x = mouseX;
        this.dragging.dstSocket.circle.y = mouseY;
        this.tickWire(this.dragging);
      } else {
        this.dragging.forEach(function (dragging, node) {
          node.x = mouseX - dragging.x;
          node.y = mouseY - dragging.y;
        }, this);
        this.stabilizeGraph();
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
      if (this.dragging.path) {
        this.selection.wires.delete(this.dragging);
        this.wires.delete(this.dragging);
        this.deleteElements([this.dragging.path]);
      } else {
        for (const panel of this.selection.panels)
          panel.rect.classList.remove('selected');
        this.selection.panels.clear();
      }
      delete this.dragging;
      event.stopPropagation();
      return true;
    }.bind(this);
    this.svg.parentNode.ontouchend = function (event) {
      return this.svg.parentNode.onmouseup(event.touches[0]);
    }.bind(this);
    this.svg.parentNode.onmouseleave = function (event) {
      return this.svg.parentNode.onmouseup(event);
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
    this.panels = new Set();
    this.springs = new Set();
    this.wires = new Set();
    this.selection = {
      sockets: new Set(),
      wires: new Set(),
      panels: new Set()
    };
    this.tickCount = 0;
  }

  get config() {
    return _config;
  }

  handleKeyboard(event) {
    if (this.svg.parentNode.querySelector('svg:hover') === null || event.ctrlKey)
      return;
    event.stopPropagation();
    event.preventDefault();
    switch (event.keyCode) {
      case 8:
        this.iterateSelection(function (type, element, node) {
          if (node.ondeletion)
            node.ondeletion(type, element, node);
        });
        this.deselectAll();
        this.syncGraph();
        break;
      case 13:
        this.iterateSelection(function (type, element, node) {
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
  }

  setHandlers(type, element, node) {
    element.onmousedown = function (event) {
      this.draggingMoved = false;
      const rect = this.svg.getBoundingClientRect(),
        mouseX = event.pageX - rect.left - window.pageXOffset,
        mouseY = event.pageY - rect.top - window.pageYOffset;
      if (event.shiftKey)
        this.setSelected(type, element, node, 'toggle');
      else switch (type) {
        case 'panels':
          this.setSelected(type, element, node, true);
          this.dragging = new Map();
          this.selection.panels.forEach(function (node) {
            let dragging = {
              x: mouseX - node.x,
              y: mouseY - node.y
            };
            this.dragging.set(node, dragging);
          }, this);
          break;
        case 'sockets':
          this.dragging = {
            type: node.type,
            srcSocket: node,
            dstSocket: {
              circle: {}
            }
          };
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
  }

  createElement(tag, parentNode) {
    const element = document.createElementNS(this.svg.namespaceURI, tag);
    parentNode.appendChild(element);
    return element;
  }

  setSelected(type, element, node, newValue) {
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
  }

  iterateSelection(callback) {
    for (let socket of this.selection.sockets)
      callback('sockets', socket.circle, socket);
    for (let wire of this.selection.wires)
      callback('wires', wire.path, wire);
    for (let panel of this.selection.panels)
      callback('panels', panel.rect, panel);
  }

  deselectAll() {
    this.iterateSelection(function (type, element, node) {
      element.classList.remove('selected');
    });
    this.selection.sockets.clear();
    this.selection.wires.clear();
    this.selection.panels.clear();
  }

  getSocketAtIndex(panel, index) {
    if (index < 0)
      return panel.leftSide[-index - 1];
    else if (index > 0)
      return panel.rightSide[index - 1];
    else
      return panel;
  }

  getIndexOfSocket(socket) {
    if (socket.panel === socket)
      return 0;
    for (let i = 0; i < socket.panel.leftSide.length; ++i)
      if (socket.panel.leftSide[i] === socket)
        return -i - 1;
    for (let i = 0; i < socket.panel.rightSide.length; ++i)
      if (socket.panel.rightSide[i] === socket)
        return i + 1;
    return undefined;
  }

  connectPanels(srcPanel, dstPanel) {
    if (srcPanel === dstPanel)
      return;
    let spring = srcPanel.springs.get(dstPanel);
    if (spring)
      ++spring.referenceCount;
    else {
      spring = {
        referenceCount: 1,
        srcPanel: srcPanel,
        dstPanel: dstPanel
      };
      srcPanel.springs.set(dstPanel, spring);
      dstPanel.springs.set(srcPanel, spring);
      this.springs.add(spring);
    }
    return spring;
  }

  disconnectPanels(srcPanel, dstPanel) {
    if (srcPanel === dstPanel)
      return;
    const spring = srcPanel.springs.get(dstPanel);
    if (spring.referenceCount > 1)
      --spring.referenceCount;
    else {
      srcPanel.springs.delete(dstPanel);
      dstPanel.springs.delete(srcPanel);
      this.springs.delete(spring);
    }
  }

  connectSocket(wire, srcSocket, dstPanel) {
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
  }

  disconnectSocket(wire, srcSocket, dstPanel) {
    if (!srcSocket.wiresPerPanel.has(dstPanel))
      return false;
    const set = srcSocket.wiresPerPanel.get(dstPanel);
    if (!set.has(wire))
      return false;
    set.delete(wire);
    if (set.size === 0)
      srcSocket.wiresPerPanel.delete(dstPanel);
    return true;
  }

  initializeWire(wire) {
    if (wire.srcPanel && wire.dstPanel) {
      if (!this.connectSocket(wire, wire.srcSocket, wire.dstPanel) ||
        !this.connectSocket(wire, wire.dstSocket, wire.srcPanel))
        return;
      this.connectPanels(wire.srcPanel, wire.dstPanel);
    }
    wire.path = this.createElement('path', this.wiresGroup);
    wire.path.classList.add('wire');
    wire.path.classList.add('fadeIn');
    wire.path.classList.add(wire.type);
    this.setHandlers('wires', wire.path, wire);
    this.wires.add(wire);
    this.dirtyFlag = true;
    return wire;
  }

  initializePanel(panel) {
    const rect = this.svg.getBoundingClientRect();
    panel.springs = new Map();
    if (!panel.x)
      panel.x = rect.width * Math.random();
    if (!panel.y)
      panel.y = rect.height * Math.random();
    this.syncPanel(panel);
    this.panels.add(panel);
    this.dirtyFlag = true;
    return panel;
  }

  delete(element) {
    element.deathFlag = true;
    this.dirtyFlag = true;
  }

  tickSocket(posX, posY, socket) {
    const element = socket.circle;
    element.x = posX + parseInt(element.getAttribute('cx'));
    element.y = posY + parseInt(element.getAttribute('cy'));
  }

  tickWire(wire) {
    const src = wire.srcSocket.circle,
      dst = wire.dstSocket.circle;
    switch (this.config.wireStyle) {
      case 'straight':
        wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'L' + dst.x + ',' + dst.y);
        break;
      case 'vertical':
        wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'C' + dst.x + ',' + src.y + ' ' + src.x + ',' + dst.y +
          ' ' + dst.x + ',' + dst.y);
        break;
      case 'horizontal':
        wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'C' + src.x + ',' + dst.y + ' ' + dst.x + ',' + src.y +
          ' ' + dst.x + ',' + dst.y);
        break;
      case 'hybrid':
        if (Math.abs(src.x - dst.x) < Math.abs(src.y - dst.y))
          wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'C' + dst.x + ',' + src.y + ' ' + src.x + ',' + dst
            .y +
            ' ' + dst.x + ',' + dst.y);
        else
          wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'C' + src.x + ',' + dst.y + ' ' + dst.x + ',' + src
            .y +
            ' ' + dst.x + ',' + dst.y);
        break;
      case 'gravity':
        const diffX = dst.x - src.x;
        const maxY = Math.max(dst.y, src.y) + 20;
        wire.path.setAttribute('d', 'M' + src.x + ',' + src.y + 'C' + (src.x + diffX * 0.25) + ',' + maxY + ' ' + (
          src.x +
          diffX * 0.75) + ',' + maxY + ' ' + dst.x + ',' + dst.y);
        break;
    }
  }

  panelMinX(panel) {
    return panel.x - panel.width / 2 - this.config.panelMargin;
  }

  panelMaxX(panel) {
    return panel.x + panel.width / 2 + this.config.panelMargin;
  }

  panelMinY(panel) {
    return panel.y - panel.height / 2 - this.config.panelMargin;
  }

  panelMaxY(panel) {
    return panel.y + panel.height / 2 + this.config.panelMargin;
  }

  tickGraph() {
    if (--this.tickCount === 0)
      window.clearInterval(this.animationTimer);

    if (this.config.springStiffness !== 0)
      for (const spring of this.springs) {
        let vecX = spring.srcPanel.x - spring.dstPanel.x,
          vecY = spring.srcPanel.y - spring.dstPanel.y;
        const distance = Math.max(1, Math.sqrt(vecX * vecX + vecY * vecY)),
          displacement = this.config.springLength - distance,
          factor = this.config.springStiffness * displacement / distance;
        vecX *= factor;
        vecY *= factor;
        spring.srcPanel.x += vecX;
        spring.srcPanel.y += vecY;
        spring.dstPanel.x -= vecX;
        spring.dstPanel.y -= vecY;
      }

    if (this.config.panelCollision) {
      let i = 0;
      for (const panelA of this.panels) {
        let j = 0;
        for (const panelB of this.panels) {
          if (i <= j)
            break;
          let overlapX = Math.min(this.panelMaxX(panelA), this.panelMaxX(panelB)) - Math.max(this.panelMinX(panelA),
              this.panelMinX(panelB)),
            overlapY = Math.min(this.panelMaxY(panelA), this.panelMaxY(panelB)) - Math.max(this.panelMinY(panelA),
              this
              .panelMinY(panelB));
          if (overlapX <= 0 || overlapY <= 0)
            continue;
          if (Math.abs(overlapX) < Math.abs(overlapY)) {
            if (panelA.x < panelB.x)
              overlapX *= -1;
            panelA.x += overlapX;
            panelB.x -= overlapX;
          } else {
            if (panelA.y < panelB.y)
              overlapY *= -1;
            panelA.y += overlapY;
            panelB.y -= overlapY;
          }
          ++j;
        }
        ++i;
      }
    }

    if (this.config.borderCollision) {
      const rect = this.svg.getBoundingClientRect();
      for (const panel of this.panels) {
        if (this.panelMinX(panel) < 0)
          panel.x -= this.panelMinX(panel);
        else if (this.panelMaxX(panel) > rect.width)
          panel.x -= this.panelMaxX(panel) - rect.width;
        if (this.panelMinY(panel) < 0)
          panel.y -= this.panelMinY(panel);
        else if (this.panelMaxY(panel) > rect.height)
          panel.y -= this.panelMaxY(panel) - rect.height;
      }
    }

    for (const panel of this.panels) {
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

    for (const wire of this.wires)
      this.tickWire(wire);
  }

  deleteSocket(socket) {
    this.dirtyFlag = true;
    this.selection.sockets.delete(socket);
    for (const pair of socket.wiresPerPanel)
      for (const wire of pair[1])
        wire.deathFlag = true;
  }

  syncPanelSide(panel, side, isLeft) {
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
        socket.label = this.createElement('text', side.group);
        socket.label.setAttribute('text-anchor', (isLeft) ? 'start' : 'end');
        this.setHandlers('sockets', socket.circle, socket);
        socket.wiresPerPanel = new Map();
        socket.panel = panel;
      }

      const posY = (i + 1) * this.config.panelPadding * 2;
      socket.circle.x = Math.round((isLeft) ? this.config.panelPadding : panel.width - this.config.panelPadding);
      socket.circle.y = Math.round(posY + this.config.panelPadding);
      socket.circle.setAttribute('cx', socket.circle.x);
      socket.circle.setAttribute('cy', socket.circle.y);
      socket.label.setAttribute('x', Math.round((isLeft) ? this.config.panelPadding * 2 : panel.width - this.config.panelPadding *
        2));
      socket.label.setAttribute('y', Math.round(posY + this.config.panelPadding + this.config.fontSize * 0.4));
    }
  }

  syncPanel(panel) {
    if (!panel.group) {
      panel.group = this.createElement('g', this.panelsGroup);
      panel.group.classList.add('fadeIn');

      panel.rect = this.createElement('rect', panel.group);
      panel.rect.classList.add('panel');
      panel.rect.classList.add(panel.type);
      panel.rect.setAttribute('rx', this.config.panelCornerRadius);
      panel.rect.setAttribute('ry', this.config.panelCornerRadius);
      this.setHandlers('panels', panel.rect, panel);
      panel.wiresPerPanel = new Map();
      panel.panel = panel;

      if (this.config.headSocket) {
        panel.circle = this.createElement('circle', panel.group);
        panel.circle.classList.add('socket');
        panel.circle.classList.add(panel.type);
        panel.circle.y = Math.round(-this.config.panelPadding);
        panel.circle.setAttribute('cy', panel.circle.y);
        panel.circle.setAttribute('r', this.config.socketRadius);
        this.setHandlers('sockets', panel.circle, panel);
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

    panel.width = this.config.panelWidth;
    this.syncPanelSide(panel, panel.leftSide, true);
    this.syncPanelSide(panel, panel.rightSide, false);
    const socketCount = Math.max(panel.leftSide.length, panel.rightSide.length);
    panel.height = (socketCount + 1) * this.config.panelPadding * 2;
    panel.rect.setAttribute('width', panel.width);
    panel.rect.setAttribute('height', panel.height);
    const halfWidth = Math.round(panel.width / 2);
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
        panel.lines[i].setAttribute('d', 'M0,' + posY + 'h' + panel.width);
        panel.lines[i].classList.add('noHover');
      }
    }

    return panel;
  }

  stabilizeGraph() {
    if (this.tickCount > 0)
      return;
    this.tickCount = 20;
    this.animationTimer = window.setInterval(this.tickGraph.bind(this), 20);
  }

  syncGraph() {
    if (!this.dirtyFlag)
      return;
    this.dirtyFlag = false;

    const trash = new Set();
    for (const panel of this.panels) {
      if (!panel.deathFlag)
        continue;
      if (panel.circle)
        this.deleteSocket(panel);
      for (let i = 0; i < panel.leftSide.length; ++i)
        this.deleteSocket(panel.leftSide[i]);
      for (let i = 0; i < panel.rightSide.length; ++i)
        this.deleteSocket(panel.rightSide[i]);
      trash.add(panel.group);
      this.panels.delete(panel);
      this.selection.panels.delete(panel);
    }

    for (const wire of this.wires) {
      if (!wire.deathFlag)
        continue;
      if (wire.srcPanel && wire.dstPanel) {
        this.disconnectSocket(wire, wire.srcSocket, wire.dstPanel);
        this.disconnectSocket(wire, wire.dstSocket, wire.srcPanel);
        this.disconnectPanels(wire.srcPanel, wire.dstPanel);
      }
      trash.add(wire.path);
      this.wires.delete(wire);
      this.selection.wires.delete(wire);
    }

    this.deleteElements(trash);
    this.stabilizeGraph();
  }

  deleteElements(trash) {
    for (const element of trash) {
      element.classList.remove('fadeIn');
      element.classList.add('fadeOut');
    }
    window.setTimeout(function () {
      for (const element of trash)
        element.parentNode.removeChild(element);
    }.bind(this), 250);
  }
}

const _config = {
  socketRadius: 5,
  fontSize: 12,
  wireStyle: 'hybrid',
  headSocket: true,
  panelLines: true,
  panelWidth: 300,
  panelCornerRadius: 10,
  panelPadding: 12,
  panelMargin: 12,
  springLength: 200,
  springStiffness: 0.1,
  panelCollision: true,
  borderCollision: true
};
