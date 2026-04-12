import { readFileSync } from 'fs';
const html = readFileSync('BestDashBoard.html', 'utf8');
const lines = html.split('\n');
[884,890,898,924].forEach(idx => {
  const line = lines[idx];
  const m = line.match(/icon-badge \w+">([\s\S]+?)<\/span>/);
  if (m) {
    const chars = [...m[1]];
    const hex = chars.map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase());
    console.log(`Line ${idx+1}: hex=${Buffer.from(m[1]).toString('hex')} codepoints=${hex.join(' ')}`);
  }
});
