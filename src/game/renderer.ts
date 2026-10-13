// Canvas renderer for the Snake game.
// Draws the grid, snake (with neon glow + interpolation), food, and particle effects.
// Interpolation smooths the discrete grid steps so movement looks fluid.

import type { Cell, Direction, GameConfig, GameState } from './engine';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;       // 0 → 1, decreases over time
  maxLife: number;
  color: string;
  size: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cellSize: number;
  private particles: Particle[] = [];
  private prevSnake: Cell[] = [];
  private prevDirection: Direction = 'right';
  private interpolation = 1; // 0 → 1 progress between ticks

  constructor(canvas: HTMLCanvasElement, config: GameConfig) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    this.cellSize = canvas.width / config.cols;
  }

  /** Recalculate cell size if the canvas was resized. */
  resize(config: GameConfig): void {
    this.cellSize = this.canvas.width / config.cols;
  }

  getCellSize(): number {
    return this.cellSize;
  }

  /** Record the snake's position at the start of a tick for interpolation. */
  snapshotForInterpolation(state: GameState): void {
    this.prevSnake = state.snake.map((c) => ({ ...c }));
    this.prevDirection = state.direction;
    this.interpolation = 0;
  }

  /** Update interpolation progress (0 = old position, 1 = new position). */
  setInterpolation(progress: number): void {
    this.interpolation = Math.min(1, Math.max(0, progress));
  }

  /** Spawn particle burst when food is eaten. */
  spawnParticles(gridX: number, gridY: number, color: string, count = 14): void {
    const px = (gridX + 0.5) * this.cellSize;
    const py = (gridY + 0.5) * this.cellSize;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.3,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  /** Update and draw particles. Returns false when all particles are gone. */
  private updateAndDrawParticles(dt: number): void {
    this.particles = this.particles.filter((p) => {
      p.life -= dt / (p.maxLife * 1000);
      if (p.life <= 0) return false;

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.92;
      p.vy *= 0.92;

      const alpha = p.life;
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      return true;
    });
  }

  /** Interpolate a cell position between prev and current. */
  private interpolateCell(prev: Cell | undefined, curr: Cell, index: number): Cell {
    if (!prev || this.interpolation >= 1) return curr;
    // Don't interpolate if the snake just wrapped or grew (avoid streaks)
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    // Only interpolate for small grid movements (normal step)
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return curr;
    return {
      x: prev.x + dx * this.interpolation,
      y: prev.y + dy * this.interpolation,
    };
  }

  /** Main draw function — clears and renders the entire game frame. */
  draw(state: GameState, config: GameConfig, dt: number): void {
    const { ctx, cellSize, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // Clear with dark background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    // Draw subtle grid
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= config.cols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, h);
      ctx.stroke();
    }
    for (let i = 0; i <= config.rows; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(w, i * cellSize);
      ctx.stroke();
    }

    // Draw food with pulsing glow
    this.drawFood(state.food, config);

    // Draw snake with interpolation
    this.drawSnake(state);

    // Draw border glow
    ctx.save();
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.25)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(57, 255, 20, 0.4)';
    ctx.shadowBlur = 10;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.restore();

    // Draw particles on top
    this.updateAndDrawParticles(dt);
  }

  private drawFood(food: Cell, _config: GameConfig): void {
    const { ctx, cellSize } = this;
    const cx = (food.x + 0.5) * cellSize;
    const cy = (food.y + 0.5) * cellSize;
    const pulse = 0.75 + Math.sin(Date.now() / 200) * 0.25;
    const radius = cellSize * 0.38 * pulse;

    // Outer glow
    ctx.save();
    ctx.shadowColor = '#ff10f0';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ff10f0';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff9bf6';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSnake(state: GameState): void {
    const { ctx, cellSize } = this;
    const snake = state.snake;
    if (snake.length === 0) return;

    // Draw each segment from tail to head (head drawn last, on top)
    for (let i = snake.length - 1; i >= 0; i--) {
      const curr = snake[i];
      const prev = this.prevSnake[i];
      const pos = this.interpolateCell(prev, curr, i);

      const x = pos.x * cellSize;
      const y = pos.y * cellSize;
      const isHead = i === 0;

      const pad = cellSize * 0.1;
      const size = cellSize - pad * 2;

      ctx.save();

      if (isHead) {
        // Head: bright with strong glow
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#39ff14';
        this.roundRect(ctx, x + pad, y + pad, size, size, cellSize * 0.25);
        ctx.fill();

        // Inner highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        this.roundRect(ctx, x + pad * 2, y + pad * 2, size * 0.5, size * 0.5, cellSize * 0.15);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#0a0e14';
        const eyeOffset = cellSize * 0.22;
        const eyeRadius = cellSize * 0.07;
        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2;
        const dir = state.direction;
        let e1x, e1y, e2x, e2y;
        if (dir === 'right') {
          e1x = cx + eyeOffset; e1y = cy - eyeOffset;
          e2x = cx + eyeOffset; e2y = cy + eyeOffset;
        } else if (dir === 'left') {
          e1x = cx - eyeOffset; e1y = cy - eyeOffset;
          e2x = cx - eyeOffset; e2y = cy + eyeOffset;
        } else if (dir === 'up') {
          e1x = cx - eyeOffset; e1y = cy - eyeOffset;
          e2x = cx + eyeOffset; e2y = cy - eyeOffset;
        } else {
          e1x = cx - eyeOffset; e1y = cy + eyeOffset;
          e2x = cx + eyeOffset; e2y = cy + eyeOffset;
        }
        ctx.beginPath();
        ctx.arc(e1x, e1y, eyeRadius, 0, Math.PI * 2);
        ctx.arc(e2x, e2y, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Body: gradient from head color to darker green toward tail
        const t = i / snake.length;
        const brightness = 1 - t * 0.45;
        const green = Math.floor(255 * brightness);
        const color = `rgba(57, ${green}, 20, ${0.9 - t * 0.2})`;

        ctx.shadowColor = 'rgba(57, 255, 20, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = color;
        this.roundRect(ctx, x + pad, y + pad, size, size, cellSize * 0.2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  /** Helper: draw a rounded rectangle path (does not fill). */
  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  hasParticles(): boolean {
    return this.particles.length > 0;
  }
}
