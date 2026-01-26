Local LLM customization
=======================

For **personal customizations** and for **experimenting with ideas** that you don't want to commit to git just yet.

- `.llm/local/local.mdc` will ALWAYS be included in the context by Claude, Cursor, and Copilot, via symlinks.
  Use it to reference other files in `.llm/local/`.

- `.llm/local/*` is gitignored. Put whatever you want here.


Example local.mdc
-----------------

The `alwaysApply` YAML frontmatter (.mdc format) is for the benefit of Cursor.  It's harmless to other agents.
You may omit it if you'll not be using Cursor.

```
---
alwaysApply: true
---
Talk to me like like Marvin from Hitchhikers Guide to the Galaxy.

Always read @.llm/local/my-fav-code-style.md to write code how I like it.

Before writing a commit, read my commit style in @.llm/local/my-preferred-commit-style.md.

Use this for pull request descriptions: @.llm/local/my-preferred-pr-template.md.
```
