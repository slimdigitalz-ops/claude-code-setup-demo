#!/usr/bin/env node
/**
 * delivery-check — verify a Claude Code setup before it goes to a client.
 *
 *   node delivery-check.mjs [path-to-client-repo]
 *
 * Language-agnostic. Checks the things that are embarrassing to ship:
 * broken file references, commands that don't exist, leftover placeholders,
 * malformed config, and accidentally-included secrets.
 *
 * Exit code 0 = safe to deliver. 1 = do not send.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2] ?? process.cwd();
const results = [];

const ok = (check, detail = '') => results.push({ level: 'pass', check, detail });
const warn = (check, detail) => results.push({ level: 'warn', check, detail });
const fail = (check, detail) => results.push({ level: 'fail', check, detail });

const read = (p) => readFileSync(p, 'utf8');
const has = (p) => existsSync(join(root, p));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Parse the frontmatter block of a markdown file into a flat key/value map. */
function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

// ---------------------------------------------------------------- A. structure

if (!has('CLAUDE.md')) {
  fail('CLAUDE.md exists', 'missing — this is the core deliverable');
} else {
  const text = read(join(root, 'CLAUDE.md'));
  if (text.trim().length < 400) {
    warn('CLAUDE.md depth', `only ${text.trim().length} chars — likely too thin to be useful`);
  } else {
    ok('CLAUDE.md exists', `${text.trim().length} chars`);
  }
  if (!/##\s/.test(text)) {
    warn('CLAUDE.md structure', 'no section headings found');
  }
}

const settingsPath = join(root, '.claude', 'settings.json');
if (!existsSync(settingsPath)) {
  warn('.claude/settings.json', 'not present — fine if the tier does not include it');
} else {
  try {
    JSON.parse(read(settingsPath));
    ok('.claude/settings.json', 'valid JSON');
  } catch (err) {
    fail('.claude/settings.json', `invalid JSON — ${err.message}`);
  }
}

// commands
const commandsDir = join(root, '.claude', 'commands');
if (existsSync(commandsDir)) {
  const files = readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
  if (files.length === 0) {
    warn('commands', 'directory exists but is empty');
  }
  for (const file of files) {
    const fm = frontmatter(read(join(commandsDir, file)));
    if (!fm) fail(`command ${file}`, 'no frontmatter block');
    else if (!fm.description) fail(`command ${file}`, 'frontmatter has no description');
    else ok(`command ${file}`, fm.description.slice(0, 45));
  }
}

// skills
const skillsDir = join(root, '.claude', 'skills');
if (existsSync(skillsDir)) {
  for (const entry of readdirSync(skillsDir)) {
    const skillFile = join(skillsDir, entry, 'SKILL.md');
    if (!existsSync(skillFile)) {
      fail(`skill ${entry}`, 'no SKILL.md');
      continue;
    }
    const fm = frontmatter(read(skillFile));
    if (!fm) fail(`skill ${entry}`, 'no frontmatter block');
    else if (!fm.name || !fm.description) fail(`skill ${entry}`, 'frontmatter needs both name and description');
    else if (!/\buse when\b|\bwhen\b/i.test(fm.description)) {
      warn(`skill ${entry}`, 'description should say WHEN to use it, or it will not auto-load');
    } else ok(`skill ${entry}`, 'valid');
  }
}

// ------------------------------------------------------------- B. placeholders

const deliveredFiles = [
  ...(has('CLAUDE.md') ? [join(root, 'CLAUDE.md')] : []),
  ...(has('SETUP-GUIDE.md') ? [join(root, 'SETUP-GUIDE.md')] : []),
  ...walk(join(root, '.claude')),
];

const PLACEHOLDER = /\[X\]|\bTODO\b|\bFIXME\b|YOUR-USERNAME|YOUR_NAME|\blorem\b|\bxxx\b|\[your |\[insert/i;
const placeholderHits = [];
for (const file of deliveredFiles) {
  read(file)
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (PLACEHOLDER.test(line)) {
        placeholderHits.push(`${relative(root, file)}:${i + 1}  ${line.trim().slice(0, 60)}`);
      }
    });
}
if (placeholderHits.length) {
  fail('no leftover placeholders', placeholderHits.join('\n              '));
} else {
  ok('no leftover placeholders', `${deliveredFiles.length} delivered files scanned`);
}

// ---------------------------------------------------------------- C. secrets

const SECRET = /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]{10,})/;
const secretHits = [];
for (const file of deliveredFiles) {
  read(file)
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (SECRET.test(line)) secretHits.push(`${relative(root, file)}:${i + 1}`);
    });
}
if (secretHits.length) {
  fail('no secrets in delivered files', secretHits.join(', '));
} else {
  ok('no secrets in delivered files', '');
}

// ------------------------------------------------- D. referenced paths resolve

if (has('CLAUDE.md')) {
  const text = read(join(root, 'CLAUDE.md'));
  const CODE_EXT = /\.(ts|js|tsx|jsx|mjs|cjs|py|go|rs|rb|php|java|json|md|yml|yaml|toml)$/;

  const allFiles = walk(root).map((f) => relative(root, f).split(sep).join('/'));
  const basenames = new Set(allFiles.map((f) => f.split('/').pop()));

  const candidates = new Set();
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    let token = m[1].trim();

    // Quoted → it's a code literal (an import specifier in an example), not a repo path.
    if (/^['"][\s\S]*['"]$/.test(token)) continue;
    // Shell syntax, prose, globs.
    if (/[ =|*<>$()]/.test(token)) continue;
    if (token.startsWith('http')) continue;
    // Relative to some source file, not to the repo root.
    if (token.startsWith('../')) continue;

    token = token.replace(/^\.\//, '').replace(/[),:.]+$/, '');
    if (!token) continue;
    // A bare extension like ".ts" — prose about the extension itself.
    if (/^\.[A-Za-z]+$/.test(token)) continue;
    // Keep only things that look like a path or a filename.
    if (!token.includes('/') && !CODE_EXT.test(token)) continue;

    candidates.add(token);
  }

  const missing = [...candidates].filter((p) => {
    if (allFiles.includes(p)) return false;
    // Bare filename mentioned without its directory — fine if it exists anywhere.
    if (!p.includes('/') && basenames.has(p)) return false;
    // Directory references like `src/routes/`.
    return !existsSync(join(root, p.split('/').join(sep)));
  });

  if (candidates.size === 0) {
    warn('CLAUDE.md file references', 'no file paths referenced — is it specific enough to this repo?');
  } else if (missing.length) {
    fail('CLAUDE.md file references resolve', `not found: ${missing.join(', ')}`);
  } else {
    ok('CLAUDE.md file references resolve', `${candidates.size} paths checked`);
  }
}

// ------------------------------------------------ E. referenced scripts exist

const pkgPath = join(root, 'package.json');
if (existsSync(pkgPath) && has('CLAUDE.md')) {
  let scripts = {};
  try {
    scripts = JSON.parse(read(pkgPath)).scripts ?? {};
  } catch {
    fail('package.json', 'invalid JSON');
  }

  const referenced = new Set();
  const claudeText = read(join(root, 'CLAUDE.md'));
  for (const m of claudeText.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) referenced.add(m[1]);

  const undefinedScripts = [...referenced].filter((s) => !(s in scripts));
  if (undefinedScripts.length) {
    fail('npm scripts referenced exist', `not in package.json: ${undefinedScripts.join(', ')}`);
  } else if (referenced.size) {
    ok('npm scripts referenced exist', `${referenced.size} verified`);
  }
}

// ------------------------------------------------------------------- report

const pad = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const ICON = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' };

console.log(`\nDelivery check — ${root}\n${'='.repeat(60)}`);
for (const r of results) {
  console.log(`${pad(ICON[r.level], 6)} ${pad(r.check, 34)} ${r.detail}`);
}

const failures = results.filter((r) => r.level === 'fail').length;
const warnings = results.filter((r) => r.level === 'warn').length;

console.log('='.repeat(60));
if (failures) {
  console.log(`DO NOT SEND — ${failures} failure(s), ${warnings} warning(s).\n`);
  process.exit(1);
}
console.log(`Safe to deliver. ${warnings} warning(s) worth a look.\n`);
