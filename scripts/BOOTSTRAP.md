# TransCrab bootstrap (FOR OPENCLAW ASSISTANTS)

This document is written for an **OpenClaw assistant (bot)**.

Your job is to help your human install and deploy TransCrab, then operate it reliably.

## Goal

After setup, the human can:

- send a URL
- then send `crab`

…and you will fetch → extract → markdown → translate → commit/push, and return a deployed page URL.

## Built-in scripts in this repo

- `scripts/add-url.mjs` — main pipeline (fetch → extract → markdown → translate → write files)
- `scripts/run-crab.sh` — wrapper for `add-url.mjs`
- `scripts/sync-upstream.sh` — sync template updates into a fork

## One-time setup checklist

1) Confirm prerequisites
- Node.js 22+
- OpenClaw gateway is running locally
- A working model provider is configured (default: `openai-codex/gpt-5.2`)

2) Ask the human for deployment details
- Do they already have a GitHub repo ready (fork) or should you fork `onevcat/transcrab` for them?
- Do they already have a Netlify site URL, or should they create one and connect it to the repo?

3) Repo setup
- Clone the repo into the workspace
- Run `npm i`
- Run `npm run build`

4) Netlify settings
- Build command: `npm run build`
- Publish dir: `dist`

## Conversation contract

- URL alone is **not** a trigger.
- Only run the default pipeline when the human sends URL + `crab`.
- If the human provides explicit instructions, follow them instead:
  - `raw <url>`: store source only
  - `sum <url>`: summary only
  - `tr:<lang> <url>`: translate to another language

## Operating the pipeline

On `URL + crab`:

- Run the pipeline script:

```bash
./scripts/run-crab.sh <url> --lang zh --model openai-codex/gpt-5.2
```

- Then commit and push to `main`.
- Reply with the deployed page URL.

## Translation rules (what to instruct the model)

The repo already contains the translation prompt logic in `scripts/add-url.mjs` (`buildTranslatePrompt`).
It enforces:

- keep Markdown structure
- do not translate code blocks, commands, URLs, file paths
- meaning-first but reads naturally (roughly 6/4)

## Updates

To sync upstream changes into the fork:

```bash
./scripts/sync-upstream.sh
```
