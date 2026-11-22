const fs = require('fs');

const appJs = fs.readFileSync('C:/Users/ntuth/.gemini/antigravity/scratch/app.js', 'utf8');
const lines = appJs.split('\n');
console.log('Total lines in app.js:', lines.length);

const occurrences = [];
lines.forEach((line, i) => {
  if (line.includes('localStorage')) {
    occurrences.push({ line: i + 1, content: line.trim() });
  }
});

console.log('Occurrences of localStorage:', occurrences.length);
occurrences.forEach(o => console.log(`${o.line}: ${o.content}`));
