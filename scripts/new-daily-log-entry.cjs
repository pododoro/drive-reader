const fs = require('fs');
const path = require('path');

const logPath = path.resolve(__dirname, '..', 'docs', 'daily-log.md');

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function main() {
  if (!fs.existsSync(logPath)) {
    console.error(`Missing daily log: ${logPath}`);
    process.exit(1);
  }

  const date = todayKst();
  const marker = `### ${date}`;
  const content = fs.readFileSync(logPath, 'utf8');

  if (content.includes(marker)) {
    console.log(`Daily log entry already exists for ${date}`);
    return;
  }

  const entry = [
    '',
    marker,
    '',
    '- Context: ',
    '- Done: ',
    '- Verified: ',
    '- Blocked: ',
    '- Next: ',
    '',
  ].join('\n');

  const updated = `${content.trimEnd()}${entry}`;
  fs.writeFileSync(logPath, `${updated}\n`, 'utf8');
  console.log(`Added daily log entry for ${date}`);
}

main();
