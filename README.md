# simone-claude-skills

A small collection of agent skills for web development, written once and
distributed to multiple coding assistants. Works with Claude Code, Cursor,
Codex CLI, Cline, Continue.dev, and anything that can read a prompt file.

## Skills

| Name | What it does |
|---|---|
| **`img-optimise`** | Audits every image in the project (size, dimensions, format, references), reports a prioritised table, then fixes issues one category at a time using Pillow / pngquant / ImageMagick / sips. |
| **`a11y-audit`** | Runs a WCAG 2.1 AA accessibility audit across pages, CSS, and JS. Groups findings by severity, then fixes them one at a time with visual regression checks. |

Both skills are designed for **agentic coding tools** that can read project
files and execute shell commands. They will not work in plain chat interfaces
(ChatGPT web, Claude.ai web) because they need to run commands on your machine.

---

## Install

Pick the section for your tool.

### Claude Code

Copy the skill folder into your skills directory:

```bash
cp -r skills/img-optimise ~/.claude/skills/
cp -r skills/a11y-audit  ~/.claude/skills/
```

Claude Code auto-discovers skills on next launch. Invoke with `/img-optimise`
or `/a11y-audit`.

### Cursor

Copy the rule files into your project's Cursor rules folder:

```bash
mkdir -p .cursor/rules
cp cursor-rules/*.mdc .cursor/rules/
```

Cursor will load them automatically when relevant to the current task.

### Codex CLI / Cline / Roo Code / Windsurf

These tools read a single `AGENTS.md` at your project root. Either copy this
repo's `AGENTS.md` into your project, or append its contents to your existing
`AGENTS.md`:

```bash
cat AGENTS.md >> /path/to/your/project/AGENTS.md
```

### Continue.dev

Copy the prompt files into your project's rules folder:

```bash
mkdir -p .continue/rules
cp prompts/*.md .continue/rules/
```

### Any other tool (or manual use)

Open the file in `prompts/<skill-name>.md` and paste its contents into your
tool's custom-instructions or system-prompt field. The body is plain Markdown
with no tool-specific syntax.

---

## How it works

Source of truth lives in `src/`. Each `src/*.md` file has standard YAML
frontmatter (`name`, `description`) and a Markdown body.

A small build script (`build.mjs`) reads every source file and emits the
per-tool variants:

```
src/img-optimise.md          ─┬─→ skills/img-optimise/SKILL.md   (Claude Code)
                              ├─→ cursor-rules/img-optimise.mdc  (Cursor)
                              ├─→ prompts/img-optimise.md        (plain prompt)
                              └─→ AGENTS.md                      (combined, all skills)
```

This means you only ever edit one file per skill. The generated outputs stay
in sync.

---

## Contributing

### Adding a new skill

1. Create `src/<your-skill-name>.md` with YAML frontmatter:

   ```markdown
   ---
   name: your-skill-name
   description: |
     One- or two-sentence description of what the skill does.
   ---

   # Skill title

   Skill body…
   ```

2. Run the build:

   ```bash
   npm install   # first time only
   npm run build
   ```

3. Commit both the source file and the regenerated outputs.

### Editing an existing skill

Edit the file in `src/`, then `npm run build` to regenerate. **Never edit
files in `skills/`, `cursor-rules/`, `prompts/`, or `AGENTS.md` directly** —
they're overwritten on every build.

---

## License

MIT. See [LICENSE](LICENSE).
