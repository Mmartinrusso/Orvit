const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync(path.join(__dirname, '..', 'ts-errors-full.txt'), 'utf8').split('\n');

const dirCounter = {};
const errorTypeCounter = {};
const fileCounter = {};

for (const line of lines) {
  if (!line.includes('error TS')) continue;
  const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+):/);
  if (!match) continue;

  const filepath = match[1].replace(/\\/g, '/');
  const errorCode = match[4];

  const parts = filepath.split('/');
  const twoLevel = parts.length >= 2 ? parts[0] + '/' + parts[1] : parts[0];

  dirCounter[twoLevel] = (dirCounter[twoLevel] || 0) + 1;
  errorTypeCounter[errorCode] = (errorTypeCounter[errorCode] || 0) + 1;
  fileCounter[filepath] = (fileCounter[filepath] || 0) + 1;
}

console.log('=== ERRORS BY DIRECTORY (top 30) ===');
Object.entries(dirCounter).sort((a,b) => b[1]-a[1]).slice(0,30).forEach(([k,v]) => console.log('  ' + String(v).padStart(5) + '  ' + k));

console.log('');
console.log('=== ERRORS BY TYPE (top 20) ===');
Object.entries(errorTypeCounter).sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([k,v]) => console.log('  ' + String(v).padStart(5) + '  ' + k));

console.log('');
console.log('=== FILES WITH MOST ERRORS (top 20) ===');
Object.entries(fileCounter).sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([k,v]) => console.log('  ' + String(v).padStart(5) + '  ' + k));

const total = Object.values(errorTypeCounter).reduce((a,b) => a+b, 0);
console.log('');
console.log('Total errors: ' + total);
console.log('Total files: ' + Object.keys(fileCounter).length);
