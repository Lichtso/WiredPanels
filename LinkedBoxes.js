var colaLayout = cola.Layout;

function LinkedBoxes(parentElement) {
    this.layoutEngine = new colaLayout()
        .linkDistance(250)
        .size([250, 250]) // TODO
        .avoidOverlaps(true)
        .on('tick', function() {
        trash = [];
        for(var j = 0; j < this.nodes.length; ++j) {
            node = this.nodes[j];
            if(node.deathFlag) {
                this.dirtyFlag = true;
                trash.push(node.group);
                this.nodes.splice(j, 1);
                --j;
                continue;
            }
            posX = node.x-node.width/2;
            posY = node.y-node.height/2;
            node.group.setAttribute('transform', 'translate('+posX+', '+posY+')');
            if(this.headCircle)
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
                if(link.srcNode != link.dstNode) {
                    this.unlinkNodes(link.srcNode, link.dstNode);
                    this.unlinkNodes(link.dstNode, link.srcNode);
                }
                this.links.splice(j, 1);
                --j;
                continue;
            }
            if(this.hangingLinkStyle) {
                diffX = link.dstCircle.x-link.srcCircle.x;
                maxY = Math.max(link.dstCircle.y, link.srcCircle.y)+20;
                link.path.setAttribute('d', 'M'+link.srcCircle.x+','+link.srcCircle.y+'C'+(link.srcCircle.x+diffX*0.25)+','+maxY+' '+(link.srcCircle.x+diffX*0.75)+','+maxY+' '+link.dstCircle.x+','+link.dstCircle.y);
            } else {
                if(Math.abs(link.srcCircle.x-link.dstCircle.x) < Math.abs(link.srcCircle.y-link.dstCircle.y))
                    link.path.setAttribute('d', 'M'+link.srcCircle.x+','+link.srcCircle.y+'C'+link.dstCircle.x+','+link.srcCircle.y+' '+link.srcCircle.x+','+link.dstCircle.y+' '+link.dstCircle.x+','+link.dstCircle.y);
                else
                    link.path.setAttribute('d', 'M'+link.srcCircle.x+','+link.srcCircle.y+'C'+link.srcCircle.x+','+link.dstCircle.y+' '+link.dstCircle.x+','+link.srcCircle.y+' '+link.dstCircle.x+','+link.dstCircle.y);
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
    }.bind(this));
    this.nodes = this.layoutEngine._nodes;
    this.links = [];

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    parentElement.appendChild(this.svg);
    this.svg.parentNode.classList.add('LinkedBoxes');
    this.svg.parentNode.onmousemove = function(event) {
        event.stopPropagation();
        event.preventDefault();
        if(!this.nodeToDrag)
            return;
        colaLayout.drag(this.nodeToDrag, {
            x:event.pageX-this.svg.offsetLeft+this.nodeMargin/2,
            y:event.pageY-this.svg.offsetTop+this.nodeMargin/2
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
    this.svg.parentNode.onkeydown = function(event) { // TODO
        event.stopPropagation();
        event.preventDefault();
        // event.keyCode
    }.bind(this);

    svgDefs = this.createElement('defs', this.svg);
    arrowMarker = this.createElement('marker', svgDefs);
    arrowMarker.setAttribute('id', 'arrow');
    arrowMarker.setAttribute('markerWidth', 7);
    arrowMarker.setAttribute('markerHeight', 6);
    arrowMarker.setAttribute('refX', 6);
    arrowMarker.setAttribute('refY', 3);
    arrowMarker.setAttribute('orient', 'auto');
    arrowPath = this.createElement('path', arrowMarker);
    arrowPath.setAttribute('d', 'M0,1L5,3L0,5z');
};

LinkedBoxes.prototype.nodeMargin = 20;
LinkedBoxes.prototype.nodePadding = 12;
LinkedBoxes.prototype.nodeCornerRadius = 10;
LinkedBoxes.prototype.circleRadius = 5;
LinkedBoxes.prototype.fontSize = 12;
LinkedBoxes.prototype.hangingLinkStyle = true;
LinkedBoxes.prototype.headCircle = true;
LinkedBoxes.prototype.segmentLines = true;

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
            side.group.removeChild(side.group.childNodes[i*2+1]);
            side.group.removeChild(side.group.childNodes[i*2]);
            side.splice(i, 1);
            --i;
            continue;
        }

        if(!segment.circle) {
            segment.circle = this.createElement('circle', side.group);
            segment.circle.setAttribute('r', this.circleRadius);
            segment.label = this.createElement('text', side.group);
            segment.label.setAttribute('text-anchor', (isLeft) ? 'start' : 'end');
            segment.label.textContent = 'null';
        }
        posY = (i+1)*this.nodePadding*2;

        segment.circle.x = Math.round((isLeft) ? this.nodePadding : width-this.nodePadding);
        segment.circle.y = Math.round(posY+this.nodePadding);
        segment.circle.setAttribute('cx', segment.circle.x);
        segment.circle.setAttribute('cy', segment.circle.y);

        segment.label.setAttribute('x', Math.round((isLeft) ? this.nodePadding*2 : width-this.nodePadding*2));
        segment.label.setAttribute('y', Math.round(posY+this.nodePadding+this.fontSize*0.4));
    }
};

LinkedBoxes.prototype.syncNode = function(node) {
    segmentCount = Math.max(node.leftSide.length, node.rightSide.length);
    width = 200;
    height = (segmentCount+1)*this.nodePadding*2;

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
        node.rect.setAttribute('rx', this.nodeCornerRadius);
        node.rect.setAttribute('ry', this.nodeCornerRadius);

        if(this.headCircle) {
            node.circle = this.createElement('circle', node.group);
            node.circle.y = Math.round(-this.nodePadding);
            node.circle.setAttribute('cy', node.circle.y);
            node.circle.setAttribute('r', this.circleRadius);
        }

        node.label = this.createElement('text', node.group);
        node.label.setAttribute('text-anchor', 'middle');
        node.label.setAttribute('y', Math.round(this.nodePadding+this.fontSize*0.4));
        node.label.textContent = 'null';

        node.leftSide.group = this.createElement('g', node.group);
        node.rightSide.group = this.createElement('g', node.group);
        if(this.segmentLines) {
            node.lines = [];
            node.lines.group = this.createElement('g', node.group);
        }
    }

    node.rect.setAttribute('width', width);
    node.rect.setAttribute('height', height);
    halfWidth = Math.round(width/2);
    if(this.headCircle)
        node.circle.setAttribute('cx', halfWidth);
    node.label.setAttribute('x', halfWidth);

    this.syncNodeSide(width, node.leftSide, true);
    this.syncNodeSide(width, node.rightSide, false);
    if(this.segmentLines) {
        for(var i = node.lines.group.childNodes.length-1; i >= segmentCount; --i)
            node.lines.group.removeChild(node.lines.group.childNodes[i]);
        node.lines.splice(segmentCount);

        for(var i = node.lines.group.childNodes.length; i < segmentCount; ++i) {
            posY = (i+1)*this.nodePadding*2;
            node.lines[i] = this.createElement('path', node.lines.group);
            node.lines[i].setAttribute('d', 'M0,'+posY+'h'+width);
        }
    }

    node.width = width+this.nodeMargin;
    node.height = height+this.nodeMargin;
    return node;
};

LinkedBoxes.prototype.createNode = function(segementsLeft, segementsRight) {
    node = {};
    node.linksTo = new Map;
    node.leftSide = Array(segementsLeft);
    for(var i = 0; i < segementsLeft; ++i)
        node.leftSide[i] = {};
    node.rightSide = Array(segementsRight);
    for(var i = 0; i < segementsRight; ++i)
        node.rightSide[i] = {};
    this.syncNode(node);
    this.nodes.push(node);
    this.dirtyFlag = true;
    return node;
};

LinkedBoxes.prototype.linkNodes = function(srcNode, dstNode) {
    entry = srcNode.linksTo.get(dstNode);
    if(entry)
        ++entry.arc;
    else {
        entry = {arc:0};
        srcNode.linksTo.set(dstNode, entry);
        return entry;
    }
};

LinkedBoxes.prototype.unlinkNodes = function(srcNode, dstNode) {
    entry = srcNode.linksTo.get(dstNode);
    if(entry > 1)
        --entry.arc;
    else {
        if(entry.link)
            this.layoutEngine._links.splice(this.layoutEngine._links.indexOf(entry.link), 1);
        srcNode.linksTo.delete(dstNode);
    }
};

LinkedBoxes.prototype.getCircleOfNode = function(node, index) {
    if(index < 0)
        return node.leftSide[-index-1].circle;
    else if (index > 0)
        return node.rightSide[index-1].circle;
    else
        return node.circle;
};

LinkedBoxes.prototype.createLink = function(link, srcIndex, dstIndex) {
    link.srcCircle = this.getCircleOfNode(link.srcNode, srcIndex);
    link.dstCircle = this.getCircleOfNode(link.dstNode, dstIndex);
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
};

LinkedBoxes.prototype.syncGraph = function() {
    if(!this.dirtyFlag)
        return;
    this.dirtyFlag = false;
    this.layoutEngine.start();
};
