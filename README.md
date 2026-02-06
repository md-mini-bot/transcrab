# TransCrab

TransCrab is **OpenClaw-first**: a small, stable capability you add to an OpenClaw assistant so it can turn links into a polished translated reading page.

This is not a generic “for humans” app. It’s a **template for OpenClaw assistants** (bots) to install, operate, and keep updated.

---

## What you get

After setup, your OpenClaw assistant can take a link + the keyword `crab` and:

1) fetch the page
2) extract main content
3) convert HTML → Markdown
4) translate Markdown (default: zh-Hans)
5) commit + push to your repo
6) Netlify rebuilds → you get a page URL

---

## Install (human prompt)

Send this to your OpenClaw assistant:

> Help me install and deploy TransCrab:
> https://github.com/onevcat/transcrab

---

## Install (for OpenClaw assistant / bot)

Follow the steps below. You may also refer to `scripts/BOOTSTRAP.md`.

### 0) Ask the user for required info

- Their fork repo URL (or permission to fork `onevcat/transcrab` into their account)
- Their Netlify site URL (or whether they want you to create/configure it)
- Preferred default translation target language (default: `zh`)
- Preferred model (default: `openai-codex/gpt-5.2`)

### 1) Repo + Netlify deployment

- Fork/clone the repo into the user’s workspace
- Ensure `npm i` and `npm run build` succeed
- Deploy the user’s fork on Netlify:
  - Build command: `npm run build`
  - Publish directory: `dist`

### 2) Runtime behavior contract (conversation UX)

- Do **not** run the pipeline on URL alone.
- Only run the default pipeline when the user sends a URL and then sends `crab`.
- If the user provides explicit instructions, follow them instead:
  - `raw <url>`: store source only
  - `sum <url>`: summary only
  - `tr:<lang> <url>`: translate to another language

### 3) How to run the pipeline (built-in scripts)

This template already includes scripts you can call:

- `scripts/add-url.mjs`: the main pipeline (fetch → extract → markdown → translate → write files)
- `scripts/run-crab.sh`: thin wrapper around `add-url.mjs`
- `scripts/sync-upstream.sh`: keep a fork up to date with template changes

### 4) Translation mechanism (what actually happens)

Translation is implemented inside `scripts/add-url.mjs`:

- It builds a strict translation prompt (`buildTranslatePrompt`) that instructs the model to:
  - preserve Markdown structure
  - not translate code blocks / commands / URLs / file paths
  - keep meaning first but read naturally (roughly 6/4)
- It then invokes OpenClaw via CLI:
  - reads the current default model (`openclaw models status --json`)
  - temporarily switches to the requested model (`openclaw models set ...`) if needed
  - runs an agent turn (`openclaw agent --agent main --message <prompt>`)
  - switches the default model back

Note: `openclaw agent` uses your running OpenClaw gateway and your configured model auth (OAuth/API key) stored in OpenClaw.

### 5) Output format

On `URL + crab`, write under `content/articles/<slug>/`:

- `source.md`
- `<lang>.md` (e.g. `zh.md`)
- `meta.json`

Then commit + push to `main` and reply with the deployed page URL.

---

## Updating (when this template changes)

In a fork clone:

```bash
./scripts/sync-upstream.sh
```

---

## Requirements

- Node.js 22+
- OpenClaw gateway running locally
- A configured model provider in OpenClaw (default suggested: `openai-codex/gpt-5.2`)

## License

MIT
