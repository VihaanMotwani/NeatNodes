// NeatNodes - Popup JS

let patterns = [];
let dataStructures = [];
let timerDefaults = {};
let selectedDifficulty = 'Medium';
let selectedConfidence = 2;
let selectedDS = new Set();
let timerInterval = null;
let timerEndTime = null;
let timerRunning = false;

// Init
document.addEventListener('DOMContentLoaded', async () => {
  // Load patterns and config from background
  chrome.runtime.sendMessage({ action: 'getPatterns' }, (response) => {
    if (response) {
      patterns = response.patterns;
      dataStructures = response.dataStructures;
      timerDefaults = response.timerDefaults;
      populatePatterns();
      populateDS();
      updateTimerDisplay(timerDefaults[selectedDifficulty]);
    }
  });

  // Load review count
  loadReviewCount();

  // Check for active timer
  chrome.runtime.sendMessage({ action: 'getTimer' }, (response) => {
    if (response && response.timer) {
      const remaining = response.timer.startTime + response.timer.duration - Date.now();
      if (remaining > 0) {
        startTimerUI(remaining);
      }
    }
  });

  // Try to detect page info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && (tab.url.includes('leetcode.com/problems') || tab.url.includes('neetcode.io'))) {
      chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded, try injecting
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' }, (r) => {
                if (r) populateFromPage(r);
              });
            }, 500);
          }).catch(() => {});
          return;
        }
        if (response) populateFromPage(response);
      });
    }
  });

  // Setup event listeners
  setupChipGroups();
  setupTimer();

  document.getElementById('submitBtn').addEventListener('click', handleSubmit);
  document.getElementById('dashboardBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    window.close();
  });
  document.getElementById('reviewBanner').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') + '#reviews' });
    window.close();
  });
});

function populateFromPage(info) {
  if (info.title) document.getElementById('titleInput').value = info.title;
  if (info.url) document.getElementById('urlInput').value = info.url;

  if (info.difficulty) {
    selectedDifficulty = info.difficulty;
    updateChipGroup('diffGroup', info.difficulty);
    updateTimerDisplay(timerDefaults[info.difficulty]);
  }

  document.getElementById('detectedBadge').style.display = 'block';
}

function populatePatterns() {
  const select = document.getElementById('patternSelect');
  patterns.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.icon} ${p.name}`;
    select.appendChild(opt);
  });
}

function populateDS() {
  const container = document.getElementById('dsTags');
  dataStructures.forEach(ds => {
    const tag = document.createElement('div');
    tag.className = 'ds-tag';
    tag.textContent = ds;
    tag.addEventListener('click', () => {
      tag.classList.toggle('active');
      if (selectedDS.has(ds)) selectedDS.delete(ds);
      else selectedDS.add(ds);
    });
    container.appendChild(tag);
  });
}

function setupChipGroups() {
  // Difficulty chips
  document.querySelectorAll('#diffGroup .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#diffGroup .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedDifficulty = chip.dataset.value;
      if (!timerRunning) {
        updateTimerDisplay(timerDefaults[selectedDifficulty]);
      }
    });
  });

  // Confidence chips
  document.querySelectorAll('#confGroup .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#confGroup .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedConfidence = parseInt(chip.dataset.value);
    });
  });
}

function updateChipGroup(groupId, value) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => {
    c.classList.remove('active');
    if (c.dataset.value === value || c.dataset.value === String(value)) {
      c.classList.add('active');
    }
  });
}

function loadReviewCount() {
  chrome.runtime.sendMessage({ action: 'getReviews' }, (response) => {
    if (response) {
      const today = new Date().toISOString().split('T')[0];
      const due = response.reviews.filter(r => r.dueDate <= today && !r.completed);
      document.getElementById('reviewCount').textContent = due.length;
    }
  });
}

// Timer
function setupTimer() {
  document.getElementById('timerStartBtn').addEventListener('click', () => {
    const seconds = timerDefaults[selectedDifficulty] || 1800;
    chrome.runtime.sendMessage({
      action: 'startTimer',
      seconds,
      difficulty: selectedDifficulty,
      problemTitle: document.getElementById('titleInput').value
    });
    startTimerUI(seconds * 1000);
  });

  document.getElementById('timerStopBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopTimer' });
    stopTimerUI();
  });
}

function startTimerUI(durationMs) {
  timerRunning = true;
  timerEndTime = Date.now() + durationMs;
  document.getElementById('timerStartBtn').style.display = 'none';
  document.getElementById('timerStopBtn').style.display = 'inline-flex';
  const display = document.getElementById('timerDisplay');
  display.classList.add('running');
  display.classList.remove('danger');

  timerInterval = setInterval(() => {
    const remaining = timerEndTime - Date.now();
    if (remaining <= 0) {
      display.textContent = '00:00';
      display.classList.remove('running');
      display.classList.add('danger');
      stopTimerUI();
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (remaining < 60000) {
      display.classList.remove('running');
      display.classList.add('danger');
    }
  }, 200);
}

function stopTimerUI() {
  timerRunning = false;
  if (timerInterval) clearInterval(timerInterval);
  document.getElementById('timerStartBtn').style.display = 'inline-flex';
  document.getElementById('timerStopBtn').style.display = 'none';
  const display = document.getElementById('timerDisplay');
  display.classList.remove('running', 'danger');
  updateTimerDisplay(timerDefaults[selectedDifficulty]);
}

function updateTimerDisplay(seconds) {
  if (timerRunning) return;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  document.getElementById('timerDisplay').textContent =
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Submit
async function handleSubmit() {
  const title = document.getElementById('titleInput').value.trim();
  const url = document.getElementById('urlInput').value.trim();
  const pattern = document.getElementById('patternSelect').value;
  const notes = document.getElementById('notesInput').value.trim();

  if (!title) return showMsg('Please enter a problem title', 'error');
  if (!url) return showMsg('Please enter the problem URL', 'error');
  if (!pattern) return showMsg('Please select a pattern', 'error');

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Adding…';

  const problem = {
    title,
    url,
    pattern,
    difficulty: selectedDifficulty,
    confidence: selectedConfidence,
    dataStructures: Array.from(selectedDS),
    notes,
    relatedProblems: []
  };

  chrome.runtime.sendMessage({ action: 'addProblem', problem }, (response) => {
    if (response && response.success) {
      btn.textContent = '✓ Added!';
      btn.classList.add('success');
      showMsg(`Reviews scheduled. Next: tomorrow`, 'success');
      // Stop timer if running
      if (timerRunning) {
        chrome.runtime.sendMessage({ action: 'stopTimer' });
        stopTimerUI();
      }
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Add to Graph';
        btn.classList.remove('success');
      }, 2000);
    } else {
      btn.disabled = false;
      btn.textContent = 'Add to Graph';
      showMsg(response?.error || 'Failed to add', 'error');
    }
  });
}

function showMsg(text, type) {
  const el = document.getElementById('submitMsg');
  el.textContent = text;
  el.className = `msg ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 4000);
}
