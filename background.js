// Notion Formula Copier — Background Service Worker

const CONVERT_MENU = 'convert-formulas';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONVERT_MENU,
    title: '⚡ Convert $$ → Equations',
    contexts: ['page', 'editable'],
    documentUrlPatterns: ['*://*.notion.so/*']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONVERT_MENU && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'convertAll' }).catch(() => {});
  }
});
