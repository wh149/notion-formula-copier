// Notion Formula Copier — Convert Engine
// Scans notion.so page for $...$ / $$...$$ and converts to equation blocks.
// Block → /block equation slash command. Inline → Ctrl+Shift+E shortcut.

(function () {
  'use strict';

  const BLOCK_RE = /\$\$([\s\S]*?)\$\$/g;
  const INLINE_RE = /\$([^$]+)\$/g;
  const isMac = /Mac/i.test(navigator.platform);
  const SHORTCUT = isMac ? 'Meta+Shift+E' : 'Ctrl+Shift+E';

  let isProcessing = false;
  let shouldStop = false;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'convertAll') { convertAll().then(sendResponse); return true; }
  });

  // ── Async helpers ────────────────────────────────────────────

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function waitFor(check, timeout = 240, interval = 12) {
    const deadline = Date.now() + timeout;
    return new Promise(resolve => {
      const tick = () => {
        const result = check();
        if (result) return resolve(result);
        if (Date.now() >= deadline) return resolve(null);
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  // ── Editor / DOM ─────────────────────────────────────────────

  function getEditors() {
    return Array.from(document.querySelectorAll('[contenteditable="true"]'))
      .filter(el => !el.closest('#formula-helper, #__nfc_toast'))
      .filter(el => !el.closest('.notion-table-view, [role="gridcell"], [role="cell"]'))
      .filter(el => {
        if (el.closest('.notion-simple-table-block, td, th') &&
            !el.matches('[data-content-editable-leaf="true"][contenteditable="true"], .notion-table-cell-text[contenteditable="true"]')) return false;
        return true;
      })
      .filter(el => el.textContent && el.textContent.trim())
      .filter(el => el.getClientRects().length > 0)
      .filter(el => !el.querySelector('[contenteditable="true"]'));
  }

  function isTableCell(el) {
    return !!(el.closest('td, th') &&
      el.matches('[data-content-editable-leaf="true"][contenteditable="true"], .notion-table-cell-text[contenteditable="true"]'));
  }

  function getSegments(editor) {
    const segs = [];
    let offset = 0;
    const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = w.nextNode())) {
      if (!node.textContent) continue;
      segs.push({ node, start: offset, end: offset + node.textContent.length });
      offset += node.textContent.length;
    }
    return segs;
  }

  function resolvePos(segs, offset, preferEnd) {
    if (!segs.length) return null;
    if (offset <= 0) return { node: segs[0].node, offset: 0 };
    for (const s of segs) {
      const inRange = preferEnd
        ? offset > s.start && offset <= s.end
        : offset >= s.start && offset < s.end;
      if (inRange) return { node: s.node, offset: Math.min(s.node.textContent.length, offset - s.start) };
      if (preferEnd && offset === s.end) return { node: s.node, offset: s.node.textContent.length };
    }
    const last = segs[segs.length - 1];
    return { node: last.node, offset: last.node.textContent.length };
  }

  function makeRange(editor, start, end) {
    const segs = getSegments(editor);
    const sp = resolvePos(segs, start, false);
    const ep = resolvePos(segs, end, true);
    if (!sp || !ep) return null;
    const r = document.createRange();
    r.setStart(sp.node, sp.offset);
    r.setEnd(ep.node, ep.offset);
    return r;
  }

  // ── Focus & selection ────────────────────────────────────────

  async function ensureFocus(el) {
    if (!el) return;
    if (isTableCell(el)) {
      const td = el.closest('td, th');
      if (td && document.activeElement !== el) { await simulateClick(td); await sleep(40); }
    }
    el.focus(); await sleep(8);
    if (document.activeElement !== el) await simulateClick(el);
  }

  async function selectRange(editor, start, end) {
    const r = makeRange(editor, start, end);
    if (!r) return null;
    await ensureFocus(editor);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
    await sleep(10);
    return r;
  }

  // ── Event simulation ─────────────────────────────────────────

  async function simulateClick(el) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (const type of ['mousemove', 'mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: cx, clientY: cy }));
      await sleep(8);
    }
  }

  const KEY_MAP = {
    Ctrl:  { key:'Control', code:'ControlLeft', keyCode:17 },
    Shift: { key:'Shift',   code:'ShiftLeft',   keyCode:16 },
    Alt:   { key:'Alt',     code:'AltLeft',     keyCode:18 },
    Meta:  { key:'Meta',    code:'MetaLeft',    keyCode:91 },
    Enter: { key:'Enter',   code:'Enter',       keyCode:13 },
    e:     { key:'e',       code:'KeyE',        keyCode:69 },
  };

  function keyInfo(k) {
    return KEY_MAP[k] || { key:k, code:'Key'+k.toUpperCase(), keyCode:k.toUpperCase().charCodeAt(0) };
  }

  async function simulateShortcut(combo, target) {
    const keys = combo.split('+');
    const tgt = target || document.activeElement || document.body;
    const events = keys.map(k => {
      const info = keyInfo(k);
      return {
        key: info.key, code: info.code, keyCode: info.keyCode,
        ctrlKey: keys.includes('Ctrl'), shiftKey: keys.includes('Shift'),
        altKey: keys.includes('Alt'), metaKey: keys.includes('Meta'), bubbles: true
      };
    });

    for (let i = 0; i < events.length - 1; i++) tgt.dispatchEvent(new KeyboardEvent('keydown', events[i]));
    const last = events[events.length - 1];
    tgt.dispatchEvent(new KeyboardEvent('keydown', last));
    tgt.dispatchEvent(new KeyboardEvent('keyup', last));
    for (let i = events.length - 2; i >= 0; i--) tgt.dispatchEvent(new KeyboardEvent('keyup', events[i]));
    await sleep(10);
  }

  async function simulateKey(keyName, target) {
    const k = keyInfo(keyName);
    const tgt = target || document.activeElement || document.body;
    const opts = { key:k.key, code:k.code, keyCode:k.keyCode, bubbles:true };
    tgt.dispatchEvent(new KeyboardEvent('keydown', opts));
    await sleep(10);
    tgt.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  function typeCommand(text) {
    const el = document.activeElement;
    if (!el) return;
    el.dispatchEvent(new InputEvent('beforeinput', { bubbles:true, cancelable:true, inputType:'insertText', data:text }));
    document.execCommand('insertText', false, text);
    el.dispatchEvent(new InputEvent('input', { bubbles:true, cancelable:false, inputType:'insertText', data:text }));
  }

  function typeFormula(text) {
    const el = document.activeElement;
    if (!el) return;
    el.dispatchEvent(new InputEvent('beforeinput', { bubbles:true, cancelable:true, inputType:'insertText', data:text }));

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const s = el.selectionStart;
      el.value = el.value.slice(0, s) + text + el.value.slice(el.selectionEnd);
      el.selectionStart = el.selectionEnd = s + text.length;
    } else if (el.isContentEditable) {
      const sel = window.getSelection();
      if (sel.rangeCount) {
        const r = sel.getRangeAt(0);
        r.deleteContents();
        r.insertNode(document.createTextNode(text));
        r.collapse(false);
      }
    }

    el.dispatchEvent(new InputEvent('input', { bubbles:true, cancelable:false, inputType:'insertText', data:text }));
  }

  // ── Equation input discovery ─────────────────────────────────

  function findMathInput(editor) {
    const candidates = document.querySelectorAll(
      'input:not(#formula-helper *), textarea:not(#formula-helper *), ' +
      '[contenteditable="true"]:not(#formula-helper *)');
    for (const c of candidates) {
      if (c.closest('#formula-helper, #__nfc_toast')) continue;
      if (c.getClientRects().length === 0) continue;
      if ((c.tagName === 'INPUT' || c.tagName === 'TEXTAREA' || c.isContentEditable) &&
          (editor.contains(c) || c.closest('.notion-overlay-container, [role="dialog"]'))) return c;
    }
    return null;
  }

  async function waitForMathInput(editor, attempts = 8, interval = 12) {
    for (let i = 0; i < attempts; i++) {
      const a = document.activeElement;
      if (a && a !== editor && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return a;
      const found = findMathInput(editor);
      if (found) return found;
      await sleep(interval);
    }
    return null;
  }

  function selectAllContent(el) {
    if (!el) return false;
    el.focus();
    if (typeof el.select === 'function') { el.select(); return true; }
    if (el.isContentEditable) {
      const r = document.createRange();
      r.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(r);
      return true;
    }
    return false;
  }

  // ── Scan ─────────────────────────────────────────────────────

  function lineBounds(text, start, end) {
    const ls = text.lastIndexOf('\n', start - 1) + 1;
    let le = text.indexOf('\n', end);
    if (le === -1) le = text.length;
    return { ls, le, standalone: text.slice(ls, start).trim() === '' && text.slice(end, le).trim() === '' };
  }

  function collectTasks() {
    const tasks = [];
    for (const editor of getEditors()) {
      const text = editor.textContent;
      const formulas = [];
      let m;

      BLOCK_RE.lastIndex = 0;
      while ((m = BLOCK_RE.exec(text)) !== null) {
        const b = lineBounds(text, m.index, m.index + m[0].length);
        formulas.push({ type:'block', content:m[1].trim(), start:m.index, end:m.index+m[0].length,
          ls:b.ls, le:b.le, standalone:b.standalone });
      }

      INLINE_RE.lastIndex = 0;
      while ((m = INLINE_RE.exec(text)) !== null) {
        if (text[m.index - 1] === '$') continue;
        formulas.push({ type:'inline', content:m[1].trim(), start:m.index, end:m.index+m[0].length,
          ls:0, le:0, standalone:false });
      }

      if (formulas.length) tasks.push({ editor, formulas, table: isTableCell(editor) });
    }
    return tasks;
  }

  // ── Convert ──────────────────────────────────────────────────

  async function convertOne(editor, formula) {
    try {
      let { type, content } = formula;
      let renderMode = type;

      if (type === 'block' && !formula.standalone) {
        renderMode = 'inline';
        if (!/^\\displaystyle\b/.test(content)) content = '\\displaystyle ' + content;
      }

      const rs = renderMode === 'block' ? formula.ls : formula.start;
      const re = renderMode === 'block' ? formula.le : formula.end;
      const range = await selectRange(editor, rs, re);
      if (!range) return false;

      if (renderMode === 'block') {
        const orig = editor.textContent;
        document.execCommand('delete');
        await waitFor(() => editor.textContent !== orig || document.activeElement !== editor, 120, 10);
        await ensureFocus(editor); await sleep(16);
        typeCommand('/block equation'); await sleep(40);
        await simulateKey('Enter');
        const inp = await waitForMathInput(editor, 10, 15);
        if (!inp) return false;
        selectAllContent(inp); typeFormula(content); await sleep(16);
        await simulateKey('Enter', inp);
        await waitFor(() => document.activeElement !== inp, 140, 10);
        await ensureFocus(editor); await sleep(16);
      } else {
        await ensureFocus(editor); await sleep(formula.table ? 16 : 8);
        await simulateShortcut(SHORTCUT, document.activeElement || editor);
        await sleep(formula.table ? 20 : 10);
        const inp = await waitForMathInput(editor, formula.table ? 30 : 8, formula.table ? 25 : 12);
        if (!inp) return false;
        selectAllContent(inp); typeFormula(content); await sleep(10);
        await simulateKey('Enter', inp);
        await waitFor(() => document.activeElement !== inp, 140, 10);
      }
      return renderMode;
    } catch (_) { return false; }
  }

  async function convertAll() {
    if (isProcessing) return { total:0, succeeded:0, msg:'Busy' };
    isProcessing = true; shouldStop = false;

    try {
      let tasks = collectTasks();
      const total = tasks.reduce((sum, t) => sum + t.formulas.length, 0);
      if (!total) return { total:0, succeeded:0, msg:'No formulas found' };

      let succeeded = 0;

      // Inline first (reverse)
      for (let i = tasks.length - 1; i >= 0; i--) {
        if (shouldStop) break;
        for (let j = tasks[i].formulas.length - 1; j >= 0; j--) {
          if (shouldStop) break;
          if (tasks[i].formulas[j].type !== 'inline') continue;
          if (await convertOne(tasks[i].editor, tasks[i].formulas[j])) succeeded++;
        }
      }

      // Block second (re-scan)
      if (!shouldStop) {
        await sleep(200);
        tasks = collectTasks();
        for (let i = tasks.length - 1; i >= 0; i--) {
          if (shouldStop) break;
          for (let j = tasks[i].formulas.length - 1; j >= 0; j--) {
            if (shouldStop) break;
            if (tasks[i].formulas[j].type !== 'block') continue;
            if (await convertOne(tasks[i].editor, tasks[i].formulas[j])) succeeded++;
          }
        }
      }

      return { total, succeeded, msg: shouldStop ? 'Stopped' : 'Done' };
    } finally {
      isProcessing = false;
    }
  }
})();
