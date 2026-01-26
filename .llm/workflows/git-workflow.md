# Git & Branching Workflow

## Branching Strategy

- **`main`** - Primary development branch
- Feature branches optional: `feat/description` from `main`

## Development Workflow

### Daily Development

1. **Work on `main` branch (or feature branch)**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Make changes and test locally**
   ```bash
   # Run all checks before committing
   pnpm lint
   pnpm check
   pnpm test
   pnpm build
   ```

3. **Commit with gitmoji format**
   ```bash
   git add .
   git commit -m "✨ Add story generation form"
   ```

4. **Push to main**
   ```bash
   git push origin main
   ```

## Commits

### Git Author Configuration

All commits must be authored as:
```
Mark McDermott <mark@markmcdermott.io>
```

**CRITICAL**: Do NOT include any AI attribution (Claude, Anthropic, Co-Authored-By, etc.) in commit messages.

### Gitmoji Commit Format

Use [gitmoji.dev](https://gitmoji.dev) emoji prefixes. Common ones:

| Emoji | Code | Meaning |
|-------|------|---------|
| ✨ | `:sparkles:` | New feature |
| 🐛 | `:bug:` | Bug fix |
| 🔧 | `:wrench:` | Configuration |
| ♻️ | `:recycle:` | Refactor |
| 🧪 | `:test_tube:` | Tests |
| 📝 | `:memo:` | Documentation |
| 🎨 | `:art:` | Style/format |
| 🔥 | `:fire:` | Remove code/files |
| 🚀 | `:rocket:` | Deploy/release |

### Commit Message Guidelines

**These rules apply ALWAYS** - whether committing autonomously during development or when the user asks you to commit.

- **Single line only** - NO multiline messages, NO bullet lists, NO descriptions
- **Under 10 words preferred**, max 15 words
- Lead with gitmoji emoji (actual emoji, not code)
- Short sentence, no period needed
- Focus on the **biggest change only** - omit lesser changes
- Consistent length is more important than comprehensive coverage
- Do NOT include AI authorship metadata in commits

### Examples
```bash
git commit -m "✨ Add world element drag-and-drop to scenes"
git commit -m "🐛 Fix session persistence on refresh"
git commit -m "♻️ Extract story parsing to utility"
git commit -m "🧪 Add MSW handlers for OpenAI API"
git commit -m "🔥 Remove deprecated undo/redo code"
git commit -m "📝 Update STATE-WORKFLOW-SPEC"
```

## Pre-Push Checklist

Before every push:

```bash
pnpm lint        # ESLint passes
pnpm check       # TypeScript/Svelte check passes
pnpm test        # All tests pass
pnpm build       # Build succeeds
```

**No CI/CD** - These checks are your responsibility locally.

## Pull Requests (Optional)

For larger features, you may use feature branches:

```bash
# Create feature branch
git checkout -b feat/storyboard-editor main

# Work on feature...

# Push and create PR targeting main
git push -u origin feat/storyboard-editor
```

### PR Guidelines
- Target `main` branch
- Include description of changes
- Note any testing done
- Self-review before merging

## Hotfixes

For urgent fixes:

```bash
# 1. Create hotfix from main
git checkout -b hotfix/critical-bug main

# 2. Make fix and test locally
pnpm test

# 3. Merge to main
git checkout main
git merge hotfix/critical-bug
git push origin main

# 4. Clean up
git branch -d hotfix/critical-bug
```

## No CI/CD Policy

This project intentionally has no CI/CD pipeline:

- **Developer responsibility**: Run all checks locally before pushing
- **Quality gate**: Your local `pnpm test && pnpm lint && pnpm check && pnpm build`

This approach keeps the workflow simple and gives developers full control over what gets committed.
