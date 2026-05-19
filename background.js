// Notion Formula Copier — Background Service Worker

const CONVERT_MENU = 'convert-formulas';
const FORMAT_MENU = 'format-asterisk';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONVERT_MENU,
    title: '⚡ Convert $$ → Equations',
    contexts: ['page', 'editable'],
    documentUrlPatterns: ['*://*.notion.so/*']
  });
  chrome.contextMenus.create({
    id: FORMAT_MENU,
    title: '🔧 Fix * ** line breaks in clipboard',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONVERT_MENU && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'convertAll' }).catch(() => {});
  }
  if (info.menuItemId === FORMAT_MENU && tab?.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        try {
          const text = await navigator.clipboard.readText();
          const transformed = text.replace(/\*\s*\n\s*\*\*/g, '* **');
          if (transformed !== text) {
            await navigator.clipboard.writeText(transformed);
          }
        } catch (_) {}
      }
    }).catch(() => {});
  }
});
