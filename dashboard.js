// NeatNodes - Dashboard JS

let allPatterns = [];
let allProblems = [];
let allReviews = [];
let currentFilter = 'all';
let searchQuery = '';
let currentGraphMode = 'force'; // 'force' or 'grid'

// ─── PATTERN EDGES (conceptual relationships) ──────────────────
const PATTERN_EDGES = [
  ['arrays-hashing', 'two-pointers'],
  ['arrays-hashing', 'sliding-window'],
  ['arrays-hashing', 'binary-search'],
  ['two-pointers', 'fast-slow-pointers'],
  ['two-pointers', 'linked-list'],
  ['fast-slow-pointers', 'linked-list'],
  ['stack', 'monotonic-stack'],
  ['binary-search', 'modified-binary-search'],
  ['trees-bfs', 'trees-dfs'],
  ['trees-bfs', 'heap'],
  ['trees-dfs', 'tries'],
  ['trees-dfs', 'backtracking'],
  ['heap', 'two-heaps'],
  ['heap', 'top-k'],
  ['top-k', 'k-way-merge'],
  ['backtracking', 'subsets'],
  ['graphs-bfs-dfs', 'advanced-graphs'],
  ['graphs-bfs-dfs', 'topological-sort'],
  ['graphs-bfs-dfs', 'union-find'],
  ['dp-1d', 'dp-2d'],
  ['dp-1d', 'greedy'],
  ['greedy', 'intervals'],
  ['math-geometry', 'bit-manipulation'],
  ['sliding-window', 'two-pointers'],
  ['trees-bfs', 'graphs-bfs-dfs'],
];

// ─── FORCE GRAPH STATE ──────────────────────────────────────────
let graphNodes = [];   // { id, x, y, vx, vy, radius, pattern, problemCount, pinned }
let graphEdges = [];   // { source: nodeIndex, target: nodeIndex }
let canvas, ctx;
let animFrameId = null;
let hoveredNode = null;
let draggedNode = null;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let camera = { x: 0, y: 0, zoom: 1 };
let lastMouseCanvas = { x: 0, y: 0 };

// ─── INIT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupTabs();
  setupFilters();
  setupSearch();
  setupExportImport();
  setupViewToggle();
  setupForceGraph();

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
  buildGraphNodes();
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
      updateNodeHighlights();
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
      updateNodeHighlights();
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

    card.style.setProperty('--card-accent', pattern.color);
    card.innerHTML = `
      <div class="pattern-header">
        <div class="pattern-info">
          <span class="pattern-icon" style="color:${pattern.color}">${pattern.icon}</span>
          <div>
            <div class="pattern-name">${pattern.name}</div>
            <div class="pattern-count">${allPatternProblems.length} problem${allPatternProblems.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${allPatternProblems.length > 0 ? `
            <span class="pattern-badge" style="color:${pattern.color}">${allPatternProblems.length}</span>
          ` : ''}
          <span class="expand-arrow">></span>
        </div>
      </div>
      <div class="pattern-problems">
        ${problems.length === 0 && allPatternProblems.length > 0 ? `
          <div style="padding:16px;text-align:center;color:var(--text-3);font-size:12px;">
            No problems match current filter
          </div>
        ` : problems.length === 0 ? `
          <div style="padding:16px;text-align:center;color:var(--text-3);font-size:12px;">
            No problems added yet
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
          ${[0, 1, 2, 3].map(i => `<div class="conf-dot${i <= p.confidence ? ` filled ${confClass}` : ''}"></div>`).join('')}
        </div>
        <button class="small-btn open-link-btn" data-url="${escapeHtml(p.url)}" title="Open problem">open</button>
        <button class="small-btn danger delete-problem-btn" data-id="${p.id}" title="Delete">del</button>
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
      <div class="sidebar-field-value" style="color:${pattern?.color || 'var(--text-2)'}">${pattern?.name || problem.pattern}</div>
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
            <span>Review #${r.reviewNumber} / ${formatDate(r.dueDate)}</span>
            <span class="review-status ${r.completed ? 'done' : r.dueDate <= today ? 'due' : 'pending'}">
              ${r.completed ? 'done' : r.dueDate <= today ? 'due' : 'pending'}
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
  const upcoming = allReviews.filter(r => r.dueDate > today && !r.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const completed = allReviews.filter(r => r.completed).sort((a, b) => (b.completedDate || '').localeCompare(a.completedDate || ''));

  renderReviewList('reviewsDueToday', due, 'due');
  renderReviewList('reviewsUpcoming', upcoming.slice(0, 20), 'upcoming');
  renderReviewList('reviewsCompleted', completed.slice(0, 20), 'completed');
}

function renderReviewList(containerId, reviews, type) {
  const container = document.getElementById(containerId);

  if (reviews.length === 0) {
    const msgs = {
      due: 'No reviews due.',
      upcoming: 'No upcoming reviews.',
      completed: 'No completed reviews yet.'
    };
    container.innerHTML = `
      <div class="empty-state">
        <div class="msg">${msgs[type]}</div>
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
              <span style="color:${pattern?.color || 'var(--text-3)'}">${pattern?.name || ''}</span>
              <span class="diff-badge ${problem.difficulty.toLowerCase()}">${problem.difficulty}</span>
              <span>Review #${r.reviewNumber}</span>
              <span>${formatDate(r.dueDate)}</span>
            </div>
          </div>
        </div>
        <div class="review-card-actions">
          <button class="review-btn" onclick="window.open('${escapeHtml(problem.url)}','_blank')">open</button>
          ${!r.completed ? `<button class="review-btn complete" data-review-id="${r.id}">done</button>` : ''}
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
        <span class="coverage-bar-label" title="${pattern.name}">${pattern.name}</span>
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

  const colors = { Easy: 'var(--easy)', Medium: 'var(--medium)', Hard: 'var(--hard)' };
  container.innerHTML = Object.entries(counts).map(([diff, count]) => `
    <div class="breakdown-row">
      <div class="breakdown-dot" style="background:${colors[diff]}"></div>
      <span class="breakdown-label">${diff}</span>
      <span class="breakdown-value" style="color:${colors[diff]}">${count}</span>
      <span style="color:var(--text-3);font-size:12px;width:40px;text-align:right">${Math.round(count / total * 100)}%</span>
    </div>
  `).join('');
}

function renderConfidenceBreakdown() {
  const container = document.getElementById('confidenceBreakdown');
  const labels = ['Couldn\'t solve', 'Needed hints', 'Solved with effort', 'Nailed it'];
  const colors = ['var(--hard)', '#e8986c', 'var(--medium)', 'var(--easy)'];
  const counts = [0, 0, 0, 0];
  allProblems.forEach(p => { if (p.confidence >= 0 && p.confidence <= 3) counts[p.confidence]++; });
  const total = allProblems.length || 1;

  container.innerHTML = counts.map((count, i) => `
    <div class="breakdown-row">
      <div class="breakdown-dot" style="background:${colors[i]}"></div>
      <span class="breakdown-label">${labels[i]}</span>
      <span class="breakdown-value" style="color:${colors[i]}">${count}</span>
      <span style="color:var(--text-3);font-size:12px;width:40px;text-align:right">${Math.round(count / total * 100)}%</span>
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
      <div class="breakdown-dot" style="background:var(--easy)"></div>
      <span class="breakdown-label">Completed</span>
      <span class="breakdown-value" style="color:var(--easy)">${completedOnTime.length}</span>
      <span style="color:var(--text-3);font-size:12px;width:40px;text-align:right">${Math.round(completedOnTime.length / total * 100)}%</span>
    </div>
    <div class="breakdown-row">
      <div class="breakdown-dot" style="background:var(--hard)"></div>
      <span class="breakdown-label">Overdue</span>
      <span class="breakdown-value" style="color:var(--hard)">${overdue.length}</span>
      <span style="color:var(--text-3);font-size:12px;width:40px;text-align:right">${Math.round(overdue.length / total * 100)}%</span>
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
    <div style="margin-bottom:8px;font-size:11px;color:var(--text-3)">Last 90 days</div>
    <div class="heatmap-grid">${cells}</div>
    <div style="display:flex;align-items:center;gap:4px;margin-top:8px;font-size:10px;color:var(--text-3)">
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

// ─── VIEW TOGGLE ────────────────────────────────────────────────
function setupViewToggle() {
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentGraphMode = btn.dataset.mode;

      const canvasWrapper = document.getElementById('canvasWrapper');
      const gridContainer = document.getElementById('graphContainer');

      if (currentGraphMode === 'force') {
        canvasWrapper.classList.remove('hidden');
        gridContainer.classList.add('hidden');
        resizeCanvas();
        startSimulation();
      } else {
        canvasWrapper.classList.add('hidden');
        gridContainer.classList.remove('hidden');
        stopSimulation();
      }
    });
  });
}

// ─── FORCE GRAPH SETUP ──────────────────────────────────────────
function setupForceGraph() {
  canvas = document.getElementById('graphCanvas');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Mouse events
  canvas.addEventListener('mousedown', onCanvasMouseDown);
  canvas.addEventListener('mousemove', onCanvasMouseMove);
  canvas.addEventListener('mouseup', onCanvasMouseUp);
  canvas.addEventListener('mouseleave', onCanvasMouseLeave);
  canvas.addEventListener('wheel', onCanvasWheel, { passive: false });
  canvas.addEventListener('dblclick', onCanvasDblClick);
}

function resizeCanvas() {
  if (!canvas) return;
  const wrapper = document.getElementById('canvasWrapper');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = wrapper.clientWidth * dpr;
  canvas.height = wrapper.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function buildGraphNodes() {
  const idToIndex = {};
  graphNodes = allPatterns.map((p, i) => {
    idToIndex[p.id] = i;
    const problemCount = allProblems.filter(pr => pr.pattern === p.id).length;
    const existing = graphNodes.find(n => n.id === p.id);
    return {
      id: p.id,
      x: existing ? existing.x : (canvas ? canvas.width / (2 * (window.devicePixelRatio || 1)) : 600) + (Math.random() - 0.5) * 400,
      y: existing ? existing.y : (canvas ? canvas.height / (2 * (window.devicePixelRatio || 1)) : 400) + (Math.random() - 0.5) * 300,
      vx: 0,
      vy: 0,
      radius: 24 + Math.log(problemCount + 1) * 8,
      pattern: p,
      problemCount,
      pinned: false,
      opacity: 1
    };
  });

  graphEdges = [];
  PATTERN_EDGES.forEach(([srcId, tgtId]) => {
    const src = idToIndex[srcId];
    const tgt = idToIndex[tgtId];
    if (src !== undefined && tgt !== undefined) {
      // Avoid duplicate edges
      const exists = graphEdges.some(e =>
        (e.source === src && e.target === tgt) || (e.source === tgt && e.target === src)
      );
      if (!exists) graphEdges.push({ source: src, target: tgt });
    }
  });

  updateNodeHighlights();
  if (currentGraphMode === 'force') startSimulation();
}

function updateNodeHighlights() {
  graphNodes.forEach(node => {
    let problems = allProblems.filter(p => p.pattern === node.id);

    if (currentFilter !== 'all') {
      problems = problems.filter(p => p.difficulty === currentFilter);
    }
    if (searchQuery) {
      problems = problems.filter(p =>
        p.title.toLowerCase().includes(searchQuery) ||
        (p.notes && p.notes.toLowerCase().includes(searchQuery)) ||
        (p.dataStructures && p.dataStructures.some(ds => ds.toLowerCase().includes(searchQuery)))
      );
    }

    if (currentFilter === 'all' && !searchQuery) {
      node.opacity = 1;
    } else {
      node.opacity = problems.length > 0 ? 1 : 0.15;
    }
  });
}

// ─── SIMULATION ─────────────────────────────────────────────────
function startSimulation() {
  if (animFrameId) return;
  simulationTick();
}

function stopSimulation() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function simulationTick() {
  physicsTick();
  drawGraph();
  animFrameId = requestAnimationFrame(simulationTick);
}

function physicsTick() {
  const REPULSION = 8000;
  const SPRING_K = 0.004;
  const SPRING_REST = 160;
  const CENTER_GRAVITY = 0.01;
  const DAMPING = 0.85;

  const wrapper = document.getElementById('canvasWrapper');
  const cx = wrapper.clientWidth / 2;
  const cy = wrapper.clientHeight / 2;

  // Repulsion between all pairs
  for (let i = 0; i < graphNodes.length; i++) {
    for (let j = i + 1; j < graphNodes.length; j++) {
      const a = graphNodes[i];
      const b = graphNodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      let force = REPULSION / (dist * dist);
      let fx = (dx / dist) * force;
      let fy = (dy / dist) * force;
      if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
      if (!b.pinned) { b.vx += fx; b.vy += fy; }
    }
  }

  // Spring force along edges
  graphEdges.forEach(edge => {
    const a = graphNodes[edge.source];
    const b = graphNodes[edge.target];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dist = Math.sqrt(dx * dx + dy * dy) || 1;
    let displacement = dist - SPRING_REST;
    let force = SPRING_K * displacement;
    let fx = (dx / dist) * force;
    let fy = (dy / dist) * force;
    if (!a.pinned) { a.vx += fx; a.vy += fy; }
    if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
  });

  // Center gravity
  graphNodes.forEach(node => {
    if (node.pinned) return;
    node.vx += (cx - node.x) * CENTER_GRAVITY;
    node.vy += (cy - node.y) * CENTER_GRAVITY;
  });

  // Apply velocity with damping
  graphNodes.forEach(node => {
    if (node.pinned) return;
    node.vx *= DAMPING;
    node.vy *= DAMPING;
    node.x += node.vx;
    node.y += node.vy;
  });
}

// ─── DRAWING ────────────────────────────────────────────────────
function drawGraph() {
  if (!ctx || !canvas) return;
  const wrapper = document.getElementById('canvasWrapper');
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  // Draw edges — visible gray with arrowheads
  graphEdges.forEach(edge => {
    const a = graphNodes[edge.source];
    const b = graphNodes[edge.target];
    const edgeOpacity = Math.min(a.opacity, b.opacity);

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Shorten edge to stop at node radius
    const offsetA = a.radius;
    const offsetB = b.radius;
    const ax = a.x + (dx / dist) * offsetA;
    const ay = a.y + (dy / dist) * offsetA;
    const bx = b.x - (dx / dist) * offsetB;
    const by = b.y - (dy / dist) * offsetB;

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = `rgba(120, 124, 136, ${0.4 * edgeOpacity})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Arrowhead at target end
    const arrowLen = 8;
    const arrowAngle = Math.PI / 7;
    const angle = Math.atan2(by - ay, bx - ax);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - arrowLen * Math.cos(angle - arrowAngle), by - arrowLen * Math.sin(angle - arrowAngle));
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - arrowLen * Math.cos(angle + arrowAngle), by - arrowLen * Math.sin(angle + arrowAngle));
    ctx.strokeStyle = `rgba(120, 124, 136, ${0.4 * edgeOpacity})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Draw nodes — solid filled circles with white text
  graphNodes.forEach((node, i) => {
    const isHovered = hoveredNode === i;
    const r = isHovered ? node.radius + 4 : node.radius;
    const color = node.pattern.color;

    ctx.globalAlpha = node.opacity;

    // Hover glow
    if (isHovered) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
    }

    // Solid fill
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Slightly darker stroke
    ctx.strokeStyle = darkenHex(color, 0.25);
    ctx.lineWidth = 2;
    ctx.stroke();

    if (isHovered) {
      ctx.restore();
    }

    // White abbreviation text inside
    ctx.font = `bold ${Math.round(r * 0.5)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(node.pattern.icon, node.x, node.y);

    // Label below node
    ctx.font = '500 10px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isHovered ? '#e0e0e6' : `rgba(138,140,150,${node.opacity})`;
    ctx.fillText(node.pattern.name, node.x, node.y + r + 8);

    ctx.globalAlpha = 1;
  });

  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darkenHex(hex, amount) {
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)));
  return `rgb(${r},${g},${b})`;
}

// ─── MOUSE INTERACTIONS ─────────────────────────────────────────
function screenToWorld(sx, sy) {
  return {
    x: (sx - camera.x) / camera.zoom,
    y: (sy - camera.y) / camera.zoom
  };
}

function findNodeAt(wx, wy) {
  for (let i = graphNodes.length - 1; i >= 0; i--) {
    const n = graphNodes[i];
    const dx = n.x - wx;
    const dy = n.y - wy;
    if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) return i;
  }
  return -1;
}

function onCanvasMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const { x, y } = screenToWorld(sx, sy);

  const nodeIdx = findNodeAt(x, y);
  if (nodeIdx >= 0) {
    draggedNode = nodeIdx;
    graphNodes[nodeIdx].pinned = true;
    canvas.style.cursor = 'grabbing';
  } else {
    isPanning = true;
    panStart = { x: e.clientX - camera.x, y: e.clientY - camera.y };
    canvas.style.cursor = 'grabbing';
  }
}

function onCanvasMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  lastMouseCanvas = { x: sx, y: sy };
  const { x: wx, y: wy } = screenToWorld(sx, sy);

  if (draggedNode !== null) {
    graphNodes[draggedNode].x = wx;
    graphNodes[draggedNode].y = wy;
    return;
  }

  if (isPanning) {
    camera.x = e.clientX - panStart.x;
    camera.y = e.clientY - panStart.y;
    hideTooltip();
    return;
  }

  // Hover detection
  const nodeIdx = findNodeAt(wx, wy);
  if (nodeIdx >= 0) {
    if (hoveredNode !== nodeIdx) {
      hoveredNode = nodeIdx;
      showTooltip(graphNodes[nodeIdx], sx, sy);
    }
    canvas.style.cursor = 'pointer';
  } else {
    if (hoveredNode !== null) {
      hoveredNode = null;
      hideTooltip();
    }
    canvas.style.cursor = 'grab';
  }
}

function onCanvasMouseUp(e) {
  if (draggedNode !== null) {
    graphNodes[draggedNode].pinned = false;
    draggedNode = null;
  }

  if (isPanning) {
    isPanning = false;
  }

  // Check for click on node (not a drag)
  const rect = canvas.getBoundingClientRect();
  const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const nodeIdx = findNodeAt(x, y);
  canvas.style.cursor = nodeIdx >= 0 ? 'pointer' : 'grab';
}

function onCanvasMouseLeave() {
  if (draggedNode !== null) {
    graphNodes[draggedNode].pinned = false;
    draggedNode = null;
  }
  isPanning = false;
  hoveredNode = null;
  hideTooltip();
  canvas.style.cursor = 'grab';
}

function onCanvasWheel(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  const zoomFactor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
  const newZoom = Math.max(0.3, Math.min(3, camera.zoom * zoomFactor));

  // Zoom toward cursor
  camera.x = sx - (sx - camera.x) * (newZoom / camera.zoom);
  camera.y = sy - (sy - camera.y) * (newZoom / camera.zoom);
  camera.zoom = newZoom;
}

function onCanvasDblClick(e) {
  const rect = canvas.getBoundingClientRect();
  const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const nodeIdx = findNodeAt(x, y);
  if (nodeIdx >= 0) {
    const node = graphNodes[nodeIdx];
    // Expand pattern card in grid, or open sidebar with first problem
    const problems = allProblems.filter(p => p.pattern === node.id);
    if (problems.length > 0) {
      openSidebar(problems[0].id);
    } else {
      // Switch to grid and expand the pattern card
      switchGraphMode('grid');
      setTimeout(() => {
        const card = document.querySelector(`.pattern-card[data-pattern-id="${node.id}"]`);
        if (card) {
          card.classList.add('expanded');
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }
}

function switchGraphMode(mode) {
  currentGraphMode = mode;
  document.querySelectorAll('.view-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  const canvasWrapper = document.getElementById('canvasWrapper');
  const gridContainer = document.getElementById('graphContainer');
  if (mode === 'force') {
    canvasWrapper.classList.remove('hidden');
    gridContainer.classList.add('hidden');
    resizeCanvas();
    startSimulation();
  } else {
    canvasWrapper.classList.add('hidden');
    gridContainer.classList.remove('hidden');
    stopSimulation();
  }
}

// ─── TOOLTIP ────────────────────────────────────────────────────
function showTooltip(node, sx, sy) {
  const tooltip = document.getElementById('graphTooltip');
  const problems = allProblems.filter(p => p.pattern === node.id);
  const maxShow = 5;

  let problemsHtml = '';
  if (problems.length > 0) {
    const sliced = problems.slice(0, maxShow);
    problemsHtml = `<div class="tt-problems">${sliced.map(p =>
      `<div class="tt-problem"><span class="diff-badge ${p.difficulty.toLowerCase()}" style="font-size:9px;padding:1px 4px;margin-right:4px">${p.difficulty.charAt(0)}</span>${escapeHtml(p.title)}</div>`
    ).join('')}${problems.length > maxShow ? `<div class="tt-problem" style="color:var(--text-3)">+${problems.length - maxShow} more</div>` : ''}</div>`;
  }

  tooltip.innerHTML = `
    <div class="tt-name" style="color:${node.pattern.color}">
      <span>${node.pattern.name}</span>
    </div>
    <div class="tt-count">${node.problemCount} problem${node.problemCount !== 1 ? 's' : ''} tracked</div>
    ${problemsHtml}
  `;

  // Position tooltip
  const wrapper = document.getElementById('canvasWrapper');
  const wRect = wrapper.getBoundingClientRect();
  let tx = sx + 16;
  let ty = sy - 10;

  // Keep tooltip within bounds
  if (tx + 260 > wRect.width) tx = sx - 270;
  if (ty + tooltip.offsetHeight > wRect.height) ty = wRect.height - tooltip.offsetHeight - 10;
  if (ty < 10) ty = 10;

  tooltip.style.left = tx + 'px';
  tooltip.style.top = ty + 'px';
  tooltip.classList.add('visible');
}

function hideTooltip() {
  document.getElementById('graphTooltip').classList.remove('visible');
}


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
