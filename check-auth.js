require('dotenv').config();
const fs = require('fs');

const authContent = fs.readFileSync('./middleware/auth.js', 'utf8');
console.log('=== middleware/auth.js ===');
console.log(authContent);