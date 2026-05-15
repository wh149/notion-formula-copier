// Notion Formula Copier — Popup
(function () {
  'use strict';
  const btn = document.getElementById('convertBtn');
  const result = document.getElementById('result');

  btn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('notion.so')) {
      result.textContent = 'Open a notion.so page to use.';
      result.className = 'warn';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Converting...';
    result.textContent = '';
    result.className = '';

    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'convertAll' });
      if (res.msg === 'Busy') {
        result.textContent = 'Already in progress…';
        result.className = 'warn';
      } else if (res.total) {
        const pct = Math.round(res.succeeded / res.total * 100);
        result.textContent = `${res.msg}: ${res.succeeded}/${res.total} (${pct}%)`;
        result.className = res.succeeded === res.total ? 'ok' : 'warn';
      } else {
        result.textContent = res.msg || 'No formulas found.';
        result.className = 'warn';
      }
    } catch (_) {
      result.textContent = 'Refresh the page and retry.';
      result.className = 'warn';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Convert $$ → Equations';
    }
  });
})();
