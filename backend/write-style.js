const fs = require('fs');
const css = fs.readFileSync('new-style.txt', 'utf8');
fs.writeFileSync('public/css/style.css', css);
console.log('Written:', fs.statSync('public/css/style.css').size, 'bytes');
