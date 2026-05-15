# Notion Formula Copier

Chrome/Edge extension to batch-convert `$...$` and `$$...$$` into Notion equation blocks with one click.

## Why

AI chat outputs (Gemini, ChatGPT, Claude) often include LaTeX math delimiters, but Notion's paste handler prioritizes HTML over plain text, so `$$E=mc^2$$` stays as literal text instead of rendering as an equation. Manually selecting and pressing Ctrl+Shift+E for each formula is tedious.

This extension automates it.

## Usage

| Trigger | How |
|---|---|
| **Right-click** | On any notion.so page → `⚡ Convert $$ → Equations` |
| **Extension popup** | Click the extension icon → `Convert $$ → Equations` |

Block formulas (`$$...$$`) are converted via Notion's `/block equation` slash command. Inline formulas (`$...$`) via the `Ctrl+Shift+E` keyboard shortcut. The extension finds math input boxes, types the formula content, and confirms — all programmatically.

## Install

1. `edge://extensions` or `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the project directory
4. Refresh any open Notion tabs

## How it works

```
$$p_k L_{k+1} < p_{k+1} L_k$$
    ↓ scan contenteditable blocks with regex
    ↓ select text → delete line → type /block equation
    ↓ wait for equation input → type formula (safe DOM insertion)
    ↓ Enter → done
```

Keyboard events and text input are dispatched via `execCommand('insertText')` + `InputEvent`, which triggers React's event system in Notion's editor. Formula content with special characters (`<`, `>`, `&`, `_`, `{`, `}`) is inserted through direct DOM manipulation (`createTextNode` / `value` assignment) to avoid HTML parsing.

## Files

```
├── manifest.json          # MV3, contextMenus permission
├── background.js          # Registers right-click context menu
├── notion-convert.js      # Scan + convert engine (content script)
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
└── icons/                 # SVG icons
```

## Credits

Conversion strategy adapted from [Notion-Formula-Auto-Conversion-Tool](https://github.com/skyance/Notion-Formula-Auto-Conversion-Tool).
