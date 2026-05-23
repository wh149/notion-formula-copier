# Notion Formula Copier

> Batch convert LaTeX math formulas to Notion equation blocks with one click.

When you copy AI-generated content from **Gemini**, **ChatGPT**, or **Claude** into Notion, LaTeX math delimiters like `$$E=mc^2$$` and `$x^2 + y^2 = z^2$` stay as raw text instead of rendering as equations. This extension scans your Notion page and auto-converts every formula — **inline math** (`$…$`) and **display math** (`$$…$$`) — into native Notion equation blocks.

## Features

- **One-click batch conversion** — right-click on any Notion page or use the extension popup
- **Block formulas** — converts `$$…$$` to Notion block equations via the `/block equation` slash command
- **Inline formulas** — converts `$…$` to Notion inline equations via the `Ctrl+Shift+E` shortcut
- **Safe character handling** — special characters like `<`, `>`, `&`, `_`, `{`, `}` are inserted through direct DOM manipulation, not HTML parsing
- **Zero configuration** — works immediately after loading the extension

## Why

AI chatbots (Gemini, ChatGPT, Claude, DeepSeek, Kimi) output LaTeX-formatted math. When you paste this into Notion, the browser's rich-text clipboard bypasses Notion's Markdown parser. Your `$\frac{1}{n}$` stays as literal text. Manually selecting each formula and pressing `Ctrl+Shift+E` is slow. This extension automates the entire page in one pass.

## Supported Platforms

Tested with LaTeX math output from:

- **Google Gemini**
- **ChatGPT / OpenAI**
- **Claude (Anthropic)**
- DeepSeek, Kimi, Qwen, and other LLMs that use `$` / `$$` KaTeX delimiters

## Install

### From Source

```bash
git clone git@github.com:wh149/notion-formula-copier.git
```

1. Open `edge://extensions` or `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the cloned directory

### From Browser Add-on Store

- [Edge Add-ons](#) *(coming soon)*
- [Chrome Web Store](https://chromewebstore.google.com/detail/notion-formula-copier/ihgjbgdolkcnipledofdelcdebdaemjj?hl=zh-CN&authuser=0) *(coming soon)*

## Usage

| Trigger | How |
|---|---|
| **Right-click menu** | On any `notion.so` page → Right-click → `⚡ Convert $$ → Equations` |
| **Extension popup** | Click the toolbar icon → `Convert $$ → Equations` |

The conversion processes formulas from bottom to top to preserve text offsets. A progress summary is shown after completion.

## How It Works

```
Paste text with $$p_k < p_{k+1}$$ into Notion
    ↓
Right-click → Convert $$ → Equations
    ↓
Scan contenteditable blocks for $...$ and $$...$$ patterns
    ↓
Inline: select text → Ctrl+Shift+E → type formula → Enter
Block:  delete line → type /block equation → Enter → type formula → Enter
    ↓
All LaTeX math rendered as native Notion equations
```

Text input is dispatched via `execCommand('insertText')` + `InputEvent` to trigger React's event system in Notion's editor. Formula content with special characters is inserted through `createTextNode()` / `value` assignment to avoid HTML entity interpretation.

## Tech Stack

- Manifest V3 (Chrome Extension)
- JavaScript (no framework, no build step)
- 5 files, ~270 lines of core logic

## Credits

Conversion strategy adapted from [Notion-Formula-Auto-Conversion-Tool](https://github.com/skyance/Notion-Formula-Auto-Conversion-Tool).

## License

Apache 2.0
