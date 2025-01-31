'use strict';

import test, {events} from "./lib/base.js";
import dragula from "../dragula.js";

test('.start() emits "cloned" for copies', function (t) {
  var div = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div], { copy: true });
  div.appendChild(item);
  document.body.appendChild(div);
  drake.on('cloned', cloned);
  drake.start(item);
  // t.plan(3);
  function cloned (copy, original, type) {
    if (type === 'copy') {
      t.notEqual(copy, item, 'copy is not a reference to item');
      t.equal(copy.nodeType, item.nodeType, 'copy of original is provided');
      t.equal(original, item, 'original item is provided');
    }
  }
});

test('.start() emits "drag" for items', function (t) {
  var div = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div]);
  div.appendChild(item);
  document.body.appendChild(div);
  drake.on('drag', drag);
  drake.start(item);
  // t.plan(2);
  function drag (original, container) {
    t.equal(original, item, 'item is a reference to moving target');
    t.equal(container, div, 'container matches expected div');
  }
});

test('.end() emits "cancel" when not moved', function (t) {
  var div = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div]);
  div.appendChild(item);
  document.body.appendChild(div);
  drake.on('dragend', dragend);
  drake.on('cancel', cancel);
  events.raise(item, 'pointerdown', { which: 1 });
  events.raise(item, 'pointermove', { which: 1 });
  drake.end();
  // t.plan(3);
  function dragend (original) {
    t.equal(original, item, 'item is a reference to moving target');
  }
  function cancel (original, container) {
    t.equal(original, item, 'item is a reference to moving target');
    t.equal(container, div, 'container matches expected div');
  }
});

test('.end() emits "drop" when moved', function (t) {
  var div = document.createElement('div');
  var div2 = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div, div2]);
  div.appendChild(item);
  document.body.appendChild(div);
  document.body.appendChild(div2);
  drake.on('dragend', dragend);
  drake.on('drop', drop);
  events.raise(item, 'pointerdown', { which: 1 });
  events.raise(item, 'pointermove', { which: 1 });
  div2.appendChild(item);
  drake.end();
  // t.plan(4);
  function dragend (original) {
    t.equal(original, item, 'item is a reference to moving target');
  }
  function drop (original, target, container) {
    t.equal(original, item, 'item is a reference to moving target');
    t.equal(target, div2, 'target matches expected div');
    t.equal(container, div, 'container matches expected div');
  }
});

test('.remove() emits "remove" for items', function (t) {
  var div = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div]);
  div.appendChild(item);
  document.body.appendChild(div);
  drake.on('dragend', dragend);
  drake.on('remove', remove);
  events.raise(item, 'pointerdown', { which: 1 });
  events.raise(item, 'pointermove', { which: 1 });
  drake.remove();
  // t.plan(3);
  function dragend (original) {
    t.equal(original, item, 'item is a reference to moving target');
  }
  function remove (original, container) {
    t.equal(original, item, 'item is a reference to moving target');
    t.equal(container, div, 'container matches expected div');
  }
});

test('.remove() emits "cancel" for copies', function (t) {
  var div = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div], { copy: true });
  div.appendChild(item);
  document.body.appendChild(div);
  drake.on('dragend', dragend);
  drake.on('cancel', cancel);
  events.raise(item, 'pointerdown', { which: 1 });
  events.raise(item, 'pointermove', { which: 1 });
  drake.remove();
  // t.plan(4);
  function dragend () {
    t.pass('dragend got invoked');
  }
  function cancel (copy, container) {
    t.notEqual(copy, item, 'copy is not a reference to item');
    t.equal(copy.nodeType, item.nodeType, 'item is a copy of item');
    t.equal(container, null, 'container matches expectation');
  }
});

test('.cancel() emits "cancel" when not moved', function (t) {
  var div = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div]);
  div.appendChild(item);
  document.body.appendChild(div);
  drake.on('dragend', dragend);
  drake.on('cancel', cancel);
  events.raise(item, 'pointerdown', { which: 1 });
  events.raise(item, 'pointermove', { which: 1 });
  drake.cancel();
  // t.plan(3);
  function dragend (original) {
    t.equal(original, item, 'item is a reference to moving target');
  }
  function cancel (original, container) {
    t.equal(original, item, 'item is a reference to moving target');
    t.equal(container, div, 'container matches expected div');
  }
});

test('.cancel() emits "drop" when not reverted', function (t) {
  var div = document.createElement('div');
  var div2 = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div]);
  div.appendChild(item);
  document.body.appendChild(div);
  document.body.appendChild(div2);
  drake.on('dragend', dragend);
  drake.on('drop', drop);
  events.raise(item, 'pointerdown', { which: 1 });
  events.raise(item, 'pointermove', { which: 1 });
  div2.appendChild(item);
  drake.cancel();
  // t.plan(4);
  function dragend (original) {
    t.equal(original, item, 'item is a reference to moving target');
  }
  function drop (original, parent, container) {
    t.equal(original, item, 'item is a reference to moving target');
    t.equal(parent, div2, 'parent matches expected div');
    t.equal(container, div, 'container matches expected div');
  }
});

test('.cancel() emits "cancel" when reverts', function (t) {
  var div = document.createElement('div');
  var div2 = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div], { revertOnSpill: true });
  div.appendChild(item);
  document.body.appendChild(div);
  document.body.appendChild(div2);
  drake.on('dragend', dragend);
  drake.on('cancel', cancel);
  events.raise(item, 'pointerdown', { which: 1 });
  events.raise(item, 'pointermove', { which: 1 });
  div2.appendChild(item);
  drake.cancel();
  // t.plan(3);
  function dragend (original) {
    t.equal(original, item, 'item is a reference to moving target');
  }
  function cancel (original, container) {
    t.equal(original, item, 'item is a reference to moving target');
    t.equal(container, div, 'container matches expected div');
  }
});

test('pointerdown emits "cloned" for mirrors', function (t) {
  var div = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div]);
  div.appendChild(item);
  document.body.appendChild(div);
  drake.on('cloned', cloned);
  events.raise(item, 'pointerdown', { which: 1 });
  events.raise(item, 'pointermove', { which: 1 });
  // t.plan(3);
  function cloned (copy, original, type) {
    if (type === 'mirror') {
      t.notEqual(copy, item, 'mirror is not a reference to item');
      t.equal(copy.nodeType, item.nodeType, 'mirror of original is provided');
      t.equal(original, item, 'original item is provided');
    }
  }
});

test('pointerdown emits "cloned" for copies', function (t) {
  var div = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div], { copy: true });
  div.appendChild(item);
  document.body.appendChild(div);
  drake.on('cloned', cloned);
  events.raise(item, 'pointerdown', { which: 1 });
  events.raise(item, 'pointermove', { which: 1 });
  // t.plan(3);
  function cloned (copy, original, type) {
    if (type === 'copy') {
      t.notEqual(copy, item, 'copy is not a reference to item');
      t.equal(copy.nodeType, item.nodeType, 'copy of original is provided');
      t.equal(original, item, 'original item is provided');
    }
  }
});

test('pointerdown emits "drag" for items', function (t) {
  var div = document.createElement('div');
  var item = document.createElement('div');
  var drake = dragula([div]);
  div.appendChild(item);
  document.body.appendChild(div);
  drake.on('drag', drag);
  events.raise(item, 'pointerdown', { which: 1 });
  events.raise(item, 'pointermove', { which: 1 });
  // t.plan(2);
  function drag (original, container) {
    t.equal(original, item, 'item is a reference to moving target');
    t.equal(container, div, 'container matches expected div');
  }
});
