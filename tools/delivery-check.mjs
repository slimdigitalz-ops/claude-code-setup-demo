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

// Every markdown file at the repo root, plus everything under .claude/.
// Scanning only CLAUDE.md and SETUP-GUIDE.md missed anything else delivered
// alongside them — a walkthrough shipped with its [brackets] unfilled would
// have passed silently.
const deliveredFiles = [
  ...readdirSync(root)
    .filter((f) => f.toLowerCase().endsWith('.md'))
    .map((f) => join(root, f))
    .filter((f) => statSync(f).isFile()),
  ...walk(join(root, '.claude')),
];

const PLACEHOLDER_TOKENS = /\bTODO\b|\bFIXME\b|YOUR-USERNAME|YOUR_NAME|\blorem\b|\bxxx\b/i;

// Any bracketed span of 3+ characters that isn't a markdown link. Catches the
// template idiom — [state the real baseline], [trap 1], [one-line cause] — which
// the old token list missed entirely. 3+ excludes `- [ ]` and `- [x]` checkboxes;
// the negative lookahead excludes [text](url).
const PLACEHOLDER_BRACKET = /\[[^\]\n]{3,}\](?!\()/;

// Code spans legitimately contain brackets (array indexing, type annotations),
// so strip them before looking.
const stripCode = (line) => line.replace(/`[^`\n]*`/g, '');

const placeholderHits = [];
for (const file of deliveredFiles) {
  let inFence = false;
  read(file)
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (line.trim().startsWith('```')) { inFence = !inFence; return; }
      if (inFence) return;

      const scannable = stripCode(line);
      if (PLACEHOLDER_TOKENS.test(scannable) || PLACEHOLDER_BRACKET.test(scannable)) {
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

const claudeText = has('CLAUDE.md') ? read(join(root, 'CLAUDE.md')) : '';

// --- Node: npm scripts must exist in package.json
const pkgPath = join(root, 'package.json');
if (existsSync(pkgPath) && claudeText) {
  let scripts = {};
  try {
    scripts = JSON.parse(read(pkgPath)).scripts ?? {};
  } catch {
    fail('package.json', 'invalid JSON');
  }

  const referenced = new Set();
  for (const m of claudeText.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) referenced.add(m[1]);

  const undefinedScripts = [...referenced].filter((s) => !(s in scripts));
  if (undefinedScripts.length) {
    fail('npm scripts referenced exist', `not in package.json: ${undefinedScripts.join(', ')}`);
  } else if (referenced.size) {
    ok('npm scripts referenced exist', `${referenced.size} verified`);
  }
}

// --- Every other ecosystem: at minimum, prove the manifest the commands imply is present.
//
// Without this, a Python or Go delivery skipped the command check silently and still
// reported "Safe to deliver" — a weaker check with no warning that it was weaker.
if (claudeText) {
  const ECOSYSTEMS = [
    { name: 'Node',    cmd: /\b(npm|pnpm|yarn|npx) /,        manifest: ['package.json'] },
    { name: 'Python',  cmd: /\b(pytest|poetry|uv|python -m)/, manifest: ['pyproject.toml', 'setup.py', 'requirements.txt'] },
    { name: 'Go',      cmd: /\bgo (test|build|run|vet)/,      manifest: ['go.mod'] },
    { name: 'Rust',    cmd: /\bcargo (test|build|run|clippy)/, manifest: ['Cargo.toml'] },
    { name: 'Ruby',    cmd: /\b(bundle|rake|rspec) /,         manifest: ['Gemfile'] },
    { name: 'PHP',     cmd: /\b(composer|phpunit) /,          manifest: ['composer.json'] },
    { name: 'Java',    cmd: /\b(mvn|gradle) /,                manifest: ['pom.xml', 'build.gradle', 'build.gradle.kts'] },
    { name: 'Make',    cmd: /\bmake [a-z]/,                   manifest: ['Makefile', 'makefile'] },
  ];

  // Only look inside code formatting. Prose uses these words constantly —
  // "the traps that make it go wrong" is not a Makefile.
  const commandText = [
    ...claudeText.matchAll(/```[\s\S]*?```/g),
    ...claudeText.matchAll(/`[^`\n]+`/g),
  ].map((m) => m[0]).join('\n');

  const detected = ECOSYSTEMS.filter((e) => e.cmd.test(commandText));

  if (detected.length === 0) {
    warn('commands are runnable', 'CLAUDE.md references no recognizable build/test command — is it specific enough?');
  } else {
    const missing = detected.filter((e) => !e.manifest.some((m) => has(m)));
    if (missing.length) {
      fail('commands match the project',
        missing.map((e) => `${e.name} commands used but no ${e.manifest.join(' / ')}`).join('; '));
    } else {
      ok('commands match the project', detected.map((e) => e.name).join(', '));
    }
  }

  // A Node repo that only got the generic check is worth flagging.
  if (!existsSync(pkgPath) && detected.some((e) => e.name !== 'Node')) {
    warn('note', `non-Node project (${detected.map((e) => e.name).join(', ')}) — script-level verification is not available here, so read the commands yourself`);
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
