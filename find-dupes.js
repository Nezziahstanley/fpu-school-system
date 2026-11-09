const fs = require('fs');
const code = fs.readFileSync('./public/js/admin.js', 'utf8');
const lines = code.split('\n');
const functions = {};

lines.forEach((line, index) => {
  // Match "async function name(" or "function name("
  const match = line.match(/^\s*(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/);
  if (match) {
    const name = match[1];
    if (!functions[name]) functions[name] = [];
    functions[name].push(index + 1); // 1-based line number
  }
});

console.log('--- DUPLICATE FUNCTIONS ---');
let found = false;
Object.keys(functions).forEach(name => {
  if (functions[name].length > 1) {
    found = true;
    console.log(`❌ ${name} is declared ${functions[name].length} times at lines: ${functions[name].join(', ')}`);
  }
});

if (!found) console.log('✅ No duplicate function declarations found.');