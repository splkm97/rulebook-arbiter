const PRESETS = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
  custom: { rows: 12, cols: 20, mines: 45 },
};

const LIMITS = {
  minRows: 6,
  maxRows: 30,
  minCols: 6,
  maxCols: 40,
  minMines: 1,
};

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const refs = {
  board: document.getElementById("board"),
  boardSection: document.getElementById("board-section"),
  presetSelect: document.getElementById("preset-select"),
  customConfig: document.getElementById("custom-config"),
  rowsInput: document.getElementById("rows-input"),
  colsInput: document.getElementById("cols-input"),
  minesInput: document.getElementById("mines-input"),
  applyCustomButton: document.getElementById("apply-custom-button"),
  newGameButton: document.getElementById("new-game-button"),
  stateValue: document.getElementById("state-value"),
  minesValue: document.getElementById("mines-value"),
  timerValue: document.getElementById("timer-value"),
  tapModeButton: document.getElementById("tap-mode-button"),
  hintText: document.getElementById("hint-text"),
};

const state = {
  rows: PRESETS.beginner.rows,
  cols: PRESETS.beginner.cols,
  mines: PRESETS.beginner.mines,
  board: [],
  status: "ready",
  firstMove: true,
  revealedSafeCells: 0,
  flaggedCells: 0,
  timerSeconds: 0,
  timerId: null,
  interactionMode: "reveal",
  prefersCoarsePointer: window.matchMedia("(pointer: coarse)").matches,
};

init();

function init() {
  bindEvents();
  refs.tapModeButton.hidden = !state.prefersCoarsePointer;
  if (state.prefersCoarsePointer) {
    refs.hintText.textContent =
      "Tap mode toggles between reveal and flag. Double tap a revealed number to chord open nearby cells.";
  }
  setCustomInputValues(PRESETS.custom);
  startNewGame(PRESETS.beginner);
}

function bindEvents() {
  refs.presetSelect.addEventListener("change", handlePresetChange);
  refs.applyCustomButton.addEventListener("click", () => {
    refs.presetSelect.value = "custom";
    refs.customConfig.hidden = false;
    startNewGame(readCustomConfig());
  });
  refs.newGameButton.addEventListener("click", () => {
    startNewGame(resolveSelectedConfig());
  });
  refs.tapModeButton.addEventListener("click", () => {
    state.interactionMode = state.interactionMode === "reveal" ? "flag" : "reveal";
    updateHud();
  });
  refs.board.addEventListener("click", handleBoardClick);
  refs.board.addEventListener("contextmenu", handleBoardContextMenu);
  refs.board.addEventListener("dblclick", handleBoardDoubleClick);
  window.addEventListener("resize", renderBoard);
}

function handlePresetChange() {
  const selected = refs.presetSelect.value;
  const isCustom = selected === "custom";
  refs.customConfig.hidden = !isCustom;
  startNewGame(resolveSelectedConfig());
}

function resolveSelectedConfig() {
  const selected = refs.presetSelect.value;
  if (selected === "custom") {
    return readCustomConfig();
  }
  return PRESETS[selected] || PRESETS.beginner;
}

function readCustomConfig() {
  const requested = {
    rows: Number.parseInt(refs.rowsInput.value, 10),
    cols: Number.parseInt(refs.colsInput.value, 10),
    mines: Number.parseInt(refs.minesInput.value, 10),
  };
  const normalized = normalizeConfig(requested);
  setCustomInputValues(normalized);
  return normalized;
}

function setCustomInputValues(config) {
  refs.rowsInput.value = String(config.rows);
  refs.colsInput.value = String(config.cols);
  refs.minesInput.value = String(config.mines);
}

function normalizeConfig(config) {
  const rows = clamp(config.rows, LIMITS.minRows, LIMITS.maxRows);
  const cols = clamp(config.cols, LIMITS.minCols, LIMITS.maxCols);
  const maxMines = rows * cols - 1;
  const mines = clamp(config.mines, LIMITS.minMines, maxMines);
  return { rows, cols, mines };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function startNewGame(config) {
  const normalized = normalizeConfig(config);
  clearTimer();
  state.rows = normalized.rows;
  state.cols = normalized.cols;
  state.mines = normalized.mines;
  state.board = createEmptyBoard(state.rows, state.cols);
  state.status = "ready";
  state.firstMove = true;
  state.revealedSafeCells = 0;
  state.flaggedCells = 0;
  state.timerSeconds = 0;
  state.interactionMode = "reveal";
  render();
}

function createEmptyBoard(rows, cols) {
  const board = [];
  for (let row = 0; row < rows; row += 1) {
    const rowCells = [];
    for (let col = 0; col < cols; col += 1) {
      rowCells.push({
        row,
        col,
        isMine: false,
        adjacentMines: 0,
        revealed: false,
        flagged: false,
        exploded: false,
        wrongFlag: false,
      });
    }
    board.push(rowCells);
  }
  return board;
}

function handleBoardClick(event) {
  const targetCell = getEventCell(event);
  if (!targetCell) {
    return;
  }
  if (state.prefersCoarsePointer && state.interactionMode === "flag") {
    toggleFlag(targetCell.row, targetCell.col);
  } else {
    revealCell(targetCell.row, targetCell.col);
  }
  render();
}

function handleBoardContextMenu(event) {
  event.preventDefault();
  const targetCell = getEventCell(event);
  if (!targetCell) {
    return;
  }
  toggleFlag(targetCell.row, targetCell.col);
  render();
}

function handleBoardDoubleClick(event) {
  const targetCell = getEventCell(event);
  if (!targetCell) {
    return;
  }
  chordReveal(targetCell.row, targetCell.col);
  render();
}

function getEventCell(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }
  const cell = target.closest(".cell");
  if (!(cell instanceof HTMLElement)) {
    return null;
  }
  const row = Number.parseInt(cell.dataset.row || "", 10);
  const col = Number.parseInt(cell.dataset.col || "", 10);
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return null;
  }
  return { row, col };
}

function revealCell(row, col) {
  if (state.status === "lost" || state.status === "won") {
    return;
  }

  const cell = state.board[row][col];
  if (cell.revealed || cell.flagged) {
    return;
  }

  ensureGameStarted(row, col);

  if (cell.isMine) {
    loseGame(row, col);
    return;
  }

  floodReveal(row, col);
  if (didWin()) {
    winGame();
  }
}

function ensureGameStarted(firstRow, firstCol) {
  if (!state.firstMove) {
    return;
  }

  placeMines(firstRow, firstCol);
  calculateAdjacentCounts();
  state.firstMove = false;
  state.status = "playing";
  startTimer();
}

function placeMines(firstRow, firstCol) {
  const protectedCells = getProtectedCells(firstRow, firstCol);
  const candidates = [];

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const key = toKey(row, col);
      if (!protectedCells.has(key)) {
        candidates.push([row, col]);
      }
    }
  }

  shuffleInPlace(candidates);

  for (let index = 0; index < state.mines; index += 1) {
    const [row, col] = candidates[index];
    state.board[row][col].isMine = true;
  }
}

function getProtectedCells(firstRow, firstCol) {
  const singleCellProtection = new Set([toKey(firstRow, firstCol)]);
  const neighborhoodProtection = new Set(singleCellProtection);

  for (const [deltaRow, deltaCol] of DIRECTIONS) {
    const row = firstRow + deltaRow;
    const col = firstCol + deltaCol;
    if (isInside(row, col)) {
      neighborhoodProtection.add(toKey(row, col));
    }
  }

  const totalCells = state.rows * state.cols;
  const canProtectNeighborhood = totalCells - neighborhoodProtection.size >= state.mines;
  return canProtectNeighborhood ? neighborhoodProtection : singleCellProtection;
}

function shuffleInPlace(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = temp;
  }
}

function calculateAdjacentCounts() {
  forEachCell((cell) => {
    if (cell.isMine) {
      cell.adjacentMines = 0;
      return;
    }
    let minesAround = 0;
    for (const [row, col] of neighborsOf(cell.row, cell.col)) {
      if (state.board[row][col].isMine) {
        minesAround += 1;
      }
    }
    cell.adjacentMines = minesAround;
  });
}

function floodReveal(startRow, startCol) {
  const queue = [[startRow, startCol]];
  const queued = new Set([toKey(startRow, startCol)]);
  let index = 0;

  while (index < queue.length) {
    const [row, col] = queue[index];
    index += 1;

    const cell = state.board[row][col];
    if (cell.revealed || cell.flagged || cell.isMine) {
      continue;
    }

    cell.revealed = true;
    state.revealedSafeCells += 1;

    if (cell.adjacentMines !== 0) {
      continue;
    }

    for (const [nextRow, nextCol] of neighborsOf(row, col)) {
      const neighbor = state.board[nextRow][nextCol];
      const key = toKey(nextRow, nextCol);
      if (neighbor.revealed || neighbor.flagged || neighbor.isMine || queued.has(key)) {
        continue;
      }
      queued.add(key);
      queue.push([nextRow, nextCol]);
    }
  }
}

function chordReveal(row, col) {
  if (state.status === "lost" || state.status === "won") {
    return;
  }

  const origin = state.board[row][col];
  if (!origin.revealed || origin.adjacentMines === 0) {
    return;
  }

  const neighbors = neighborsOf(row, col);
  let flaggedNeighbors = 0;
  for (const [neighborRow, neighborCol] of neighbors) {
    if (state.board[neighborRow][neighborCol].flagged) {
      flaggedNeighbors += 1;
    }
  }

  if (flaggedNeighbors !== origin.adjacentMines) {
    return;
  }

  for (const [neighborRow, neighborCol] of neighbors) {
    const neighbor = state.board[neighborRow][neighborCol];
    if (neighbor.revealed || neighbor.flagged) {
      continue;
    }
    if (neighbor.isMine) {
      loseGame(neighborRow, neighborCol);
      return;
    }
    floodReveal(neighborRow, neighborCol);
  }

  if (didWin()) {
    winGame();
  }
}

function toggleFlag(row, col) {
  if (state.status === "lost" || state.status === "won") {
    return;
  }

  const cell = state.board[row][col];
  if (cell.revealed) {
    return;
  }

  cell.flagged = !cell.flagged;
  state.flaggedCells += cell.flagged ? 1 : -1;
}

function didWin() {
  const safeCellCount = state.rows * state.cols - state.mines;
  return state.revealedSafeCells === safeCellCount;
}

function winGame() {
  state.status = "won";
  clearTimer();

  forEachCell((cell) => {
    if (cell.isMine && !cell.flagged) {
      cell.flagged = true;
      state.flaggedCells += 1;
    }
  });
}

function loseGame(explodedRow, explodedCol) {
  state.status = "lost";
  clearTimer();

  forEachCell((cell) => {
    if (cell.isMine) {
      cell.revealed = true;
    }
    if (cell.flagged && !cell.isMine) {
      cell.wrongFlag = true;
    }
  });

  state.board[explodedRow][explodedCol].exploded = true;
}

function startTimer() {
  clearTimer();
  state.timerId = window.setInterval(() => {
    state.timerSeconds = Math.min(state.timerSeconds + 1, 999);
    updateHud();
  }, 1000);
}

function clearTimer() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function forEachCell(callback) {
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      callback(state.board[row][col]);
    }
  }
}

function neighborsOf(row, col) {
  const neighbors = [];
  for (const [deltaRow, deltaCol] of DIRECTIONS) {
    const nextRow = row + deltaRow;
    const nextCol = col + deltaCol;
    if (isInside(nextRow, nextCol)) {
      neighbors.push([nextRow, nextCol]);
    }
  }
  return neighbors;
}

function isInside(row, col) {
  return row >= 0 && row < state.rows && col >= 0 && col < state.cols;
}

function toKey(row, col) {
  return `${row},${col}`;
}

function render() {
  renderBoard();
  updateHud();
}

function renderBoard() {
  const maxWidth = refs.boardSection.clientWidth - 24;
  const sizeFromWidth = Math.floor(maxWidth / state.cols);
  const cellSize = clamp(sizeFromWidth, 20, 38);

  refs.board.style.setProperty("--cell-size", `${cellSize}px`);
  refs.board.style.gridTemplateColumns = `repeat(${state.cols}, var(--cell-size))`;

  const fragment = document.createDocumentFragment();

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const cell = state.board[row][col];
      const element = document.createElement("button");
      element.type = "button";
      element.className = "cell";
      element.dataset.row = String(row);
      element.dataset.col = String(col);
      element.setAttribute("role", "gridcell");

      if (cell.revealed) {
        element.classList.add("revealed");
      }

      if (cell.revealed && cell.isMine) {
        element.classList.add("mine");
        element.textContent = "*";
      } else if (cell.revealed && cell.adjacentMines > 0) {
        element.dataset.adjacent = String(cell.adjacentMines);
        element.textContent = String(cell.adjacentMines);
      } else if (cell.flagged) {
        element.classList.add("flagged");
        element.textContent = "F";
      }

      if (cell.wrongFlag) {
        element.classList.add("wrong-flag");
        element.textContent = "X";
      }

      if (cell.exploded) {
        element.classList.add("exploded");
        element.textContent = "*";
      }

      element.setAttribute("aria-label", buildCellLabel(cell));
      fragment.appendChild(element);
    }
  }

  refs.board.replaceChildren(fragment);
}

function buildCellLabel(cell) {
  const rowLabel = cell.row + 1;
  const colLabel = cell.col + 1;
  if (!cell.revealed && !cell.flagged) {
    return `Hidden cell row ${rowLabel} column ${colLabel}`;
  }
  if (cell.flagged && !cell.revealed) {
    return `Flagged cell row ${rowLabel} column ${colLabel}`;
  }
  if (cell.revealed && cell.isMine) {
    return `Mine at row ${rowLabel} column ${colLabel}`;
  }
  if (cell.adjacentMines === 0) {
    return `Revealed empty cell row ${rowLabel} column ${colLabel}`;
  }
  return `Revealed cell with ${cell.adjacentMines} adjacent mines at row ${rowLabel} column ${colLabel}`;
}

function updateHud() {
  const statusLabel = {
    ready: "Ready",
    playing: "Playing",
    won: "Won",
    lost: "Lost",
  }[state.status];

  refs.stateValue.textContent = statusLabel;
  refs.timerValue.textContent = String(state.timerSeconds).padStart(3, "0");
  refs.minesValue.textContent = String(state.mines - state.flaggedCells).padStart(3, " ").trimStart();

  refs.tapModeButton.textContent = `Tap mode: ${state.interactionMode}`;
}
