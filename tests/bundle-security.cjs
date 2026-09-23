const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');

const roots = [{ path: '.next/static', publicArtifact: true }, { path: '.next/server', publicArtifact: false }];
const forbiddenText = [['SUPABASE', 'SECRET', 'KEY'].join('_'), 'NEXT_PUBLIC_SUPABASE'];
const serverOnlyNames = ['DATABASE_ADMIN_KEY'];
const secretKeyPattern = /sb_secret_[A-Za-z0-9_-]{20,}/g;
const hits = [];

function scan(path, publicArtifact) {
  for (const name of readdirSync(path)) {
    const entry = join(path, name);
    if (statSync(entry).isDirectory()) scan(entry, publicArtifact);
    else {
      const content = readFileSync(entry, 'utf8');
      for (const marker of forbiddenText) if (content.includes(marker)) hits.push(`${entry}: ${marker}`);
      if (publicArtifact) for (const marker of serverOnlyNames) if (content.includes(marker)) hits.push(`${entry}: server-only environment name`);
      if (secretKeyPattern.test(content)) hits.push(`${entry}: secret-key value`);
      secretKeyPattern.lastIndex = 0;
    }
  }
}

for (const root of roots) scan(root.path, root.publicArtifact);
if (hits.length) {
  console.error(`Production build contains a secret value or forbidden client environment name:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('Production build contains no Supabase secret-key values or forbidden client environment names.');
