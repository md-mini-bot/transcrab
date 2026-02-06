#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import matter from 'gray-matter';
import slugify from 'slugify';
import { fetch } from 'undici';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CONTENT_ROOT = path.join(ROOT, 'content', 'articles');

function usage() {
  console.log(`Usage:
  node scripts/add-url.mjs <url> [--lang zh]

Notes:
  - Fetches HTML, extracts main article (Readability), converts to Markdown (Turndown)
  - Writes source.md + meta.json
  - Generates a translation prompt for the running OpenClaw assistant (does NOT call OpenClaw)
`);
}

function argValue(args, key, def = null) {
  const idx = args.indexOf(key);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return def;
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  usage();
  process.exit(args.length === 0 ? 2 : 0);
}

const url = args[0];
const lang = argValue(args, '--lang', 'zh');

await fs.mkdir(CONTENT_ROOT, { recursive: true });

const html = await fetchHtml(url);
const { title, markdown } = await htmlToMarkdown(html, url);
const slug = makeSlug(title || url);
const dir = path.join(CONTENT_ROOT, slug);
await fs.mkdir(dir, { recursive: true });

const now = new Date();
const date = now.toISOString().slice(0, 10);

const sourceFrontmatter = {
  title: title || slug,
  date,
  sourceUrl: url,
  lang: 'source',
};
const sourceMd = matter.stringify(markdown, sourceFrontmatter);
await fs.writeFile(path.join(dir, 'source.md'), sourceMd, 'utf-8');

const meta = {
  slug,
  title: title || slug,
  date,
  sourceUrl: url,
  targetLang: lang,
  createdAt: now.toISOString(),
};
await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf-8');

const prompt = buildTranslatePrompt(markdown, lang);
const promptPath = path.join(dir, `translate.${lang}.prompt.txt`);
await fs.writeFile(promptPath, prompt + '\n', 'utf-8');

// Print a machine-readable summary for wrappers.
console.log(JSON.stringify({ ok: true, slug, dir, lang, promptPath }, null, 2));

// ----------------

async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

async function htmlToMarkdown(html, baseUrl) {
  // Lazy-load JSDOM (heavy)
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(html, { url: baseUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const title = article?.title || dom.window.document.title || '';
  const contentHtml = article?.content || dom.window.document.body?.innerHTML || '';

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  });

  // Preserve language info for fenced code blocks when possible.
  // Many docs sites render code blocks like:
  //   <pre class="language-csharp"><code>...</code></pre>
  // or wrap them with a div like:
  //   <div class="language-csharp ext-cs"><pre>...</pre></div>
  // Readability may rewrite some wrappers, so we check multiple places.
  turndown.addRule('fencedCodeBlockWithLanguage', {
    filter(node) {
      return (
        node.nodeName === 'PRE' &&
        node.textContent &&
        node.textContent.trim().length > 0
      );
    },
    replacement(_content, node) {
      const pre = node;
      const codeEl = pre.querySelector?.('code') || null;

      const classSources = [
        pre.getAttribute?.('class') || '',
        codeEl?.getAttribute?.('class') || '',
        pre.parentElement?.getAttribute?.('class') || '',
      ].filter(Boolean);

      function pickLang(classes) {
        const joined = classes.join(' ');
        // Common: language-xxx / lang-xxx
        let m = joined.match(/\b(?:language|lang)-([a-z0-9_+-]+)\b/i);
        if (m) return normalizeLang(m[1]);
        // Some sites: ext-cs, ext-js, etc.
        m = joined.match(/\bext-([a-z0-9_+-]+)\b/i);
        if (m) return normalizeLang(m[1]);
        return null;
      }

      function normalizeLang(lang) {
        const l = String(lang).toLowerCase();
        // A few pragmatic aliases seen on docs sites.
        if (l === 'cs') return 'csharp';
        if (l === 'c#') return 'csharp';
        if (l === 'js') return 'javascript';
        if (l === 'ts') return 'typescript';
        if (l === 'sh') return 'bash';
        if (l === 'shell') return 'bash';
        if (l === 'py') return 'python';
        if (l === 'kt') return 'kotlin';
        return l;
      }

      const lang = pickLang(classSources);
      const raw = (codeEl ? codeEl.textContent : pre.textContent) || '';
      const text = raw.replace(/\n+$/g, '');

      const fence = '```';
      const info = lang ? lang : '';
      return `\n${fence}${info}\n${text}\n${fence}\n`;
    },
  });

  // Keep links and images as-is
  const md = turndown.turndown(contentHtml);
  return { title: title.trim(), markdown: md.trim() + '\n' };
}

function makeSlug(title) {
  const s = slugify(title, { lower: true, strict: true, trim: true });
  return s || `article-${Date.now()}`;
}

function buildTranslatePrompt(md, targetLang) {
  const langName = targetLang === 'zh' ? '简体中文' : targetLang;
  return [
    `你是一个翻译助手。请把下面的 Markdown 内容翻译成${langName}。`,
    `要求：`,
    `- 保留 Markdown 结构（标题/列表/引用/表格/链接）。`,
    `- 代码块、命令、URL、文件路径保持原样，不要翻译。`,
    `- 术语以忠实原意为主，但整体表达要通顺自然（约 6/4：忠实/顺畅）。`,
    `- **必须同时翻译标题**：请先输出一行 Markdown 一级标题（以 "# " 开头），作为译文标题。`,
    `- 然后空一行，再输出译文正文（不要再重复标题）。`,
    `- 只输出翻译结果本身，不要附加解释、不要加前后缀。`,
    ``,
    `---`,
    md,
  ].join('\n');
}
