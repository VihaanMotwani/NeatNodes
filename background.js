// NeatNodes- Background Service Worker

const PATTERNS = [
  { id: 'arrays-hashing', name: 'Arrays & Hashing', icon: '⊞', color: '#4FC3F7' },
  { id: 'two-pointers', name: 'Two Pointers', icon: '⇄', color: '#81C784' },
  { id: 'fast-slow-pointers', name: 'Fast & Slow Pointers', icon: '⏩', color: '#AED581' },
  { id: 'sliding-window', name: 'Sliding Window', icon: '⧈', color: '#FFD54F' },
  { id: 'stack', name: 'Stack', icon: '▤', color: '#FF8A65' },
  { id: 'monotonic-stack', name: 'Monotonic Stack', icon: '▥', color: '#FF7043' },
  { id: 'binary-search', name: 'Binary Search', icon: '⟁', color: '#BA68C8' },
  { id: 'modified-binary-search', name: 'Modified Binary Search', icon: '⟐', color: '#AB47BC' },
  { id: 'linked-list', name: 'Linked List', icon: '⟶', color: '#4DD0E1' },
  { id: 'trees-bfs', name: 'Trees (BFS)', icon: '🌳', color: '#66BB6A' },
  { id: 'trees-dfs', name: 'Trees (DFS)', icon: '🌲', color: '#43A047' },
  { id: 'tries', name: 'Tries', icon: '⑂', color: '#26A69A' },
  { id: 'heap', name: 'Heap / Priority Queue', icon: '△', color: '#EF5350' },
  { id: 'two-heaps', name: 'Two Heaps', icon: '⧖', color: '#E53935' },
  { id: 'top-k', name: 'Top K Elements', icon: '⊤', color: '#EC407A' },
  { id: 'k-way-merge', name: 'K-way Merge', icon: '⥮', color: '#F06292' },
  { id: 'backtracking', name: 'Backtracking', icon: '↩', color: '#7E57C2' },
  { id: 'subsets', name: 'Subsets', icon: '⊂', color: '#9575CD' },
  { id: 'graphs-bfs-dfs', name: 'Graphs (BFS/DFS)', icon: '◈', color: '#42A5F5' },
  { id: 'advanced-graphs', name: 'Advanced Graphs', icon: '◇', color: '#1E88E5' },
  { id: 'topological-sort', name: 'Topological Sort', icon: '⇣', color: '#5C6BC0' },
  { id: 'union-find', name: 'Union Find', icon: '⊕', color: '#7986CB' },
  { id: 'dp-1d', name: '1-D Dynamic Programming', icon: '→', color: '#FFA726' },
  { id: 'dp-2d', name: '2-D Dynamic Programming', icon: '⊞', color: '#FF9800' },
  { id: 'greedy', name: 'Greedy', icon: '✦', color: '#FFCA28' },
  { id: 'intervals', name: 'Intervals / Merge Intervals', icon: '⟷', color: '#8D6E63' },
  { id: 'math-geometry', name: 'Math & Geometry', icon: '∑', color: '#78909C' },
  { id: 'bit-manipulation', name: 'Bit Manipulation', icon: '⊻', color: '#90A4AE' }
];

const DATA_STRUCTURES = [
  'Array', 'String', 'Hash Map', 'Hash Set', 'Linked List', 'Stack',
  'Queue', 'Deque', 'Heap', 'Tree', 'Binary Tree', 'BST', 'Trie',
  'Graph', 'Matrix', 'Bit Array'
];

const TIMER_DEFAULTS = {
  'Easy': 20 * 60,
  'Medium': 30 * 60,
  'Hard': 45 * 60
};

// Spaced repetition intervals (days) based on confidence
const SR_INTERVALS = {
  0: [1, 1, 3, 5, 7, 14],      // Couldn't solve
  1: [1, 2, 4, 7, 14, 30],     // Needed hints
  2: [1, 3, 7, 14, 30, 60],    // Solved with effort
  3: [1, 7, 30, 90, 180, 365]  // Nailed it
};

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['problems', 'reviews'], (result) => {
    if (!result.problems) chrome.storage.local.set({ problems: [] });
    if (!result.reviews) chrome.storage.local.set({ reviews: [] });
  });
  // Set up daily review check alarm
  chrome.alarms.create('dailyReviewCheck', {
    periodInMinutes: 60 // Check every hour
  });
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReviewCheck') {
    checkDueReviews();
  }
  if (alarm.name.startsWith('timer-')) {
    chrome.notifications.create('timer-done', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'NeatNodes — Time\'s Up!',
      message: 'Your problem timer has ended. How did it go?',
      priority: 2
    });
  }
});

function checkDueReviews() {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['reviews'], (result) => {
    const reviews = result.reviews || [];
    const due = reviews.filter(r => r.dueDate <= today && !r.completed);
    if (due.length > 0) {
      chrome.notifications.create('review-due', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'NeatNodes — Reviews Due',
        message: `You have ${due.length} problem${due.length > 1 ? 's' : ''} due for review today!`,
        priority: 1
      });
    }
  });
}

// Schedule reviews for a problem
function scheduleReviews(problemId, confidence, solvedDate) {
  const intervals = SR_INTERVALS[confidence] || SR_INTERVALS[2];
  const reviews = intervals.map((days, index) => {
    const dueDate = new Date(solvedDate);
    dueDate.setDate(dueDate.getDate() + days);
    return {
      id: `${problemId}-review-${index}`,
      problemId,
      reviewNumber: index + 1,
      dueDate: dueDate.toISOString().split('T')[0],
      completed: false,
      completedDate: null
    };
  });
  return reviews;
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPatterns') {
    sendResponse({ patterns: PATTERNS, dataStructures: DATA_STRUCTURES, timerDefaults: TIMER_DEFAULTS });
    return true;
  }

  if (request.action === 'addProblem') {
    const problem = request.problem;
    problem.id = `prob-${Date.now()}`;
    problem.createdAt = new Date().toISOString();

    const reviews = scheduleReviews(problem.id, problem.confidence, problem.createdAt);

    chrome.storage.local.get(['problems', 'reviews'], (result) => {
      const problems = result.problems || [];
      const existingReviews = result.reviews || [];

      // Check for duplicate URL
      const existing = problems.find(p => p.url === problem.url);
      if (existing) {
        sendResponse({ success: false, error: 'Problem already exists' });
        return;
      }

      problems.push(problem);
      existingReviews.push(...reviews);

      chrome.storage.local.set({ problems, reviews: existingReviews }, () => {
        sendResponse({ success: true, problem, reviews });
      });
    });
    return true;
  }

  if (request.action === 'getProblems') {
    chrome.storage.local.get(['problems'], (result) => {
      sendResponse({ problems: result.problems || [] });
    });
    return true;
  }

  if (request.action === 'getReviews') {
    chrome.storage.local.get(['reviews', 'problems'], (result) => {
      sendResponse({
        reviews: result.reviews || [],
        problems: result.problems || []
      });
    });
    return true;
  }

  if (request.action === 'completeReview') {
    chrome.storage.local.get(['reviews'], (result) => {
      const reviews = result.reviews || [];
      const review = reviews.find(r => r.id === request.reviewId);
      if (review) {
        review.completed = true;
        review.completedDate = new Date().toISOString();
        chrome.storage.local.set({ reviews }, () => {
          sendResponse({ success: true });
        });
      }
    });
    return true;
  }

  if (request.action === 'updateProblem') {
    chrome.storage.local.get(['problems', 'reviews'], (result) => {
      const problems = result.problems || [];
      let reviews = result.reviews || [];
      const idx = problems.findIndex(p => p.id === request.problem.id);
      if (idx !== -1) {
        const oldConf = problems[idx].confidence;
        problems[idx] = { ...problems[idx], ...request.problem };

        // If confidence changed, reschedule future reviews
        if (request.problem.confidence !== undefined && request.problem.confidence !== oldConf) {
          reviews = reviews.filter(r => !(r.problemId === request.problem.id && !r.completed));
          const newReviews = scheduleReviews(request.problem.id, request.problem.confidence, new Date().toISOString());
          reviews.push(...newReviews);
        }

        chrome.storage.local.set({ problems, reviews }, () => {
          sendResponse({ success: true });
        });
      }
    });
    return true;
  }

  if (request.action === 'deleteProblem') {
    chrome.storage.local.get(['problems', 'reviews'], (result) => {
      let problems = result.problems || [];
      let reviews = result.reviews || [];
      problems = problems.filter(p => p.id !== request.problemId);
      reviews = reviews.filter(r => r.problemId !== request.problemId);
      chrome.storage.local.set({ problems, reviews }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'startTimer') {
    const seconds = request.seconds || TIMER_DEFAULTS[request.difficulty] || 1800;
    chrome.alarms.create('timer-active', {
      delayInMinutes: seconds / 60
    });
    chrome.storage.local.set({
      activeTimer: {
        startTime: Date.now(),
        duration: seconds * 1000,
        problemTitle: request.problemTitle || ''
      }
    });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'stopTimer') {
    chrome.alarms.clear('timer-active');
    chrome.storage.local.remove('activeTimer');
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'getTimer') {
    chrome.storage.local.get(['activeTimer'], (result) => {
      sendResponse({ timer: result.activeTimer || null });
    });
    return true;
  }

  if (request.action === 'exportData') {
    chrome.storage.local.get(['problems', 'reviews'], (result) => {
      sendResponse({
        data: {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          problems: result.problems || [],
          reviews: result.reviews || []
        }
      });
    });
    return true;
  }

  if (request.action === 'importData') {
    const data = request.data;
    if (data && data.problems && data.reviews) {
      chrome.storage.local.set({
        problems: data.problems,
        reviews: data.reviews
      }, () => {
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: 'Invalid data format' });
    }
    return true;
  }
});
