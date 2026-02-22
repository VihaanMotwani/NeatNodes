// NeatNodes - Dashboard JS

let allPatterns = [];
let allProblems = [];
let allReviews = [];
let currentFilter = 'all';
let searchQuery = '';

// ─── INIT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupTabs();
  setupFilters();
  setupSearch();
  setupExportImport();

  // Handle hash navigation
  if (window.location.hash === '#reviews') {
    switchView('reviews');
  }
});

function loadData() {
  chrome.runtime.sendMessage({ action: 'getPatterns' }, (resp) => {
    if (resp) allPatterns = resp.patterns;

    chrome.runtime.sendMessage({ action: 'getReviews' }, (resp2) => {
      if (resp2) {
        allProblems = resp2.problems || [];
        allReviews = resp2.reviews || [];
      }
      render();
    });
  });
}

function render() {
  updateStats();
  renderGraph();
  renderReviews();
  renderStatsView();
}

// ─── TABS ────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });
}

function switchView(viewName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector(`.tab[data-view="${viewName}"]`)?.classList.add('active');
  document.getElementById(`${viewName}View`)?.classList.add('active');
}

// ─── FILTERS & SEARCH ───────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderGraph();
    });
  });
}

function setupSearch() {
  const input = document.getElementById('graphSearch');
  let timeout;
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      searchQuery = input.value.trim().toLowerCase();
      renderGraph();
    }, 200);
  });
}

// ─── STATS BAR ──────────────────────────────────────────────────
function updateStats() {
  document.getElementById('totalProblems').textContent = allProblems.length;

  const today = new Date().toISOString().split('T')[0];
  const due = allReviews.filter(r => r.dueDate <= today && !r.completed);
  document.getElementById('dueToday').textContent = due.length;

  // Calculate streak
  const dates = allProblems.map(p => p.createdAt.split('T')[0]).sort().reverse();
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().split('T')[0];
    if (dates.includes(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  document.getElementById('streakCount').textContent = streak;
}

// ─── GRAPH VIEW ─────────────────────────────────────────────────
function renderGraph() {
  const grid = document.getElementById('patternGrid');
  grid.innerHTML = '';

  allPatterns.forEach((pattern, idx) => {
    let problems = allProblems.filter(p => p.pattern === pattern.id);

    // Apply difficulty filter
    if (currentFilter !== 'all') {
      problems = problems.filter(p => p.difficulty === currentFilter);
    }

    // Apply search filter
    if (searchQuery) {
      problems = problems.filter(p =>
        p.title.toLowerCase().includes(searchQuery) ||
        (p.notes && p.notes.toLowerCase().includes(searchQuery)) ||
        (p.dataStructures && p.dataStructures.some(ds => ds.toLowerCase().includes(searchQuery)))
      );
    }

    const allPatternProblems = allProblems.filter(p => p.pattern === pattern.id);
    const card = document.createElement('div');
    card.className = `pattern-card${allPatternProblems.length === 0 ? ' empty' : ''}`;
    card.style.animationDelay = `${idx * 0.02}s`;
    card.dataset.patternId = pattern.id;

    card.innerHTML = `
      <div class="pattern-header">
        <div class="pattern-info">
          <div class="pattern-icon" style="background:${pattern.color}18; color:${pattern.color}">
            ${pattern.icon}
          </div>
          <div>
            <div class="pattern-name">${pattern.name}</div>
            <div class="pattern-count">${allPatternProblems.length} problem${allPatternProblems.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${allPatternProblems.length > 0 ? `
            <div class="pattern-badge" style="background:${pattern.color}18;color:${pattern.color}">
              ${allPatternProblems.length}
            </div>
          ` : ''}
          <span class="expand-arrow">▸</span>
        </div>
      </div>
      <div class="pattern-problems">
        ${problems.length === 0 && allPatternProblems.length > 0 ? `
          <div style="padding:16px;text-align:center;color:var(--text-faint);font-size:12px;">
            No problems match current filter
          </div>
        ` : problems.length === 0 ? `
          <div style="padding:16px;text-align:center;color:var(--text-faint);font-size:12px;">
            No problems yet — add one from Leetcode!
          </div>
        ` : ''}
        ${problems.map(p => renderProblemItem(p)).join('')}
      </div>
    `;

    // Toggle expand
    card.querySelector('.pattern-header').addEventListener('click', () => {
      const wasExpanded = card.classList.contains('expanded');
      // Collapse all others
      document.querySelectorAll('.pattern-card.expanded').forEach(c => c.classList.remove('expanded'));
      if (!wasExpanded) card.classList.add('expanded');
    });

    grid.appendChild(card);

    // Attach event listeners to problem items
    card.querySelectorAll('.problem-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.small-btn')) return;
        const problemId = item.dataset.problemId;
        openSidebar(problemId);
      });
    });

    card.querySelectorAll('.open-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(btn.dataset.url, '_blank');
      });
    });

    card.querySelectorAll('.delete-problem-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this problem and all its reviews?')) {
          chrome.runtime.sendMessage({ action: 'deleteProblem', problemId: btn.dataset.id }, () => {
            loadData();
          });
        }
      });
    });
  });
}

function renderProblemItem(p) {
  const confClass = p.confidence <= 1 ? 'low' : p.confidence === 2 ? 'mid' : 'high';
  return `
    <div class="problem-item" data-problem-id="${p.id}">
      <div class="problem-left">
        <span class="diff-badge ${p.difficulty.toLowerCase()}">${p.difficulty.charAt(0)}</span>
        <span class="problem-title">${escapeHtml(p.title)}</span>
      </div>
      <div class="problem-actions">
        <div class="conf-dots">
          ${[0,1,2,3].map(i => `<div class="conf-dot${i <= p.confidence ? ` filled ${confClass}` : ''}"></div>`).join('')}
        </div>
        <button class="small-btn open-link-btn" data-url="${escapeHtml(p.url)}" title="Open problem">↗</button>
        <button class="small-btn danger delete-problem-btn" data-id="${p.id}" title="Delete">✕</button>
      </div>
    </div>
  `;
}

// ─── SIDEBAR ────────────────────────────────────────────────────
function openSidebar(problemId) {
  const problem = allProblems.find(p => p.id === problemId);
  if (!problem) return;

  const sidebar = document.getElementById('sidebar');
  const pattern = allPatterns.find(pt => pt.id === problem.pattern);
  const reviews = allReviews.filter(r => r.problemId === problemId);
  const today = new Date().toISOString().split('T')[0];

  document.getElementById('sidebarTitle').textContent = problem.title;

  const content = document.getElementById('sidebarContent');
  content.innerHTML = `
    <div class="sidebar-field">
      <div class="sidebar-field-label">Link</div>
      <a class="sidebar-link" href="${escapeHtml(problem.url)}" target="_blank">${escapeHtml(problem.url)}</a>
    </div>

    <div class="sidebar-field">
      <div class="sidebar-field-label">Pattern</div>
      <div class="sidebar-field-value" style="color:${pattern?.color || 'var(--text)'}">${pattern?.icon || ''} ${pattern?.name || problem.pattern}</div>
    </div>

    <div class="sidebar-field">
      <div class="sidebar-field-label">Difficulty</div>
      <span class="diff-badge ${problem.difficulty.toLowerCase()}">${problem.difficulty}</span>
    </div>

    <div class="sidebar-field">
      <div class="sidebar-field-label">Confidence</div>
      <div class="sidebar-field-value">${['Couldn\'t solve', 'Needed hints', 'Solved with effort', 'Nailed it'][problem.confidence]}</div>
    </div>

    ${problem.dataStructures && problem.dataStructures.length > 0 ? `
      <div class="sidebar-field">
        <div class="sidebar-field-label">Data Structures</div>
        <div class="sidebar-ds-tags">
          ${problem.dataStructures.map(ds => `<span class="sidebar-ds-tag">${escapeHtml(ds)}</span>`).join('')}
        </div>
      </div>
    ` : ''}

    ${problem.notes ? `
      <div class="sidebar-field">
        <div class="sidebar-field-label">Notes</div>
        <div class="sidebar-notes">${escapeHtml(problem.notes)}</div>
      </div>
    ` : ''}

    <div class="sidebar-field">
      <div class="sidebar-field-label">Added</div>
      <div class="sidebar-field-value">${formatDate(problem.createdAt)}</div>
    </div>

    <div class="sidebar-field">
      <div class="sidebar-field-label">Review Schedule</div>
      <div class="sidebar-reviews">
        ${reviews.map(r => `
          <div class="sidebar-review-item">
            <span>Review #${r.reviewNumber} — ${formatDate(r.dueDate)}</span>
            <span class="review-status ${r.completed ? 'done' : r.dueDate <= today ? 'due' : 'pending'}">
              ${r.completed ? '✓ Done' : r.dueDate <= today ? 'DUE' : 'Pending'}
            </span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="sidebar-danger-zone">
      <button class="delete-btn" id="sidebarDeleteBtn">Delete Problem</button>
    </div>
  `;

  document.getElementById('sidebarDeleteBtn').addEventListener('click', () => {
    if (confirm('Delete this problem and all its reviews?')) {
      chrome.runtime.sendMessage({ action: 'deleteProblem', problemId }, () => {
        closeSidebar();
        loadData();
      });
    }
  });

  sidebar.classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

document.getElementById('closeSidebar').addEventListener('click', closeSidebar);

// ─── REVIEWS VIEW ───────────────────────────────────────────────
function renderReviews() {
  const today = new Date().toISOString().split('T')[0];

  const due = allReviews.filter(r => r.dueDate <= today && !r.completed);
  const upcoming = allReviews.filter(r => r.dueDate > today && !r.completed).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  const completed = allReviews.filter(r => r.completed).sort((a,b) => (b.completedDate || '').localeCompare(a.completedDate || ''));

  renderReviewList('reviewsDueToday', due, 'due');
  renderReviewList('reviewsUpcoming', upcoming.slice(0, 20), 'upcoming');
  renderReviewList('reviewsCompleted', completed.slice(0, 20), 'completed');
}

function renderReviewList(containerId, reviews, type) {
  const container = document.getElementById(containerId);

  if (reviews.length === 0) {
    const msgs = {
      due: { emoji: '✅', msg: 'All caught up! No reviews due.' },
      upcoming: { emoji: '📅', msg: 'No upcoming reviews.' },
      completed: { emoji: '📝', msg: 'No completed reviews yet.' }
    };
    container.innerHTML = `
      <div class="empty-state">
        <div class="emoji">${msgs[type].emoji}</div>
        <div class="msg">${msgs[type].msg}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = reviews.map(r => {
    const problem = allProblems.find(p => p.id === r.problemId);
    if (!problem) return '';
    const pattern = allPatterns.find(pt => pt.id === problem.pattern);

    return `
      <div class="review-card${r.completed ? ' completed-card' : ''}" data-review-id="${r.id}">
        <div class="review-card-left">
          <div>
            <div class="review-card-title">${escapeHtml(problem.title)}</div>
            <div class="review-card-meta">
              <span style="color:${pattern?.color || 'var(--text-dim)'}">${pattern?.icon || ''} ${pattern?.name || ''}</span>
              <span class="diff-badge ${problem.difficulty.toLowerCase()}">${problem.difficulty}</span>
              <span>Review #${r.reviewNumber}</span>
              <span>${formatDate(r.dueDate)}</span>
            </div>
          </div>
        </div>
        <div class="review-card-actions">
          <button class="review-btn" onclick="window.open('${escapeHtml(problem.url)}','_blank')">Open ↗</button>
          ${!r.completed ? `<button class="review-btn complete" data-review-id="${r.id}">✓ Done</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Attach complete handlers
  container.querySelectorAll('.review-btn.complete').forEach(btn => {
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'completeReview', reviewId: btn.dataset.reviewId }, () => {
        loadData();
      });
    });
  });
}

// ─── STATS VIEW ─────────────────────────────────────────────────
function renderStatsView() {
  renderPatternCoverage();
  renderDifficultyBreakdown();
  renderConfidenceBreakdown();
  renderReviewCompliance();
  renderHeatmap();
}

function renderPatternCoverage() {
  const container = document.getElementById('patternCoverage');
  const maxCount = Math.max(...allPatterns.map(p => allProblems.filter(pr => pr.pattern === p.id).length), 1);

  container.innerHTML = allPatterns.map(pattern => {
    const count = allProblems.filter(p => p.pattern === pattern.id).length;
    const pct = (count / maxCount) * 100;
    return `
      <div class="coverage-bar-row">
        <span class="coverage-bar-label" title="${pattern.name}">${pattern.icon} ${pattern.name}</span>
        <div class="coverage-bar-track">
          <div class="coverage-bar-fill" style="width:${pct}%;background:${pattern.color}"></div>
        </div>
        <span class="coverage-bar-count">${count}</span>
      </div>
    `;
  }).join('');
}

function renderDifficultyBreakdown() {
  const container = document.getElementById('difficultyBreakdown');
  const counts = { Easy: 0, Medium: 0, Hard: 0 };
  allProblems.forEach(p => { if (counts[p.difficulty] !== undefined) counts[p.difficulty]++; });
  const total = allProblems.length || 1;

  const colors = { Easy: 'var(--green)', Medium: 'var(--yellow)', Hard: 'var(--red)' };
  container.innerHTML = Object.entries(counts).map(([diff, count]) => `
    <div class="breakdown-row">
      <div class="breakdown-dot" style="background:${colors[diff]}"></div>
      <span class="breakdown-label">${diff}</span>
      <span class="breakdown-value" style="color:${colors[diff]}">${count}</span>
      <span style="color:var(--text-faint);font-size:12px;width:40px;text-align:right">${Math.round(count/total*100)}%</span>
    </div>
  `).join('');
}

function renderConfidenceBreakdown() {
  const container = document.getElementById('confidenceBreakdown');
  const labels = ['Couldn\'t solve', 'Needed hints', 'Solved with effort', 'Nailed it'];
  const colors = ['var(--red)', 'var(--orange)', 'var(--yellow)', 'var(--green)'];
  const counts = [0, 0, 0, 0];
  allProblems.forEach(p => { if (p.confidence >= 0 && p.confidence <= 3) counts[p.confidence]++; });
  const total = allProblems.length || 1;

  container.innerHTML = counts.map((count, i) => `
    <div class="breakdown-row">
      <div class="breakdown-dot" style="background:${colors[i]}"></div>
      <span class="breakdown-label">${labels[i]}</span>
      <span class="breakdown-value" style="color:${colors[i]}">${count}</span>
      <span style="color:var(--text-faint);font-size:12px;width:40px;text-align:right">${Math.round(count/total*100)}%</span>
    </div>
  `).join('');
}

function renderReviewCompliance() {
  const container = document.getElementById('reviewCompliance');
  const today = new Date().toISOString().split('T')[0];
  const pastReviews = allReviews.filter(r => r.dueDate <= today);
  const completedOnTime = pastReviews.filter(r => r.completed);
  const overdue = pastReviews.filter(r => !r.completed);
  const total = pastReviews.length || 1;

  container.innerHTML = `
    <div class="breakdown-row">
      <div class="breakdown-dot" style="background:var(--green)"></div>
      <span class="breakdown-label">Completed</span>
      <span class="breakdown-value" style="color:var(--green)">${completedOnTime.length}</span>
      <span style="color:var(--text-faint);font-size:12px;width:40px;text-align:right">${Math.round(completedOnTime.length/total*100)}%</span>
    </div>
    <div class="breakdown-row">
      <div class="breakdown-dot" style="background:var(--red)"></div>
      <span class="breakdown-label">Overdue</span>
      <span class="breakdown-value" style="color:var(--red)">${overdue.length}</span>
      <span style="color:var(--text-faint);font-size:12px;width:40px;text-align:right">${Math.round(overdue.length/total*100)}%</span>
    </div>
  `;
}

function renderHeatmap() {
  const container = document.getElementById('activityHeatmap');
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 90);

  // Count problems per day
  const dayCounts = {};
  allProblems.forEach(p => {
    const day = p.createdAt.split('T')[0];
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  // Count completed reviews per day
  allReviews.forEach(r => {
    if (r.completed && r.completedDate) {
      const day = r.completedDate.split('T')[0];
      dayCounts[day] = (dayCounts[day] || 0) + 0.5;
    }
  });

  let cells = '';
  const d = new Date(startDate);
  while (d <= today) {
    const dateStr = d.toISOString().split('T')[0];
    const count = dayCounts[dateStr] || 0;
    let level = '';
    if (count >= 4) level = 'l4';
    else if (count >= 3) level = 'l3';
    else if (count >= 2) level = 'l2';
    else if (count >= 1) level = 'l1';
    cells += `<div class="heatmap-cell ${level}" title="${dateStr}: ${Math.floor(count)} activities"></div>`;
    d.setDate(d.getDate() + 1);
  }

  container.innerHTML = `
    <div style="margin-bottom:8px;font-size:11px;color:var(--text-faint)">Last 90 days</div>
    <div class="heatmap-grid">${cells}</div>
    <div style="display:flex;align-items:center;gap:4px;margin-top:8px;font-size:10px;color:var(--text-faint)">
      <span>Less</span>
      <div class="heatmap-cell" style="width:10px;height:10px"></div>
      <div class="heatmap-cell l1" style="width:10px;height:10px"></div>
      <div class="heatmap-cell l2" style="width:10px;height:10px"></div>
      <div class="heatmap-cell l3" style="width:10px;height:10px"></div>
      <div class="heatmap-cell l4" style="width:10px;height:10px"></div>
      <span>More</span>
    </div>
  `;
}

// ─── EXPORT / IMPORT ────────────────────────────────────────────
function setupExportImport() {
  document.getElementById('exportBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'exportData' }, (response) => {
      if (response && response.data) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `neatnodes-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  });

  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (confirm(`Import ${data.problems?.length || 0} problems and ${data.reviews?.length || 0} reviews? This will replace all existing data.`)) {
          chrome.runtime.sendMessage({ action: 'importData', data }, (response) => {
            if (response && response.success) {
              loadData();
              alert('Data imported successfully!');
            } else {
              alert('Import failed: ' + (response?.error || 'Unknown error'));
            }
          });
        }
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

// ─── HELPERS ────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const ds = dateStr.split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (ds === todayStr) return 'Today';
  if (ds === tomorrowStr) return 'Tomorrow';
  if (ds === yesterdayStr) return 'Yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}
