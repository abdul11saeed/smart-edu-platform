const fs = require('fs');

const target = 'src/firebase/realtime-rules.json';

// 1) Restore from the known full reference file
fs.copyFileSync('src/firebase/realtime-rules-new.json', target);

// 2) Read and fix: remove the extra '}' so comment_likes is a sibling of discussion_likes under rules
let s = fs.readFileSync(target, 'utf8');

const bad = '$userId"}}}},"comment_likes"';
const good = '$userId"}}},"comment_likes"';

if (!s.includes(bad)) {
  console.log('ERROR: expected pattern not found in file');
  process.exit(1);
}

// Replace ALL occurrences (there should be only one we care about, but be safe & precise)
s = s.split(bad).join(good);

// 3) Validate JSON
let ok = false;
try { JSON.parse(s); ok = true; } catch (e) { console.log('JSON INVALID:', e.message); }
console.log('JSON valid:', ok);

// 4) Brace balance
const opens = (s.match(/\{/g) || []).length;
const closes = (s.match(/\}/g) || []).length;
console.log('opens =', opens, ' closes =', closes, ' balanced =', opens === closes);

// 5) Confirm structural fix: comment_likes must be INSIDE rules
console.log('contains "},"comment_likes" after discussion_likes (sibling under rules):', s.includes('$userId"}}},"comment_likes"'));

// 6) Write back
fs.writeFileSync(target, s, 'utf8');
console.log('written OK, length =', s.length);

// 7) Show region around the fix
const idx = s.indexOf('"comment_likes"');
console.log('\nRegion: ...' + s.slice(idx - 55, idx + 15) + '...');

