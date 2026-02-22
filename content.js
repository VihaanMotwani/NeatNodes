// Content script - runs on Leetcode and Neetcode pages
// Extracts problem metadata and sends to popup/background

(function () {
  function extractLeetcodeInfo() {
    const url = window.location.href;
    const titleEl = document.querySelector('[data-cy="question-title"]') ||
      document.querySelector('div[class*="text-title-large"]') ||
      document.querySelector('span[class*="text-lg"]') ||
      document.querySelector('a[class*="title__"]');

    const diffEl = document.querySelector('div[class*="text-difficulty"]') ||
      document.querySelector('div[class*="text-olive"]') ||
      document.querySelector('div[class*="text-yellow"]') ||
      document.querySelector('div[class*="text-pink"]') ||
      document.querySelector('span[class*="text-olive"]') ||
      document.querySelector('span[class*="text-yellow"]') ||
      document.querySelector('span[class*="text-pink"]');

    // Try to get difficulty from the colored badge
    let difficulty = 'Medium';
    const allEls = document.querySelectorAll('div, span');
    for (const el of allEls) {
      const text = el.textContent.trim().toLowerCase();
      if ((text === 'easy' || text === 'medium' || text === 'hard') && el.children.length === 0) {
        const style = window.getComputedStyle(el);
        const color = style.color;
        if (text === 'easy' || text === 'medium' || text === 'hard') {
          difficulty = text.charAt(0).toUpperCase() + text.slice(1);
          break;
        }
      }
    }

    // Extract title from URL as fallback
    let title = '';
    if (titleEl) {
      title = titleEl.textContent.trim();
    } else {
      const match = url.match(/problems\/([^/]+)/);
      if (match) {
        title = match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }

    // Try to get tags
    const tagEls = document.querySelectorAll('a[href*="/tag/"] span, a[class*="topic-tag"]');
    const tags = Array.from(tagEls).map(el => el.textContent.trim()).filter(Boolean);

    return {
      title,
      url: url.split('?')[0].split('/description')[0].replace(/\/$/, ''),
      difficulty,
      tags,
      source: 'leetcode'
    };
  }

  function extractNeetcodeInfo() {
    const url = window.location.href;
    const titleEl = document.querySelector('h1') || document.querySelector('.problem-title');
    const title = titleEl ? titleEl.textContent.trim() : '';

    return {
      title,
      url: url.split('?')[0],
      difficulty: 'Medium',
      tags: [],
      source: 'neetcode'
    };
  }

  function extractInfo() {
    const hostname = window.location.hostname;
    if (hostname.includes('leetcode.com')) {
      return extractLeetcodeInfo();
    } else if (hostname.includes('neetcode.io')) {
      return extractNeetcodeInfo();
    }
    return null;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageInfo') {
      // Small delay to ensure page is loaded
      setTimeout(() => {
        const info = extractInfo();
        sendResponse(info);
      }, 300);
      return true; // async
    }
  });
})();
