'use strict';

const documentElement = document.documentElement;
var _autoScrollingInterval; // reference to auto scrolling
// A simple requestAnimationFrame polyfill
var raf = window.requestAnimationFrame || function(callback){ return setTimeout(callback, 1000 / 60); };
var caf = window.cancelAnimationFrame || function(cafID){ clearTimeout(cafID); };

class Dragula extends EventTarget {
  constructor (initialContainers, options) {

  super();
  var len = arguments.length;
  if (len === 1 && Array.isArray(initialContainers) === false) {
    [options, initialContainers] = [initialContainers, []];
  }

  var o = this.options = Object.assign({}, Dragula.defaultOptions, options);
  this.containers = o.containers = o.containers || initialContainers || [];

  if (typeof o.copy !== 'function') {
    let copy = o.copy;
    o.copy = _ => copy;
  }

  this.dragging = false;

  var _mirror; // mirror image
  var _source; // source container
  var _item; // item being dragged
  var _offsetX; // reference x
  var _offsetY; // reference y
  var _moveX; // reference move x
  var _moveY; // reference move y
  var _initialSibling; // reference sibling when grabbed
  var _currentSibling; // reference sibling now
  var _copy; // item used for copying
  var _renderTimer; // timer for setTimeout renderMirrorImage
  var _lastDropTarget = null; // last container item was over
  var _grabbed; // holds pointerdown context until first pointermove
  var _isHover; // is hovering on folder

  let drake = this;

  if (this.options.removeOnSpill === true) {
    this.on('over', spillOver).on('out', spillOut);
  }

  documentElement.addEventListener('pointerdown', grab);
  documentElement.addEventListener('pointerup', release);

  Object.assign(this, {
    start: manualStart,
    end: end,
    cancel: cancel,
    remove: remove,
    destroy: destroy,
    canMove: canMove
  });

  function isContainer (el) {
    return drake.containers.includes(el) || drake.options.isContainer(el);
  }

  function eventualMovements (remove) {
    var op = remove ? 'remove' : 'add';
    documentElement[op + 'EventListener']('pointermove', startBecauseMouseMoved);
  }

  function movements (remove) {
    var op = remove ? 'remove' : 'add';
    documentElement[op + 'EventListener']('click', preventGrabbed);
  }

  function destroy () {
    documentElement.removeEventListener('pointerdown', grab);
    documentElement.removeEventListener('pointerup', release);
    release({});
  }

  function preventGrabbed (e) {
    if (_grabbed) {
      e.preventDefault();
    }
  }

  function grab (e) {
    _moveX = e.clientX;
    _moveY = e.clientY;

    var ignore = whichMouseButton(e) !== 1 || e.metaKey || e.ctrlKey;
    if (ignore) {
      return; // we only care about honest-to-god left clicks and touch events
    }
    var item = e.target;
    var context = canStart(item);
    if (!context) {
      return;
    }
    _grabbed = context;
    eventualMovements();
    if (e.type === 'pointerdown') {
      if (isInput(item)) { // see also: https://github.com/bevacqua/dragula/issues/208
        item.focus(); // fixes https://github.com/bevacqua/dragula/issues/176
      } else {
        e.preventDefault(); // fixes https://github.com/bevacqua/dragula/issues/155
      }
    }
  }

  function startBecauseMouseMoved (e) {
    if (!_grabbed) {
      return;
    }
    if (whichMouseButton(e) === 0) {
      release({});
      return; // when text is selected on an input and then dragged, pointerup doesn't fire. this is our only hope
    }

    // truthy check fixes #239, equality fixes #207, fixes #501
    if ((e.clientX !== void 0 && Math.abs(e.clientX - _moveX) <= (drake.options.slideFactorX || 0)) &&
      (e.clientY !== void 0 && Math.abs(e.clientY - _moveY) <= (drake.options.slideFactorY || 0))) {
      return;
    }

    if (drake.options.ignoreInputTextSelection) {
      var clientX = e.clientX || 0;
      var clientY = e.clientY || 0;
      var elementBehindCursor = document.elementFromPoint(clientX, clientY);

      if (isInput(elementBehindCursor)) {
        return;
      }
    }

    var grabbed = _grabbed; // call to end() unsets _grabbed
    eventualMovements(true);
    movements();
    end();
    start(grabbed);

    var offset = getOffset(_item);
    _offsetX = e.pageX - offset.left;
    _offsetY = e.pageY - offset.top;

    var inTransit = _copy || _item;
    if (inTransit) {
      inTransit.classList.add('gu-transit');
    }
    renderMirrorImage();
    drag(e);
  }

  function canStart (item) {
    if (drake.dragging && _mirror) {
      return;
    }
    if (isContainer(item)) {
      return; // don't drag container itself
    }
    var handle = item;
    while (getParent(item) && isContainer(getParent(item)) === false) {
      if (drake.options.invalid(item, handle)) {
        return;
      }
      item = getParent(item); // drag target should be a top element
      if (!item) {
        return;
      }
    }
    var source = getParent(item);
    if (!source) {
      return;
    }
    if (drake.options.invalid(item, handle)) {
      return;
    }

    var movable = drake.options.moves(item, source, handle, item.nextElementSibling);
    if (!movable) {
      return;
    }

    return {
      item: item,
      source: source
    };
  }

  function canMove (item) {
    return !!canStart(item);
  }

  function manualStart (item) {
    var context = canStart(item);
    if (context) {
      start(context);
    }
  }

  function start (context) {
    if (o.copy(context.item, context.source)) {
      _copy = context.item.cloneNode(true);
      drake.emit('cloned', {
        clone: _copy,
        original: context.item,
        type: 'copy'
      });
    }

    _source = context.source;
    _item = context.item;
    _initialSibling = _currentSibling = context.item.nextElementSibling;

    drake.dragging = true;
    drake.emit('drag', {
      element: _item,
      source: _source
    });
  }



  function end () {
    if (!drake.dragging) {
      caf(_autoScrollingInterval);
      return;
    }
    var item = _copy || _item;
    drop(item, getParent(item));
  }

  function ungrab () {
    _grabbed = false;
    eventualMovements(true);
    movements(true);
  }

  function release (e) {
    ungrab();

    if (!drake.dragging) {
      return;
    }
    var item = _copy || _item;
    var clientX = e.clientX || 0;
    var clientY = e.clientY || 0;
    var elementBehindCursor = getElementBehindPoint(_mirror, clientX, clientY);
    var dropTarget = findDropTarget(elementBehindCursor, clientX, clientY);

    if (dropTarget && ((_copy && drake.options.copySortSource) || (!_copy || dropTarget !== _source))) {
      drop(item, dropTarget);
    }
    else if (drake.options.removeOnSpill) {
      remove();
    }
    else {
      cancel();
    }
  }

  function drop (item, target) {
    if (_copy && drake.options.copySortSource && target === _source) {
      _item.remove();
    }

    if (isInitialPlacement(target) && !_isHover) {
      drake.emit('cancel', {
        element: item,
        container: _source,
        source: _source
      });
    }
    else {
      drake.emit('drop', {
        element: item,
        target,
        source: _source,
        sibling: _currentSibling,
        isHover: _isHover
      });
    }

    cleanup();
  }

  function remove () {
    if (!drake.dragging) {
      return;
    }
    var item = _copy || _item;
    var parent = getParent(item);
    if (parent) {
      item.remove();
    }

    drake.emit(_copy ? 'cancel' : 'remove', {
      element: item,
      container: parent,
      source: _source
    });
    cleanup();
  }

  function cancel (revert) {
    if (!drake.dragging) {
      return;
    }
    var reverts = arguments.length > 0 ? revert : drake.options.revertOnSpill;
    var item = _copy || _item;
    var parent = getParent(item);
    var initial = isInitialPlacement(parent);
    if (initial === false && reverts) {
      if (_copy) {
        if (parent) {
          _copy.remove();
        }
      } else {
        _source.insertBefore(item, _initialSibling);
      }
    }

    if (initial || reverts) {
      drake.emit('cancel', {
        element: item,
        container: _source,
        source: _source
      });
    }
    else {
      drake.emit('drop', {
        element: item,
        target: parent,
        source: _source,
        sibling: _currentSibling
      });
    }

    cleanup();
  }

  function cleanup () {
    var item = _copy || _item;
    caf(_autoScrollingInterval);
    ungrab();
    removeMirrorImage();
    if (item) {
      item.classList.remove('gu-transit');
      if (_isHover) {
        _currentSibling.classList.remove('gu-drop-overlay');
        item.remove();
      }
    }
    if (_renderTimer) {
      clearTimeout(_renderTimer);
    }
    drake.dragging = false;
    if (_lastDropTarget) {
      drake.emit('out', {
        element: item,
        container: _lastDropTarget,
        source: _source
      });
    }
    drake.emit('dragend', { element: item });
    _source = _item = _copy = _initialSibling = _currentSibling = _renderTimer = _lastDropTarget = null;
  }

  function isInitialPlacement (target, s) {
    var sibling;
    if (s !== void 0) {
      sibling = s;
    } else if (_mirror) {
      sibling = _currentSibling;
    } else {
      sibling = (_copy || _item).nextElementSibling;
    }
    return target === _source && sibling === _initialSibling;
  }

  function findDropTarget (elementBehindCursor, clientX, clientY) {
    var target = elementBehindCursor;
    while (target && !accepted()) {
      target = getParent(target);
    }
    return target;

    function accepted () {
      var droppable = isContainer(target);
      if (droppable === false) {
        return false;
      }

      var immediate = getImmediateChild(target, elementBehindCursor);
      var reference = getReference(target, immediate, clientX, clientY, drake.options.direction);
      var initial = isInitialPlacement(target, reference);
      if (initial) {
        return true; // should always be able to drop it right back where it was
      }
      return drake.options.accepts(_item, target, _source, reference);
    }
  }

  function drag (e) {
    if (!_mirror) {
      return;
    }
    e.preventDefault();

    var clientX = e.clientX || 0;
    var clientY = e.clientY || 0;
    var x = clientX - _offsetX;
    var y = clientY - _offsetY;

    _mirror.style.left = x + 'px';
    _mirror.style.top = y + 'px';

    var item = _copy || _item;
    var elementBehindCursor = getElementBehindPoint(_mirror, clientX, clientY);
    var dropTarget = findDropTarget(elementBehindCursor, clientX, clientY);
    var changed = dropTarget !== null && dropTarget !== _lastDropTarget;
    if (changed || dropTarget === null) {
      out();
      _lastDropTarget = dropTarget;
      over();
    }
    var parent = getParent(item);
    if (dropTarget === _source && _copy && !drake.options.copySortSource) {
      if (parent) {
        item.remove();
      }
      return;
    }
    var reference;
    var immediate = getImmediateChild(dropTarget, elementBehindCursor);
    if (immediate !== null) {
      reference = getReference(dropTarget, immediate, clientX, clientY, drake.options.direction);
    } else if (drake.options.revertOnSpill === true && !_copy) {
      reference = _initialSibling;
      dropTarget = _source;
    } else {
      if (_copy && parent) {
        item.remove();
      }
      return;
    }
    if (
      (reference === null && changed) ||
      reference !== item &&
      (reference !== item.nextElementSibling || isFolder(reference))
    ) {
      // console.log(reference)
      if (isFolder(reference) && isHover(reference)) {
        reference.classList.add('gu-drop-overlay');
        _isHover = true;
      } else {
        _currentSibling && _currentSibling.classList.remove('gu-drop-overlay');
        dropTarget.insertBefore(item, reference);
        drake.emit('shadow', {
          element: item,
          container: dropTarget,
          source: _source
        });
        _isHover = false;
      }
      _currentSibling = reference;
    }

    startScroll(_item, e, o);

    function moved (type) {
      drake.emit(type, {
        element: item,
        container: _lastDropTarget,
        source: _source
      });
    }
    function over () { if (changed) { moved('over'); } }
    function out () { if (_lastDropTarget) { moved('out'); } }
    // hover moves to the directory
    function isFolder(el) { return el ? el.querySelector(o.folderCss) !== null : false; }
    function isHover(el) {
      var siblingEle = el.previousElementSibling || el.nextElementSibling || el;
      var horizontal = siblingEle.offsetTop === el.offsetTop;
      var rect = el.getBoundingClientRect();
      if (horizontal) {
        return (clientX > rect.left + rect.width / 4) && (clientX < rect.left + rect.width * 3 / 4);
      }
      return (clientY > rect.top + rect.height / 4) && (clientY < rect.top + rect.height * 3 / 4);
    }

    function getScrollContainer(node) {
      if (node === null) { return null; }
      // NOTE: Manually calculating height because IE's `clientHeight` isn't always
      // reliable.
      var nodeOuterHeight = parseFloat(window.getComputedStyle(node).getPropertyValue('height')) +
        parseFloat(window.getComputedStyle(node).getPropertyValue('padding-top')) +
        parseFloat(window.getComputedStyle(node).getPropertyValue('padding-bottom'));
      if (node.scrollHeight > Math.ceil(nodeOuterHeight)) { return node; }

      var REGEX_BODY_HTML = new RegExp('(body|html)', 'i');

      if (!REGEX_BODY_HTML.test(node.parentNode.tagName)) { return getScrollContainer(node.parentNode); }

      return null;
    }

    function startAutoScrolling(node, amount, direction) {
      _autoScrollingInterval = raf(function() {
        if (!drake.dragging) {
          return;
        }
        startAutoScrolling(node, amount, direction);
      });

      return node[direction] += (amount * 0.25);
    }

    function startScroll(item, event, options) {
      var scrollingElement = null;
      var scrollEdge = options.scrollEdge;
      var scrollSpeed = 20;
      var scrollContainer = getScrollContainer(item);
      var pageX = null;
      var pageY = null;

      if (event.touches) {
        pageX = event.touches[0].pageX;
        pageY = event.touches[0].pageY;
      } else {
        pageX = event.pageX;
        pageY = event.pageY;
      }

      caf(_autoScrollingInterval);

      // If a container contains the list that is scrollable
      if (scrollContainer) {

        // Scrolling vertically
        if (pageY - getOffset(scrollContainer).top < scrollEdge) {
          startAutoScrolling(scrollContainer, -scrollSpeed, 'scrollTop');
        } else if ((getOffset(scrollContainer).top + scrollContainer.getBoundingClientRect().height) - pageY < scrollEdge) {
          startAutoScrolling(scrollContainer, scrollSpeed, 'scrollTop');
        }

        // Scrolling horizontally
        if (pageX - scrollContainer.getBoundingClientRect().left < scrollEdge) {
          startAutoScrolling(scrollContainer, -scrollSpeed, 'scrollLeft');
        } else if ((getOffset(scrollContainer).left + scrollContainer.getBoundingClientRect().width) - pageX < scrollEdge) {
          startAutoScrolling(scrollContainer, scrollSpeed, 'scrollLeft');
        }

      // If the window contains the list
      } else {
        scrollingElement = document.scrollingElement || document.documentElement || document.body;

        // Scrolling vertically
        // NOTE: Using `window.pageYOffset` here because IE doesn't have `window.scrollY`.
        if ((pageY - window.pageYOffset) < scrollEdge) {
          startAutoScrolling(scrollingElement, -scrollSpeed, 'scrollTop');
        } else if ((window.innerHeight - (pageY - window.pageYOffset)) < scrollEdge) {
          startAutoScrolling(scrollingElement, scrollSpeed, 'scrollTop');
        }

        // Scrolling horizontally
        // NOTE: Using `window.pageXOffset` here because IE doesn't have `window.scrollX`.
        if ((pageX - window.pageXOffset) < scrollEdge) {
          startAutoScrolling(scrollingElement, -scrollSpeed, 'scrollLeft');
        } else if ((window.innerWidth - (pageX - window.pageXOffset)) < scrollEdge) {
          startAutoScrolling(scrollingElement, scrollSpeed, 'scrollLeft');
        }
      }
    }
  }

  function spillOver (el) {
    el && el.classList.remove('gu-hide');
  }

  function spillOut (el) {
    if (drake.dragging) {
      el && el.classList.add('gu-hide');
    }
  }

  function renderMirrorImage () {
    if (_mirror) {
      return;
    }
    var rect = _item.getBoundingClientRect();
    _mirror = _item.cloneNode(true);
    _mirror.style.width = rect.width + 'px';
    _mirror.style.height = rect.height + 'px';

    _mirror.classList.remove('gu-transit');
    _mirror.classList.add('gu-mirror');

    drake.options.mirrorContainer.appendChild(_mirror);
    documentElement.addEventListener('pointermove', drag);
    drake.options.mirrorContainer.classList.add('gu-unselectable');
    drake.emit('cloned', {
      clone: _mirror,
      original: _item,
      type: 'mirror'
    });
  }

  function removeMirrorImage () {
    if (_mirror) {
      drake.options.mirrorContainer.classList.remove('gu-unselectable');
      documentElement.removeEventListener('pointermove', drag);
      _mirror.remove();
      _mirror = null;
    }
  }




} // End constructor

  on (eventType, callback) {
    this.addEventListener(eventType, evt => {
      callback.call(this, ...Object.values(evt.detail));
    });

    return this;
  }

  off (eventType, callback) {
    this.removeEventListener(eventType, callback);

    return this;
  }

  emit (eventType, detail, ...args) {
    if (detail instanceof Node) {
      // Old syntax with positional arguments
      detail = [detail, ...args];
    }
    let evt = new CustomEvent(eventType, { detail });
    this.dispatchEvent(evt);
    return this;
  }

  static defaultOptions = {
    moves: _ => true,
    accepts: _ => true,
    invalid: _ => false,
    isContainer: _ => false,
    copy: false,
    copySortSource: false,
    revertOnSpill: false,
    removeOnSpill: false,
    direction: 'vertical',
    ignoreInputTextSelection: true,
    mirrorContainer: document.body,
    folderCss: '[type=folder]',
    scrollEdge: 36
  }
}

export default function dragula (...args) {
  return new Dragula(...args);
}

function getImmediateChild (dropTarget, target) {
  var immediate = target;
  while (immediate !== dropTarget && getParent(immediate) !== dropTarget) {
    immediate = getParent(immediate);
  }
  if (immediate === documentElement) {
    return null;
  }
  return immediate;
}

function getReference (dropTarget, target, x, y, direction) {
  var horizontal = direction === 'horizontal';
  var reference = target !== dropTarget ? inside() : outside();
  return reference;

  function outside () { // slower, but able to figure out any position
    var len = dropTarget.children.length;
    var i;
    var el;
    var rect;
    for (i = 0; i < len; i++) {
      el = dropTarget.children[i];
      rect = el.getBoundingClientRect();
      if (horizontal && (rect.left + rect.width / 2) > x) { return el; }
      if (!horizontal && (rect.top + rect.height / 2) > y) { return el; }
    }
    return null;
  }

  function inside () { // faster, but only available if dropped inside a child element
    var rect = target.getBoundingClientRect();
    if (horizontal) {
      return resolve(x > rect.left + rect.width / 2);
    }
    return resolve(y > rect.top + rect.height / 2);
  }

  function resolve (after) {
    return after ? target.nextElementSibling : target;
  }
}

function whichMouseButton (e) {
  if (e.touches !== void 0) { return e.touches.length; }
  if (e.which !== void 0 && e.which !== 0) { return e.which; } // see https://github.com/bevacqua/dragula/issues/261
  if (e.buttons !== void 0) { return e.buttons; }
  var button = e.button;
  if (button !== void 0) { // see https://github.com/jquery/jquery/blob/99e8ff1baa7ae341e94bb89c3e84570c7c3ad9ea/src/event.js#L573-L575
    return button & 1 ? 1 : button & 2 ? 3 : (button & 4 ? 2 : 0);
  }
}

function getOffset (el) {
  var rect = el.getBoundingClientRect();
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY
  };
}

function getElementBehindPoint (point, x, y) {
  point = point || {};
  var state = point.className || '';
  var el;
  point.className += ' gu-hide';
  el = document.elementFromPoint(x, y);
  point.className = state;
  return el;
}

function getParent (el) { return el.parentNode === document ? null : el.parentNode; }
function isInput (el) { return el?.matches("input, select, textarea") || isEditable(el); }
function isEditable (el) {
  if (!el) { return false; } // no parents were editable
  if (el.contentEditable === 'false') { return false; } // stop the lookup
  if (el.contentEditable === 'true') { return true; } // found a contentEditable element in the chain
  return isEditable(getParent(el)); // contentEditable is set to 'inherit'
}