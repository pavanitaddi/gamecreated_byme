// Game engine — pure logic, no rendering.
// Keeps the snake state, handles movement, food, collisions, and scoring.
// This module is framework-agnostic so it can be tested or reused independently.

export type Cell = { x: number; y: number };
export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameStatus = 'idle' | 'running' | 'paused' | 'gameover';

export interface GameState {
  snake: Cell[];        // head is index 0
  direction: Direction; // current travel direction
  pendingDirection: Direction; // next direction to apply on next tick (prevents reversal within a tick)
  food: Cell;
  score: number;
  highScore: number;
  status: GameStatus;
  tickRate: number; // ms per tick — lower = faster
  foodEaten: number; // running count for speed calculation
}

export interface GameConfig {
  cols: number;
  rows: number;
  initialTickRate: number; // starting speed in ms
  minTickRate: number;     // fastest speed cap
  speedStep: number;       // ms shaved off per food eaten
  speedEveryN: number;     // eat N foods → speed up once
}

export const DEFAULT_CONFIG: GameConfig = {
  cols: 24,
  rows: 24,
  initialTickRate: 140,
  minTickRate: 60,
  speedStep: 8,
  speedEveryN: 3,
};

const OPPOSITES: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const DIR_VECTORS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Get the high score from localStorage (defaults to 0). */
export function getHighScore(): number {
  try {
    const v = localStorage.getItem('snake-high-score');
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Persist the high score to localStorage. */
export function saveHighScore(score: number): void {
  try {
    localStorage.setItem('snake-high-score', String(score));
  } catch {
    // ignore quota / privacy errors
  }
}

/** Create a fresh game state with the snake in the middle. */
export function createInitialState(config: GameConfig = DEFAULT_CONFIG): GameState {
  const midX = Math.floor(config.cols / 2);
  const midY = Math.floor(config.rows / 2);
  const snake: Cell[] = [
    { x: midX, y: midY },
    { x: midX - 1, y: midY },
    { x: midX - 2, y: midY },
  ];
  const state: GameState = {
    snake,
    direction: 'right',
    pendingDirection: 'right',
    food: { x: 0, y: 0 },
    score: 0,
    highScore: getHighScore(),
    status: 'idle',
    tickRate: config.initialTickRate,
    foodEaten: 0,
  };
  state.food = spawnFood(snake, config);
  return state;
}

/** Place food at a random cell not occupied by the snake. */
export function spawnFood(snake: Cell[], config: GameConfig): Cell {
  const occupied = new Set(snake.map((c) => `${c.x},${c.y}`));
  const free: Cell[] = [];
  for (let y = 0; y < config.rows; y++) {
    for (let x = 0; x < config.cols; x++) {
      if (!occupied.has(`${x},${y}`)) {
        free.push({ x, y });
      }
    }
  }
  if (free.length === 0) {
    // Board is full — you win! Return a dummy cell.
    return { x: 0, y: 0 };
  }
  return free[Math.floor(Math.random() * free.length)];
}

/**
 * Attempt to change direction. Rejects 180° reversals into the snake's body.
 * Also rejects changes that would apply within the same tick if the snake
 * is already heading the opposite way (prevents self-collision via rapid input).
 */
export function setDirection(state: GameState, dir: Direction): GameState {
  if (state.status !== 'running' && state.status !== 'paused') return state;
  // Prevent reversing directly into the body.
  if (OPPOSITES[dir] === state.direction) return state;
  // Also block reversing from a pending direction that hasn't ticked yet.
  if (OPPOSITES[dir] === state.pendingDirection) return state;
  return { ...state, pendingDirection: dir };
}

/** Compute the current speed based on how much food has been eaten. */
function computeTickRate(foodEaten: number, config: GameConfig): number {
  const stepsDown = Math.floor(foodEaten / config.speedEveryN);
  return Math.max(config.minTickRate, config.initialTickRate - stepsDown * config.speedStep);
}

/**
 * Advance the game by one tick. Returns the new state plus a flag indicating
 * whether food was eaten this tick (used to trigger sound / particles).
 */
export function tick(state: GameState, config: GameConfig = DEFAULT_CONFIG): { state: GameState; ateFood: boolean } {
  if (state.status !== 'running') return { state, ateFood: false };

  const direction = state.pendingDirection;
  const vec = DIR_VECTORS[direction];
  const head = state.snake[0];
  const newHead: Cell = { x: head.x + vec.x, y: head.y + vec.y };

  // Wall collision
  if (newHead.x < 0 || newHead.x >= config.cols || newHead.y < 0 || newHead.y >= config.rows) {
    return { state: gameOver(state), ateFood: false };
  }

  // Self collision — check against all segments except the tail, which will
  // move out of the way unless we eat food this tick.
  const willEat = newHead.x === state.food.x && newHead.y === state.food.y;
  const bodyToCheck = willEat ? state.snake : state.snake.slice(0, -1);
  for (const seg of bodyToCheck) {
    if (seg.x === newHead.x && seg.y === newHead.y) {
      return { state: gameOver(state), ateFood: false };
    }
  }

  let newSnake: Cell[];
  let newScore = state.score;
  let newFood = state.food;
  let newFoodEaten = state.foodEaten;
  let ateFood = false;

  if (willEat) {
    // Grow: prepend head, keep tail
    newSnake = [newHead, ...state.snake];
    newScore += 10;
    newFoodEaten += 1;
    ateFood = true;
    newFood = spawnFood([newHead, ...state.snake], config);
  } else {
    // Move: prepend head, drop tail
    newSnake = [newHead, ...state.snake.slice(0, -1)];
  }

  const newTickRate = computeTickRate(newFoodEaten, config);

  return {
    state: {
      ...state,
      snake: newSnake,
      direction,
      pendingDirection: direction,
      food: newFood,
      score: newScore,
      foodEaten: newFoodEaten,
      tickRate: newTickRate,
    },
    ateFood,
  };
}

/** Mark the game as over and update the high score if beaten. */
function gameOver(state: GameState): GameState {
  const newHigh = Math.max(state.highScore, state.score);
  if (newHigh > state.highScore) {
    saveHighScore(newHigh);
  }
  return {
    ...state,
    status: 'gameover',
    highScore: newHigh,
  };
}
