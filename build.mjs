#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const SRC = 'src';
const OUT_SKILLS = 'skills';
const OUT_CURSOR = 'cursor-rules';
const OUT_PROMPTS = 'prompts';

function parseSource(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`No frontmatter in ${filePath}`);
  return { meta: yaml.load(match[1]), body: match[2].trim() };
}

for (const dir of [OUT_SKILLS, OUT_CURSOR, OUT_PROMPTS]) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

const sources = readdirSync(SRC).filter(f => f.endsWith('.md')).sort();
const allSkills = [];

for (const file of sources) {
  const { meta, body } = parseSource(join(SRC, file));
  const name = meta.name;
  if (!name) throw new Error(`Missing 'name' in ${file}`);

  const skillDir = join(OUT_SKILLS, name);
  mkdirSync(skillDir, { recursive: true });
  const skillFrontmatter = yaml.dump(meta).trim();
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\n${skillFrontmatter}\n---\n\n${body}\n`
  );

  const desc = (meta.description || '').replace(/\s+/g, ' ').trim();
  const cursorFrontmatter = `description: ${desc}\nalwaysApply: false`;
  writeFileSync(
    join(OUT_CURSOR, `${name}.mdc`),
    `---\n${cursorFrontmatter}\n---\n\n${body}\n`
  );

  writeFileSync(join(OUT_PROMPTS, `${name}.md`), `${body}\n`);

  allSkills.push({ name, description: desc, body });
}

const agents = [
  '# Skills',
  '',
  'Each section below is a self-contained skill. Read the one relevant to the current task.',
  '',
  ...allSkills.flatMap(s => [
    `## ${s.name}`,
    '',
    `_${s.description}_`,
    '',
    s.body,
    '',
    '---',
    '',
  ]),
].join('\n');
writeFileSync('AGENTS.md', agents);

console.log(`Built ${sources.length} skill(s): ${allSkills.map(s => s.name).join(', ')}`);
