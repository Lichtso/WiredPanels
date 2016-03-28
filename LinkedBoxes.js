var colaLayout = cola.Layout;

function LinkedBoxes(parentElement) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    parentElement.appendChild(this.svg);
    this.svg.parentNode.classList.add('LinkedBoxes');
    this.svg.parentNode.onkeydown = this.handleKeyboard.bind(this);
    this.svg.parentNode.onmousemove = function(event) {
        event.stopPropagation();
        event.preventDefault();
        if(!this.nodeToDrag)
            return;
        colaLayout.drag(this.nodeToDrag, {
            x:event.pageX-this.svg.offsetLeft+this.config.nodeMargin/2,
            y:event.pageY-this.svg.offsetTop+this.config.nodeMargin/2
        });
        this.layoutEngine.resume();
    }.bind(this);
    this.svg.parentNode.onmouseup = function(event) {
        event.stopPropagation();
        event.preventDefault();
        if(!this.nodeToDrag)
            return;
        colaLayout.dragEnd(this.nodeToDrag);
        this.nodeToDrag = undefined;
    }.bind(this);

    svgDefs = this.createElement('defs', this.svg);
    /* arrowMarker = this.createElement('marker', svgDefs);
    arrowMarker.setAttribute('id', 'arrowMarker');
    arrowMarker.setAttribute('refX', 6);
    arrowMarker.setAttribute('refY', 3);
    arrowMarker.setAttribute('markerWidth', 7);
    arrowMarker.setAttribute('markerHeight', 6);
    arrowMarker.setAttribute('orient', 'auto');
    arrowPath = this.createElement('path', arrowMarker);
    arrowPath.setAttribute('d', 'M0,1L5,3L0,5z'); */

    blurFilter = this.createElement('filter', svgDefs);
    blurFilter.setAttribute('id', 'blurFilter');
    blurFilter.setAttribute('x', -0.5);
    blurFilter.setAttribute('y', -0.5);
    blurFilter.setAttribute('width', 4);
    blurFilter.setAttribute('height', 4);
    feGaussianBlur = this.createElement('feGaussianBlur', blurFilter);
    feGaussianBlur.setAttribute('in', 'SourceGraphic');
    feGaussianBlur.setAttribute('result', 'blur');
    feGaussianBlur.setAttribute('stdDeviation', 3);
    feComponentTransfer = this.createElement('feComponentTransfer', blurFilter);
    feComponentTransfer.setAttribute('in', 'blur');
    feComponentTransfer.setAttribute('result', 'brighter');
    feFunc = this.createElement('feFuncA', feComponentTransfer);
    feFunc.setAttribute('type', 'linear');
    feFunc.setAttribute('slope', 4);
    feMerge = this.createElement('feMerge', blurFilter);
    feMergeNode = this.createElement('feMergeNode', feMerge);
    feMergeNode.setAttribute('in', 'brighter');
    feMergeNode = this.createElement('feMergeNode', feMerge);
    feMergeNode.setAttribute('in', 'SourceGraphic');

    this.layoutEngine = new colaLayout()
        .linkDistance(150)
        .size([this.svg.offsetWidth, this.svg.offsetHeight])
        .avoidOverlaps(true)
        .on('tick', this.tick.bind(this));
    this.nodes = this.layoutEngine._nodes;
    this.links = [];
};

LinkedBoxes.prototype.config = {
    nodeMargin: 20,
    nodePadding: 12,
    nodeCornerRadius: 10,
    circleRadius: 5,
    fontSize: 12,
    linkStyle: 'hybrid',
    headCircle: true,
    segmentLines: true
};

LinkedBoxes.prototype.deleteCircle = function(circle) {
    if(this.cursorCircle == circle)
        this.cursorNode = undefined;
    for(pair of circle.links)
        pair[1].deathFlag = true;
};

LinkedBoxes.prototype.tick = function() {
    trash = [];

    for(var j = 0; j < this.nodes.length; ++j) {
        node = this.nodes[j];
        if(node.deathFlag) {
            if(node.circle)
                this.deleteCircle(node.circle);
            for(var i = 0; i < node.leftSide.length; ++i)
                this.deleteCircle(node.leftSide[i].circle);
            for(var i = 0; i < node.rightSide.length; ++i)
                this.deleteCircle(node.rightSide[i].circle);
            this.dirtyFlag = true;
            trash.push(node.group);
            this.nodes.splice(j, 1);
            --j;
            continue;
        }
        posX = node.x-node.width/2;
        posY = node.y-node.height/2;
        node.group.setAttribute('transform', 'translate('+posX+', '+posY+')');
        if(node.circle)
            this.syncCircle(posX, posY, node.circle);
        for(var i = 0; i < node.leftSide.length; ++i)
            this.syncCircle(posX, posY, node.leftSide[i].circle);
        for(var i = 0; i < node.rightSide.length; ++i)
            this.syncCircle(posX, posY, node.rightSide[i].circle);
    }

    for(var j = 0; j < this.links.length; ++j) {
        link = this.links[j];
        if(link.deathFlag) {
            this.dirtyFlag = true;
            trash.push(link.path);
            link.srcCircle.links.delete(link.dstNode);
            link.dstCircle.links.delete(link.srcNode);
            if(link.srcNode != link.dstNode) {
                this.unlinkNodes(link.srcNode, link.dstNode);
                this.unlinkNodes(link.dstNode, link.srcNode);
            }
            this.links.splice(j, 1);
            --j;
            continue;
        }
        switch(this.config.linkStyle) {
            case 'straight':
                link.path.setAttribute('d', 'M'+link.srcCircle.x+','+link.srcCircle.y+'L'+link.dstCircle.x+','+link.dstCircle.y);
            break;
            case 'vertical':
                link.path.setAttribute('d', 'M'+link.srcCircle.x+','+link.srcCircle.y+'C'+link.dstCircle.x+','+link.srcCircle.y+' '+link.srcCircle.x+','+link.dstCircle.y+' '+link.dstCircle.x+','+link.dstCircle.y);
            break;
            case 'horizontal':
                link.path.setAttribute('d', 'M'+link.srcCircle.x+','+link.srcCircle.y+'C'+link.srcCircle.x+','+link.dstCircle.y+' '+link.dstCircle.x+','+link.srcCircle.y+' '+link.dstCircle.x+','+link.dstCircle.y);
            break;
            case 'hybrid':
                if(Math.abs(link.srcCircle.x-link.dstCircle.x) < Math.abs(link.srcCircle.y-link.dstCircle.y))
                    link.path.setAttribute('d', 'M'+link.srcCircle.x+','+link.srcCircle.y+'C'+link.dstCircle.x+','+link.srcCircle.y+' '+link.srcCircle.x+','+link.dstCircle.y+' '+link.dstCircle.x+','+link.dstCircle.y);
                else
                    link.path.setAttribute('d', 'M'+link.srcCircle.x+','+link.srcCircle.y+'C'+link.srcCircle.x+','+link.dstCircle.y+' '+link.dstCircle.x+','+link.srcCircle.y+' '+link.dstCircle.x+','+link.dstCircle.y);
            break;
            case 'gravity':
                diffX = link.dstCircle.x-link.srcCircle.x;
                maxY = Math.max(link.dstCircle.y, link.srcCircle.y)+20;
                link.path.setAttribute('d', 'M'+link.srcCircle.x+','+link.srcCircle.y+'C'+(link.srcCircle.x+diffX*0.25)+','+maxY+' '+(link.srcCircle.x+diffX*0.75)+','+maxY+' '+link.dstCircle.x+','+link.dstCircle.y);
            break;
        }
    }

    for(var i = 0; i < trash.length; ++i) {
        trash[i].classList.remove('fadeIn');
        trash[i].classList.add('fadeOut');
    }
    window.setTimeout(function() {
        for(var i = 0; i < trash.length; ++i)
            this.svg.removeChild(trash[i]);
    }.bind(this), 250);

    this.syncGraph();
};

LinkedBoxes.prototype.handleKeyboard = function(event) {
    event.stopPropagation();
    if(!this.cursorNode)
        return;
    index = this.getIndexOfCircle(this.cursorNode, this.cursorCircle);
    if(index < 0) {
        switch(event.keyCode) {
            case 37:
                this.cursorFollowLink();
            break;
            case 38:
                this.setCursorIndex(index+1);
            break;
            case 39:
                this.setCursorIndex(-index);
            break;
            case 40:
                this.setCursorIndex(index-1);
            break;
        }
    } else if(index > 0) {
        switch(event.keyCode) {
            case 37:
                this.setCursorIndex(-index);
            break;
            case 38:
                this.setCursorIndex(index-1);
            break;
            case 39:
                this.cursorFollowLink();
            break;
            case 40:
                this.setCursorIndex(index+1);
            break;
        }
    } else {
        switch(event.keyCode) {
            case 37:
                this.setCursorIndex(index-1);
            break;
            case 38:
                this.cursorFollowLink();
            break;
            case 39:
                this.setCursorIndex(index+1);
            break;
        }
    }
};

LinkedBoxes.prototype.createElement = function(tag, parentNode) {
    element = document.createElementNS(this.svg.namespaceURI, tag);
    parentNode.appendChild(element);
    return element;
};

LinkedBoxes.prototype.syncCircle = function(posX, posY, element) {
    element.x = posX+parseInt(element.getAttribute('cx'));
    element.y = posY+parseInt(element.getAttribute('cy'));
};

LinkedBoxes.prototype.syncNodeSide = function(width, side, isLeft) {
    for(var i = 0; i < side.length; ++i) {
        segment = side[i];
        if(segment.deathFlag) {
            this.deleteCircle(segment.circle);
            side.group.removeChild(side.group.childNodes[i*2+1]);
            side.group.removeChild(side.group.childNodes[i*2]);
            side.splice(i, 1);
            --i;
            continue;
        }

        if(!segment.circle) {
            segment.circle = this.createElement('circle', side.group);
            segment.circle.links = new Map;
            segment.circle.setAttribute('r', this.config.circleRadius);
            segment.label = this.createElement('text', side.group);
            segment.label.setAttribute('text-anchor', (isLeft) ? 'start' : 'end');
            segment.label.textContent = 'undefined';
        }
        posY = (i+1)*this.config.nodePadding*2;

        segment.circle.x = Math.round((isLeft) ? this.config.nodePadding : width-this.config.nodePadding);
        segment.circle.y = Math.round(posY+this.config.nodePadding);
        segment.circle.setAttribute('cx', segment.circle.x);
        segment.circle.setAttribute('cy', segment.circle.y);

        segment.label.setAttribute('x', Math.round((isLeft) ? this.config.nodePadding*2 : width-this.config.nodePadding*2));
        segment.label.setAttribute('y', Math.round(posY+this.config.nodePadding+this.config.fontSize*0.4));
    }
};

LinkedBoxes.prototype.syncNode = function(node) {
    segmentCount = Math.max(node.leftSide.length, node.rightSide.length);
    width = 200;
    height = (segmentCount+1)*this.config.nodePadding*2;

    if(!node.group) {
        node.group = this.createElement('g', this.svg);
        this.svg.classList.add('fadeIn');

        node.group.onmousedown = function(event) {
            event.stopPropagation();
            event.preventDefault();
            this.nodeToDrag = node;
            colaLayout.dragStart(node);
        }.bind(this);
        node.group.onmouseover = colaLayout.mouseOver.bind(colaLayout, node);
        node.group.onmouseout = colaLayout.mouseOut.bind(colaLayout, node);

        node.rect = this.createElement('rect', node.group);
        node.rect.setAttribute('rx', this.config.nodeCornerRadius);
        node.rect.setAttribute('ry', this.config.nodeCornerRadius);

        if(this.config.headCircle) {
            node.circle = this.createElement('circle', node.group);
            node.circle.links = new Map;
            node.circle.y = Math.round(-this.config.nodePadding);
            node.circle.setAttribute('cy', node.circle.y);
            node.circle.setAttribute('r', this.config.circleRadius);
        }

        node.label = this.createElement('text', node.group);
        node.label.setAttribute('text-anchor', 'middle');
        node.label.setAttribute('y', Math.round(this.config.nodePadding+this.config.fontSize*0.4));
        node.label.textContent = 'undefined';

        node.leftSide.group = this.createElement('g', node.group);
        node.rightSide.group = this.createElement('g', node.group);
        if(this.config.segmentLines) {
            node.lines = [];
            node.lines.group = this.createElement('g', node.group);
        }
    }

    node.rect.setAttribute('width', width);
    node.rect.setAttribute('height', height);
    halfWidth = Math.round(width/2);
    if(node.circle)
        node.circle.setAttribute('cx', halfWidth);
    node.label.setAttribute('x', halfWidth);

    this.syncNodeSide(width, node.leftSide, true);
    this.syncNodeSide(width, node.rightSide, false);
    if(node.lines) {
        for(var i = node.lines.group.childNodes.length-1; i >= segmentCount; --i)
            node.lines.group.removeChild(node.lines.group.childNodes[i]);
        node.lines.splice(segmentCount);

        for(var i = node.lines.group.childNodes.length; i < segmentCount; ++i) {
            posY = (i+1)*this.config.nodePadding*2;
            node.lines[i] = this.createElement('path', node.lines.group);
            node.lines[i].setAttribute('d', 'M0,'+posY+'h'+width);
        }
    }

    node.width = width+this.config.nodeMargin;
    node.height = height+this.config.nodeMargin;
    return node;
};

LinkedBoxes.prototype.initializeNode = function(node) {
    node.links = new Map;
    this.syncNode(node);
    this.nodes.push(node);
    this.dirtyFlag = true;
    return node;
};

LinkedBoxes.prototype.createNodeHelper = function(segementsLeft, segementsRight) {
    node = {};
    node.leftSide = Array(segementsLeft);
    for(var i = 0; i < segementsLeft; ++i)
        node.leftSide[i] = {};
    node.rightSide = Array(segementsRight);
    for(var i = 0; i < segementsRight; ++i)
        node.rightSide[i] = {};
    return this.initializeNode(node);
};

LinkedBoxes.prototype.linkNodes = function(srcNode, dstNode) {
    entry = srcNode.links.get(dstNode);
    if(entry)
        ++entry.arc;
    else {
        entry = {arc:0};
        srcNode.links.set(dstNode, entry);
        return entry;
    }
};

LinkedBoxes.prototype.unlinkNodes = function(srcNode, dstNode) {
    entry = srcNode.links.get(dstNode);
    if(entry > 1)
        --entry.arc;
    else {
        if(entry.link)
            this.layoutEngine._links.splice(this.layoutEngine._links.indexOf(entry.link), 1);
        srcNode.links.delete(dstNode);
    }
};

LinkedBoxes.prototype.hasCircleAtIndex = function(node, index) {
    if(index < 0)
        return node.leftSide[-index-1] != undefined;
    else if(index > 0)
        return node.rightSide[index-1] != undefined;
    else
        return node.circle != undefined;
};

LinkedBoxes.prototype.getCircleAtIndex = function(node, index) {
    if(index < 0)
        return node.leftSide[-index-1].circle;
    else if(index > 0)
        return node.rightSide[index-1].circle;
    else
        return node.circle;
};

LinkedBoxes.prototype.getIndexOfCircle = function(node, circle) {
    if(node.circle == circle)
        return 0;
    for(var i = 0; i < node.leftSide.length; ++i)
        if(node.leftSide[i].circle == circle)
            return -i-1;
    for(var i = 0; i < node.rightSide.length; ++i)
        if(node.rightSide[i].circle == circle)
            return i+1;
    return undefined;
};

LinkedBoxes.prototype.initializeLink = function(link) {
    if(link.srcCircle.links.has(link.dstNode))
        return undefined;
    link.srcCircle.links.set(link.dstNode, link);
    link.dstCircle.links.set(link.srcNode, link);
    link.path = this.createElement('path', this.svg);
    link.path.classList.add('link');
    if(link.srcNode != link.dstNode) {
        entry = this.linkNodes(link.srcNode, link.dstNode);
        this.linkNodes(link.dstNode, link.srcNode);
        if(entry) {
            entry.link = {source:link.srcNode, target:link.dstNode};
            this.layoutEngine._links.push(entry.link);
        }
    }
    this.links.push(link);
    this.dirtyFlag = true;
    return link;
};

LinkedBoxes.prototype.delete = function(element) {
    element.deathFlag = true;
    this.dirtyFlag = true;
};

LinkedBoxes.prototype.createLinkHelper = function(srcNode, dstNode, srcIndex, dstIndex) {
    link = {};
    link.srcNode = srcNode;
    link.dstNode = dstNode;
    link.srcCircle = this.getCircleAtIndex(link.srcNode, srcIndex);
    link.dstCircle = this.getCircleAtIndex(link.dstNode, dstIndex);
    return this.initializeLink(link);
};

LinkedBoxes.prototype.syncGraph = function() {
    if(!this.dirtyFlag)
        return;
    this.dirtyFlag = false;
    this.layoutEngine.start();
};

LinkedBoxes.prototype.setCursorCircle = function(circle) {
    if(this.cursorCircle)
        this.cursorCircle.classList.remove('cursor');
    this.cursorCircle = circle;
    if(circle)
        this.cursorCircle.classList.add('cursor');
};

LinkedBoxes.prototype.setCursorIndex = function(index) {
    if(!this.cursorNode || !this.hasCircleAtIndex(this.cursorNode, index))
        return false;
    this.setCursorCircle(this.getCircleAtIndex(this.cursorNode, index));
    return true;
};

LinkedBoxes.prototype.cursorFollowLink = function() {
    if(!this.cursorNode || this.cursorCircle.links.size != 1)
        return false;
    link = this.cursorCircle.links.values().next().value;
    this.cursorNode = (this.cursorNode == link.srcNode) ? link.dstNode : link.srcNode;
    this.setCursorCircle((this.cursorCircle == link.srcCircle) ? link.dstCircle : link.srcCircle);
    return true;
};
