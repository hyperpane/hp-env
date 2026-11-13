# Env

A project's `.env` files in one window: every variable, with its value
hidden until you look, changed in place, compared across files, and a
warning when git has your secrets.

## What it finds

`.env`, `.env.<anything>` (`.env.local`, `.env.production`, `.env.example`)
and `<anything>.env` (`prod.env`), in the project's folder and three levels
down, not in `node_modules`, `.git`, `dist`, `build`, `target`, `vendor`,
`.venv` and the like. The project's own come first, then by folder.

`.env.example`, `.env.sample`, `.env.template` (and `-dist`, `-defaults`)
are **examples**: the variables a project needs, with placeholders. Their
values are shown; a file beside one lists what the example has that it
hasn't, each with Add.

## In the window

- **A tab per file**, with how many variables it has. ⚠ on one that git has
  committed, or doesn't ignore.
- **Values are hidden** (`••••••••`): the eye on a row shows it, the eye in
  the bar shows them all. Copy puts a value on the clipboard.
- **Double-click** a value (or the pencil) to change it; a name, to rename
  it. Enter saves, Shift+Enter is a new line, Escape cancels. The row at the
  bottom adds one.
- **Compare**: every variable against every file, `missing` in red (click
  to add it), `≠` where they differ.
- **New .env file**: in the project's folder or one in it; a copy of the
  example beside it, when there is one.

## Changes keep the file as it was

Only the variable's own lines change: comments, blank lines, the order,
`export`, indentation, other quotes and Windows line endings stay. A new
variable goes after the last one. A value is written bare when it can be,
in `'single'` quotes when it has spaces or `#`, in `"double"` quotes (with
`\n`) when it has line breaks or quotes, so it reads back the same.

An edit is made on the file as the window saw it: if it changed on disk
since (your editor, a script), the edit is refused and the window shows the
file as it is now. The window follows changes on disk by itself.

What's read is what dotenv reads: `KEY=value`, `export KEY=value`, values
bare (up to a ` #` comment), `'single'`, `"double"` (with `\n`, `\t`,
`\"`, `\\`) or `` `backticks` ``, quoted ones over several lines. A key
that's there twice shows `×2`: the last one counts, and is the one changed.
Lines that aren't a variable are kept, and said.

## Git

For each file, git is asked whether it's committed (`git ls-files`) and
whether it's ignored (`git check-ignore --no-index`):

- **committed** (not an example): its secrets are in the repository's
  history. Remove it from git (`git rm --cached`), ignore it, and change
  the secrets.
- **not ignored**: it could be committed. Add it to `.gitignore`.

No git, or not a repository: nothing's said.

## Develop

```sh
./build.sh --test
```
