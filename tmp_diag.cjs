const fs = require('fs');

function analyze(file, label) {
  console.log(`\n========== ${label} ==========`);
  const s = fs.readFileSync(file, 'utf8');
  let data;
  try {
    data = JSON.parse(s);
  } catch (e) {
    console.log('JSON INVALID:', e.message);
    console.log('length:', s.length);
    return;
  }
  console.log('JSON valid. root keys:', Object.keys(data).join(', '));
  const rules = data.rules;
  if (rules) {
    console.log('rules keys:', Object.keys(rules).join(', '));
    // Check if comment_likes is inside rules
    console.log('is comment_likes inside rules?', Object.prototype.hasOwnProperty.call(rules, 'comment_likes'));
    console.log('is discussion_likes inside rules?', Object.prototype.hasOwnProperty.call(rules, 'discussion_likes'));
    console.log('is notifications inside rules?', Object.prototype.hasOwnProperty.call(rules, 'notifications'));
    console.log('is blocked_users inside rules?', Object.prototype.hasOwnProperty.call(rules, 'blocked_users'));
    console.log('is presence inside rules?', Object.prototype.hasOwnProperty.call(rules, 'presence'));
    console.log('is typing inside rules?', Object.prototype.hasOwnProperty.call(rules, 'typing'));
  }
}

analyze('src/firebase/realtime-rules.json', 'realtime-rules.json (deployed)');
analyze('src/firebase/realtime-rules-new.json', 'realtime-rules-new.json (reference)');

