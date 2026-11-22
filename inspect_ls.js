const fs = require('fs');
const code = fs.readFileSync('C:/Users/ntuth/.gemini/antigravity/scratch/app.js', 'utf8');

const lines = code.split('\n');
const lsLines = [];
lines.forEach((l, i) => {
  if (l.includes('localStorage.')) {
    lsLines.push({ line: i + 1, text: l.trim() });
  }
});

console.log('Total localStorage lines:', lsLines.length);
lsLines.forEach(item => {
  console.log(`L${item.line}: ${item.text}`);
});
