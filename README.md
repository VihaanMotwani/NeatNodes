# NeatNodes — Chrome Extension

A pattern-based DSA learning tracker with graph visualization, timed practice, and spaced repetition reviews.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `NeatNodes` folder
5. Pin the extension to your toolbar for quick access

## Features

### Quick Capture (Popup)
- Click the extension icon on any **Leetcode** or **Neetcode** page
- Auto-detects problem title, URL, and difficulty
- Select pattern, rate your confidence, tag data structures
- Start a **difficulty-based timer** (Easy: 20min, Medium: 30min, Hard: 45min)
- One-click add to your graph

### Pattern Graph (Dashboard)
- All **28 DSA patterns** organized as expandable nodes
- Click any pattern to see all problems underneath
- Filter by difficulty (Easy/Medium/Hard) and search by title
- Click a problem to see full details in the sidebar
- Click "↗" to jump back to the original problem link

### Spaced Repetition Reviews
- Reviews auto-scheduled based on your **confidence rating**:
  - **Couldn't solve** → Review at day 1, 1, 3, 5, 7, 14
  - **Needed hints** → Review at day 1, 2, 4, 7, 14, 30
  - **Solved with effort** → Review at day 1, 3, 7, 14, 30, 60
  - **Nailed it** → Review at day 1, 7, 30, 90, 180, 365
- Chrome notifications when reviews are due
- Mark reviews complete from the Reviews tab

### Stats
- Pattern coverage across all 28 patterns
- Difficulty and confidence distribution
- Review compliance rate
- 90-day activity heatmap

### Data
- **Export** your data as JSON for backup anytime
- **Import** from a previous backup
- All data stored locally in Chrome — no server, no account needed

## The 28 Patterns

| # | Pattern | # | Pattern |
|---|---------|---|---------|
| 1 | Arrays & Hashing | 15 | Top K Elements |
| 2 | Two Pointers | 16 | K-way Merge |
| 3 | Fast & Slow Pointers | 17 | Backtracking |
| 4 | Sliding Window | 18 | Subsets |
| 5 | Stack | 19 | Graphs (BFS/DFS) |
| 6 | Monotonic Stack | 20 | Advanced Graphs |
| 7 | Binary Search | 21 | Topological Sort |
| 8 | Modified Binary Search | 22 | Union Find |
| 9 | Linked List | 23 | 1-D Dynamic Programming |
| 10 | Trees (BFS) | 24 | 2-D Dynamic Programming |
| 11 | Trees (DFS) | 25 | Greedy |
| 12 | Tries | 26 | Intervals / Merge Intervals |
| 13 | Heap / Priority Queue | 27 | Math & Geometry |
| 14 | Two Heaps | 28 | Bit Manipulation |
