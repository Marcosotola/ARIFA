import fs from 'fs';

const content = fs.readFileSync('src/app/admin/planillas/extincion/[id]/page.tsx', 'utf8');
const openTags = content.match(/<div/g) || [];
const closeTags = content.match(/<\/div>/g) || [];

console.log(`Open: ${openTags.length}, Close: ${closeTags.length}`);

const stack = [];
const lines = content.split('\n');
lines.forEach((line, i) => {
  const matches = line.match(/<\/?div/g) || [];
  matches.forEach(m => {
    if (m === '<div') stack.push(i + 1);
    else if (m === '</div>') {
      if (stack.length === 0) console.log(`Unmatched close at line ${i + 1}`);
      else stack.pop();
    }
  });
});

if (stack.length > 0) {
  console.log(`Unclosed divs at lines: ${stack.join(', ')}`);
}
