import { readFileSync } from 'fs';
const html = readFileSync('BestDashBoard.html', 'utf8');
const lines = html.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('\uFFFD')) {
    const preview = line.trim().substring(0, 100);
    console.log('Line ' + (idx+1) + ': ' + preview);
  }
});
