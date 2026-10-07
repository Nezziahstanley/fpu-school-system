'use strict';
const r = require('./routes');
console.log('=== TOP-LEVEL LAYERS ===');
console.log('Layer count:', r.stack.length);
console.log('');
r.stack.forEach(function (l, i) {
  const name = l.name || '(anonymous)';
  let path = '';
  try {
    path = l.regexp ? l.regexp.toString() : '';
  } catch (e) { /* ignore */ }
  console.log(i + '. [' + name + '] ' + path);
});