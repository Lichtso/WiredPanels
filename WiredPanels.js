export default function module(parentElement) {
    while(parentElement.getElementsByClassName('fallback').length > 0)
        parentElement.removeChild(parentElement.getElementsByClassName('fallback')[0]);
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    parentElement.appendChild(this.svg);
    this.svg.classList.add('WiredPanels');

    document.body.addEventListener('keydown', function(event) {
        if(this.svg.parentNode.querySelector('svg:hover') == null || event.ctrlKey)
            return;
        switch(event.keyCode) {
            case 8: // Backspace
                if(this.config.ondeletion)
                    this.config.ondeletion();
                for(let node of this.selection)
                    this.delete(node);
                this.syncGraph();
                break;
            case 13: // Enter
                if(this.config.onactivation)
                    this.config.onactivation();
                break;
            case 90: // Meta (+ Shift) + Z
                if(!event.metaKey)
                    return;
                if(event.shiftKey) {
                    if(this.actionIndex < this.actionStack.length)
                        this.actionStack[this.actionIndex++](true);
                } else {
                    if(this.actionIndex > 0)
                        this.actionStack[--this.actionIndex](false);
                }
                break;
            default:
                return;
        }
        event.stopPropagation();
        event.preventDefault();
    }.bind(this));

    const mousedown = function(event) {
        this.draggingMoved = false;
        const mousePos = this.mousePositionOfEvent(event);
        this.boxSelection.originX = mousePos[0];
        this.boxSelection.originY = mousePos[1];
        this.boxSelection.setAttribute('width', 0);
        this.boxSelection.setAttribute('height', 0);
        this.boxSelection.classList.remove('fadeOut');
        this.boxSelection.classList.add('fadeIn');
        this.dragging = this.boxSelection;
        if(!event.shiftKey)
            this.deselectAll();
        event.stopPropagation();
        event.preventDefault();
    }.bind(this);
    this.svg.addEventListener('mousedown', mousedown);
    this.svg.addEventListener('touchstart', function(event) {
        return mousedown(event.touches[0]);
    });

    const mousemove = function(event) {
        if(!this.dragging)
            return;
        this.draggingMoved = true;
        const mousePos = this.mousePositionOfEvent(event);
        if(this.dragging == this.boxSelection) {
            this.boxSelection.minX = Math.min(this.boxSelection.originX, mousePos[0]);
            this.boxSelection.minY = Math.min(this.boxSelection.originY, mousePos[1]);
            this.boxSelection.maxX = Math.max(this.boxSelection.originX, mousePos[0]);
            this.boxSelection.maxY = Math.max(this.boxSelection.originY, mousePos[1]);
            this.boxSelection.setAttribute('x', this.boxSelection.minX);
            this.boxSelection.setAttribute('y', this.boxSelection.minY);
            this.boxSelection.setAttribute('width', this.boxSelection.maxX-this.boxSelection.minX);
            this.boxSelection.setAttribute('height', this.boxSelection.maxY-this.boxSelection.minY);
        } else if(this.dragging.srcSocket) {
            if(this.dragging.type != 'wire') {
                this.createWire(this.dragging);
                this.dragging.path.classList.add('noHover');
            }
            this.dragging.dstSocket.circle.x = mousePos[0];
            this.dragging.dstSocket.circle.y = mousePos[1];
            this.tickWire(this.dragging);
        } else {
            this.dragging.forEach(function(dragging, panel) {
                panel.x = mousePos[0] - dragging.x;
                panel.y = mousePos[1] - dragging.y;
            }, this);
            this.stabilizeGraph();
        }
        event.stopPropagation();
        event.preventDefault();
    }.bind(this);
    this.svg.addEventListener('mousemove', mousemove);
    this.svg.addEventListener('touchmove', function(event) {
        return mousemove(event.touches[0]);
    });

    const mouseup = function(event) {
        if(!this.dragging)
            return;
        if(this.dragging == this.boxSelection) {
            this.boxSelection.classList.remove('fadeIn');
            this.boxSelection.classList.add('fadeOut');
            if(this.draggingMoved) {
                const isSocketInBoxSelection = function(socket) {
                    return this.boxSelection.minX < socket.circle.x && socket.circle.x < this.boxSelection.maxX
                        && this.boxSelection.minY < socket.circle.y && socket.circle.y < this.boxSelection.maxY;
                }.bind(this);
                const selectionMode = (event.shiftKey) ? 'toggle' : true;
                for(const panel of this.panels) {
                    const rect = this.boundingRectOfPanel(panel);
                    if(this.boxSelection.minX < rect[0] && rect[1] < this.boxSelection.maxX
                       && this.boxSelection.minY < rect[2] && rect[3] < this.boxSelection.maxY)
                        this.setSelected(panel, selectionMode);
                    for(const socket of panel.sockets)
                        if(isSocketInBoxSelection(socket))
                            this.setSelected(socket, selectionMode);
                }
                for(const wire of this.wires)
                    if(isSocketInBoxSelection(wire.srcSocket) && isSocketInBoxSelection(wire.dstSocket))
                        this.setSelected(wire, selectionMode);
            }
        } else if(this.dragging.type == 'wire') {
            this.selection.delete(this.dragging);
            this.wires.delete(this.dragging);
            deleteElements([this.dragging.path]);
        } else
            for(const node of this.selection)
                if(node.type == 'panel') {
                    node.rect.classList.remove('selected');
                    this.selection.delete(node);
                }
        this.draggingMoved = false;
        delete this.dragging;
        event.stopPropagation();
        event.preventDefault();
    }.bind(this);
    this.svg.addEventListener('mouseup', mouseup);
    this.svg.addEventListener('mouseleave', mouseup);
    this.svg.addEventListener('touchend', function(event) {
        return mouseup(event.touches[0]);
    });

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
    this.boxSelection = this.createElement('rect', this.svg);
    this.boxSelection.classList.add('boxSelection');
    this.panels = new Set();
    this.springs = new Set();
    this.wires = new Set();
    this.selection = new Set();
    this.tickCount = 0;
    this.actionStack = [];
    this.actionIndex = 0;
};

module.prototype.config = {
    socketRadius: 5,
    verticalSocketsOutside: false,
    horizontalSocketsOutside: false,
    fontSize: 12,
    wireStyle: 'hybrid',
    panelCornerRadius: 10,
    panelPadding: 12,
    panelMargin: 12,
    springLength: 200,
    springStiffness: 0.1,
    panelCollision: true,
    borderCollision: true,
    undoActionLimit: 0,
    ondeletion: undefined,
    onactivation: undefined,
    onwireconnect: undefined
};

module.prototype.setSelected = function(node, selectionMode) {
    const wasSelected = this.selection.has(node),
          svgElement = eventElementOfNode(node);
    if(selectionMode == wasSelected)
        return wasSelected;
    if(selectionMode == 'toggle')
        selectionMode = !wasSelected;
    if(selectionMode) {
        this.selection.add(node);
        svgElement.classList.add('selected');
    } else {
        this.selection.delete(node);
        svgElement.classList.remove('selected');
    }
    return selectionMode;
};

module.prototype.deselectAll = function() {
    for(let node of this.selection)
        eventElementOfNode(node).classList.remove('selected');
    this.selection.clear();
};

module.prototype.undoableAction = function(action) {
    this.actionStack = this.actionStack.slice(0, this.actionIndex);
    this.actionStack.push(action);
    if(this.config.undoActionLimit > 0 && this.actionStack.length > this.config.undoActionLimit) {
        this.actionStack = this.actionStack.slice(this.actionStack.length - this.config.undoActionLimit);
        this.actionIndex = this.actionStack.length;
    }
    this.actionStack[this.actionIndex++](true);
};

module.prototype.createWire = function(wire) {
    if(!wire)
        wire = {};
    wire.type = 'wire';
    wire.path = this.createElement('path', this.wiresGroup);
    wire.path.classList.add('wire');
    wire.path.classList.add('fadeIn');
    this.addEventListeners(wire);
    this.wires.add(wire);
    return wire;
};

module.prototype.connectWire = function(wire) {
    function connectSocket(srcSocket, dstPanel) {
        let set;
        if(!srcSocket.wiresPerPanel.has(dstPanel)) {
            set = new Set();
            srcSocket.wiresPerPanel.set(dstPanel, set);
        } else {
            set = srcSocket.wiresPerPanel.get(dstPanel);
            if(set.has(wire))
                return false;
        }
        set.add(wire);
        return true;
    }
    if(!connectSocket(wire.srcSocket, wire.dstPanel) ||
       !connectSocket(wire.dstSocket, wire.srcPanel))
        return;
    if(wire.srcSocket.panel != wire.dstSocket.panel) {
        let spring = wire.srcSocket.panel.springs.get(wire.dstSocket.panel);
        if(spring)
            ++spring.referenceCount;
        else {
            spring = {
                referenceCount: 1,
                srcPanel: wire.srcSocket.panel,
                dstPanel: wire.dstSocket.panel
            };
            wire.srcSocket.panel.springs.set(wire.dstSocket.panel, spring);
            wire.dstSocket.panel.springs.set(wire.srcSocket.panel, spring);
            this.springs.add(spring);
        }
    }
    this.dirtyFlag = true;
};

module.prototype.createPanel = function(panel) {
    if(!panel)
        panel = {};
    panel.type = 'panel';
    panel.springs = new Map();
    panel.group = this.createElement('g', this.panelsGroup);
    panel.lines = this.createElement('path', panel.group);
    panel.rect = this.createElement('rect', panel.group);
    panel.circleGroup = this.createElement('g', panel.group);
    panel.labelGroup = this.createElement('g', panel.group);
    panel.group.classList.add('fadeIn');
    panel.lines.classList.add('panel');
    panel.rect.classList.add('panel');
    panel.rect.setAttribute('rx', this.config.panelCornerRadius);
    panel.rect.setAttribute('ry', this.config.panelCornerRadius);
    const rect = this.svg.getBoundingClientRect();
    if(!panel.x)
        panel.x = rect.width * Math.random();
    if(!panel.y)
        panel.y = rect.height * Math.random();
    if(panel.sockets)
        this.updatePanelSockets(panel);
    else
        panel.sockets = [];
    panel.state = 'updateGeometry';
    this.addEventListeners(panel);
    this.panels.add(panel);
    this.dirtyFlag = true;
    return panel;
};

module.prototype.updatePanelSockets = function(panel) {
    panel.topSockets = [];
    panel.leftSockets = [];
    panel.rightSockets = [];
    panel.bottomSockets = [];

    for(let i = 0; i < panel.sockets.length; ++i) {
        const socket = panel.sockets[i];
        if(socket.state == 'delete') {
            this.dirtyFlag = true;
            this.deleteSocket(socket);
            panel.circleGroup.removeChild(panel.circleGroup.childNodes[i]);
            panel.labelGroup.removeChild(panel.labelGroup.childNodes[i]);
            panel.sockets.splice(i, 1);
            --i;
            continue;
        }

        if(!socket.circle) {
            socket.type = 'socket';
            socket.circle = this.createElement('circle', panel.circleGroup);
            socket.circle.classList.add('socket');
            socket.circle.setAttribute('r', this.config.socketRadius);
            socket.label = this.createElement('text', panel.labelGroup);
            socket.label.classList.add('label');
            socket.label.textContent = 'undefined';
            this.addEventListeners(socket);
            socket.wiresPerPanel = new Map();
            socket.panel = panel;
        }

        switch(socket.orientation) {
            case 'top':
                panel.topSockets.push(socket);
                break;
            case 'left':
                panel.leftSockets.push(socket);
                break;
            case 'right':
                panel.rightSockets.push(socket);
                break;
            case 'bottom':
                panel.bottomSockets.push(socket);
                break;
        }
    }
};

module.prototype.updatePanelGeometry = function(panel) {
    const fontOffsetY = this.config.fontSize * 0.3,
          topAndBottomLine = (this.config.socketsOutside) ? 1 : 2,
          horizontalSocketPadding = (this.config.horizontalSocketsOutside) ? 2 : 3,
          topLine = (panel.topSockets.length) ? topAndBottomLine : 0,
          bottomLine = (panel.bottomSockets.length) ? topAndBottomLine : 0,
          doubleLineCount = Math.min(panel.leftSockets.length, panel.rightSockets.length),
          singleLineCount = Math.max(panel.leftSockets.length, panel.rightSockets.length),
          totalLineCount = topLine + singleLineCount + bottomLine;
    for(const socket of panel.sockets)
        socket.label.width = Math.max(this.config.panelPadding, socket.label.getBBox().width);

    let topLineWidth = this.config.panelPadding * (panel.topSockets.length + 1),
        bottomLineWidth = this.config.panelPadding * (panel.bottomSockets.length + 1);
    for(const socket of panel.topSockets)
        topLineWidth += socket.label.width;
    for(const socket of panel.bottomSockets)
        bottomLineWidth += socket.label.width;
    panel.width = Math.max(topLineWidth, bottomLineWidth, this.config.panelPadding * 2);
    for(let i = 0; i < doubleLineCount; ++i)
        panel.width = Math.max(panel.width, this.config.panelPadding * (horizontalSocketPadding * 2 - 1) + panel.leftSockets[i].label.width + panel.rightSockets[i].label.width);
    for(let i = doubleLineCount; i < panel.leftSockets.length; ++i)
        panel.width = Math.max(panel.width, this.config.panelPadding * horizontalSocketPadding + panel.leftSockets[i].label.width);
    for(let i = doubleLineCount; i < panel.rightSockets.length; ++i)
        panel.width = Math.max(panel.width, this.config.panelPadding * horizontalSocketPadding + panel.rightSockets[i].label.width);
    panel.height = Math.max(totalLineCount, 1) * this.config.panelPadding * 2;
    panel.rect.setAttribute('width', panel.width);
    panel.rect.setAttribute('height', panel.height);

    const verticalSockets = function(sockets, lineWidth, sideFactor) {
        let posX = (panel.width - lineWidth) / 2, lastWidth = 0;
        const posY = Math.round((sideFactor == 1 ? panel.height : 0) + sideFactor * this.config.panelPadding * (this.config.verticalSocketsOutside ? 1 : -1)),
              labelPosY = Math.round(posY - sideFactor * this.config.panelPadding * 2 + fontOffsetY);
        for(let i = 0; i < sockets.length; ++i) {
            const socket = sockets[i];
            posX += (lastWidth + socket.label.width) / 2 + this.config.panelPadding;
            lastWidth = socket.label.width;
            socket.circle.x = Math.round(posX);
            socket.circle.y = posY;
            socket.label.setAttribute('x', socket.circle.x);
            socket.label.setAttribute('y', labelPosY);
            socket.label.setAttribute('text-anchor', 'middle');
        }
    }.bind(this);
    const horizontalSockets = function(sockets, sideFactor) {
        const paddingFactor = (this.config.horizontalSocketsOutside) ? 1 : 0,
              posX = Math.round((sideFactor == -1 ? panel.width : 0) + sideFactor * (1 - 2 * paddingFactor) * this.config.panelPadding),
              labelPosX = Math.round(posX + sideFactor * (1 + paddingFactor) * this.config.panelPadding);
        for(let i = 0; i < sockets.length; ++i) {
            const socket = sockets[i];
            socket.circle.x = posX;
            socket.circle.y = ((topLine + i) * 2 + 1) * this.config.panelPadding;
            socket.label.setAttribute('x', labelPosX);
            socket.label.setAttribute('y', Math.round(socket.circle.y + fontOffsetY));
            socket.label.setAttribute('text-anchor', (sideFactor == 1) ? 'start' : 'end');
        }
    }.bind(this);
    verticalSockets(panel.topSockets, topLineWidth, -1);
    verticalSockets(panel.bottomSockets, bottomLineWidth, 1);
    horizontalSockets(panel.leftSockets, 1);
    horizontalSockets(panel.rightSockets, -1);

    for(const socket of panel.sockets) {
        socket.circle.setAttribute('cx', socket.circle.x);
        socket.circle.setAttribute('cy', socket.circle.y);
    }

    let pathD = '';
    if(topLine > 0)
        pathD += 'M0,' + (topLine * this.config.panelPadding * 2) + 'h' + panel.width;
    if(bottomLine > 0)
        pathD += 'M0,' + ((totalLineCount - bottomLine) * this.config.panelPadding * 2) + 'h' + panel.width;
    panel.lines.setAttribute('d', pathD);

    delete panel.state;
    return panel;
};

module.prototype.delete = function(node) {
    node.state = 'delete';
    if(node.type == 'socket')
        node.panel.state = 'updateSockets';
    this.dirtyFlag = true;
};

module.prototype.boundingRectOfPanel = function(panel) {
    const halfWidth = panel.width / 2 + this.config.panelMargin,
          halfHeight = panel.height / 2 + this.config.panelMargin;
    return [panel.x - halfWidth, panel.x + halfWidth, panel.y - halfHeight, panel.y + halfHeight];
};

module.prototype.mousePositionOfEvent = function(event) {
    const rect = this.svg.getBoundingClientRect();
    return [event.pageX - rect.left - window.pageXOffset, event.pageY - rect.top - window.pageYOffset];
};

module.prototype.stabilizeGraph = function() {
    this.tickCount = 20;
    if(!this.animationTimer)
        this.animationTimer = window.setInterval(this.tickGraph.bind(this), 20);
};

module.prototype.tickGraph = function() {
    if(--this.tickCount == 0) {
        window.clearInterval(this.animationTimer);
        delete this.animationTimer;
    }

    if(this.config.springStiffness > 0)
        for(const spring of this.springs) {
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

    if(this.config.panelCollision) {
        let i = 0;
        for(const panelA of this.panels) {
            let j = 0;
            for(const panelB of this.panels) {
                if(i <= j)
                    break;
                const rectA = this.boundingRectOfPanel(panelA), rectB = this.boundingRectOfPanel(panelB);
                let overlapX = Math.min(rectA[1], rectB[1]) - Math.max(rectA[0], rectB[0]),
                    overlapY = Math.min(rectA[3], rectB[3]) - Math.max(rectA[2], rectB[2]);
                if(overlapX <= 0 || overlapY <= 0)
                    continue;
                if(Math.abs(overlapX) < Math.abs(overlapY)) {
                    if(panelA.x < panelB.x)
                        overlapX *= -1;
                    panelA.x += overlapX;
                    panelB.x -= overlapX;
                } else {
                    if(panelA.y < panelB.y)
                        overlapY *= -1;
                    panelA.y += overlapY;
                    panelB.y -= overlapY;
                }
                ++j;
            }
            ++i;
        }
    }

    if(this.config.borderCollision) {
        const rect = this.svg.getBoundingClientRect();
        for(const panel of this.panels) {
            const panelRect = this.boundingRectOfPanel(panel);
            if(panelRect[0] < 0)
                panel.x -= panelRect[0];
            else if(panelRect[1] > rect.width)
                panel.x -= panelRect[1] - rect.width;
            if(panelRect[2] < 0)
                panel.y -= panelRect[2];
            else if(panelRect[3] > rect.height)
                panel.y -= panelRect[3] - rect.height;
        }
    }

    for(const panel of this.panels) {
        const posX = panel.x - panel.width / 2,
              posY = panel.y - panel.height / 2;
        panel.group.setAttribute('transform', 'translate(' + posX + ', ' + posY + ')');

        function tickSocket(socket) {
            const svgElement = socket.circle;
            svgElement.x = posX + parseInt(svgElement.getAttribute('cx'));
            svgElement.y = posY + parseInt(svgElement.getAttribute('cy'));
        };
        for(const socket of panel.sockets)
            tickSocket(socket);
    }

    for(const wire of this.wires)
        this.tickWire(wire);
};

module.prototype.syncGraph = function() {
    if(!this.dirtyFlag)
        return;
    this.dirtyFlag = false;

    let trash = new Set();
    for(const panel of this.panels)
        switch(panel.state) {
            case 'updateSockets':
                this.updatePanelSockets(panel);
            case 'updateGeometry':
                this.updatePanelGeometry(panel);
                break;
            case 'delete':
                for(const socket of panel.sockets)
                    this.deleteSocket(socket);
                trash.add(panel.group);
                this.panels.delete(panel);
                this.selection.delete(panel);
                break;
        }

    for(const wire of this.wires) {
        if(wire.state != 'delete')
            continue;
        if(wire.srcSocket.panel && wire.dstSocket.panel) {
            function disconnectSocket(srcSocket, dstPanel) {
                if(!srcSocket.wiresPerPanel.has(dstPanel))
                    return false;
                const set = srcSocket.wiresPerPanel.get(dstPanel);
                if(!set.has(wire))
                    return false;
                set.delete(wire);
                if(set.size == 0)
                    srcSocket.wiresPerPanel.delete(dstPanel);
                return true;
            }
            disconnectSocket(wire.srcSocket, wire.dstSocket.panel);
            disconnectSocket(wire.dstSocket, wire.srcSocket.panel);
            if(wire.srcSocket.panel != wire.dstSocket.panel) {
                const spring = wire.srcSocket.panel.springs.get(wire.dstSocket.panel);
                if(spring.referenceCount > 1)
                    --spring.referenceCount;
                else {
                    wire.srcSocket.panel.springs.delete(wire.dstSocket.panel);
                    wire.dstSocket.panel.springs.delete(wire.srcSocket.panel);
                    this.springs.delete(spring);
                }
            }
        }
        trash.add(wire.path);
        this.wires.delete(wire);
        this.selection.delete(wire);
    }

    deleteElements(trash);
    this.stabilizeGraph();
};



module.prototype.addEventListeners = function(node) {
    const svgElement = eventElementOfNode(node);
    const mousedown = function(event) {
        this.draggingMoved = false;
        const mousePos = this.mousePositionOfEvent(event);
        if(event.shiftKey)
            this.setSelected(node, 'toggle');
        else switch(node.type) {
            case 'panel':
                this.setSelected(node, true);
                this.dragging = new Map();
                for(const node of this.selection)
                    if(node.type == 'panel')
                        this.dragging.set(node, {
                            x: mousePos[0] - node.x,
                            y: mousePos[1] - node.y
                        });
                break;
            case 'socket':
                this.dragging = {
                    srcSocket: node,
                    dstSocket: { circle: {} }
                };
                break;
        }
        event.stopPropagation();
        event.preventDefault();
    }.bind(this);
    svgElement.addEventListener('mousedown', mousedown);
    svgElement.addEventListener('touchstart', function(event) {
        return mousedown(event.touches[0]);
    });

    const mouseup = function(event) {
        if(event.shiftKey)
            return true;
        if(!this.draggingMoved) {
            if(this.config.onactivation)
                this.config.onactivation();
        } else if(this.dragging.type == 'wire' &&
                  this.config.onwireconnect) {
            this.dragging.dstSocket = this.config.onwireconnect(node, this.dragging);
            if(this.dragging.dstSocket) {
                this.connectWire(this.dragging);
                this.stabilizeGraph();
                this.dragging.path.classList.remove('noHover');
                delete this.dragging;
            }
        }
    }.bind(this);
    svgElement.addEventListener('mouseup', mouseup);
    svgElement.addEventListener('touchstop', function(event) {
        return mouseup(event.touches[0]);
    });
};

module.prototype.createElement = function(tag, parentNode) {
    const svgElement = document.createElementNS(this.svg.namespaceURI, tag);
    parentNode.appendChild(svgElement);
    return svgElement;
};

function eventElementOfNode(node) {
    switch(node.type) {
        case 'socket':
            return node.circle;
        case 'wire':
            return node.path;
        case 'panel':
            return node.rect;
    }
}

function deleteElements(svgElements) {
    for(const svgElement of svgElements) {
        svgElement.classList.remove('fadeIn');
        svgElement.classList.add('fadeOut');
    }
    window.setTimeout(function() {
        for(const svgElement of svgElements)
            svgElement.parentNode.removeChild(svgElement);
    }, 250);
}

module.prototype.deleteSocket = function(socket) {
    this.selection.delete(socket);
    for(const pair of socket.wiresPerPanel)
        for(const wire of pair[1])
            wire.state = 'delete';
};

module.prototype.tickWire = function(wire) {
    const src = wire.srcSocket.circle,
          dst = wire.dstSocket.circle;
    let pathD = 'M' + src.x + ',' + src.y;
    switch(this.config.wireStyle) {
        case 'straight':
            pathD += 'L' + dst.x + ',' + dst.y;
            break;
        case 'vertical':
            pathD += 'C' + dst.x + ',' + src.y + ' ' + src.x + ',' + dst.y + ' ' + dst.x + ',' + dst.y;
            break;
        case 'horizontal':
            pathD += 'C' + src.x + ',' + dst.y + ' ' + dst.x + ',' + src.y + ' ' + dst.x + ',' + dst.y;
            break;
        case 'hybrid':
            if(Math.abs(src.x - dst.x) < Math.abs(src.y - dst.y))
                pathD += 'C' + dst.x + ',' + src.y + ' ' + src.x + ',' + dst.y + ' ' + dst.x + ',' + dst.y;
            else
                pathD += 'C' + src.x + ',' + dst.y + ' ' + dst.x + ',' + src.y + ' ' + dst.x + ',' + dst.y;
            break;
        case 'gravity':
            const diffX = dst.x - src.x;
            const maxY = Math.max(dst.y, src.y) + 20;
            pathD += 'C' + (src.x + diffX * 0.25) + ',' + maxY + ' ' + (src.x + diffX * 0.75) + ',' + maxY + ' ' + dst.x + ',' + dst.y;
            break;
    }
    wire.path.setAttribute('d', pathD);
};
