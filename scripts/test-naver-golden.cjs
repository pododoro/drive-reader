const fs = require('fs');
const path = require('path');

const referenceDir = path.resolve(__dirname, '..', '..', 'reference');

function normalize(text) {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function diffLines(actual, expected) {
  const actualLines = normalize(actual).split('\n');
  const expectedLines = normalize(expected).split('\n');
  const max = Math.max(actualLines.length, expectedLines.length);

  for (let i = 0; i < max; i += 1) {
    const a = actualLines[i] ?? '';
    const e = expectedLines[i] ?? '';
    if (a !== e) {
      return {
        line: i + 1,
        actual: a,
        expected: e,
      };
    }
  }

  return null;
}

function main() {
  if (!fs.existsSync(referenceDir)) {
    console.error(`Missing reference directory: ${referenceDir}`);
    process.exit(1);
  }

  const rawFiles = fs
    .readdirSync(referenceDir)
    .filter((name) => name.endsWith('.raw.txt'))
    .sort((a, b) => a.localeCompare(b, 'ko'));

  if (rawFiles.length === 0) {
    console.log('No *.raw.txt fixtures found under reference/.');
    console.log('Create pairs like:');
    console.log('  example.raw.txt');
    console.log('  example.expected.txt');
    process.exit(0);
  }

  let failed = false;

  for (const rawFile of rawFiles) {
    const baseName = rawFile.slice(0, -'.raw.txt'.length);
    const expectedFile = `${baseName}.expected.txt`;
    const rawPath = path.join(referenceDir, rawFile);
    const expectedPath = path.join(referenceDir, expectedFile);

    if (!fs.existsSync(expectedPath)) {
      console.warn(`Skipping ${rawFile}: missing ${expectedFile}`);
      continue;
    }

    const actual = fs.readFileSync(rawPath, 'utf8');
    const expected = fs.readFileSync(expectedPath, 'utf8');
    const mismatch = diffLines(actual, expected);

    if (mismatch) {
      failed = true;
      console.error(`Mismatch: ${rawFile}`);
      console.error(`  line ${mismatch.line}`);
      console.error(`  actual  : ${mismatch.actual}`);
      console.error(`  expected: ${mismatch.expected}`);
    } else {
      console.log(`PASS ${rawFile}`);
    }
  }

  if (failed) {
    process.exit(1);
  }
}

main();
