import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Direction,
  type GameConfig,
  type GameState,
  DEFAULT_CONFIG,
  createInitialState,
  setDirection as engineSetDirection,
  tick as engineTick,
} from './engine';
import { Renderer } from './renderer';
import { SoundManager } from './sound';

// React hook that ties the game engine, renderer, and sound together.
// Manages the requestAnimationFrame loop, keyboard / touch input, and exposes
// the game state + control functions to the UI component.

export type GameStatus = GameState['status'];

export interface SnakeGameApi {
  state: GameState;
  muted: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  toggleMute: () => void;
  setDirection: (dir: Direction) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function useSnakeGame(config: GameConfig = DEFAULT_CONFIG): SnakeGameApi {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const soundRef = useRef<SoundManager>(new SoundManager());
  const stateRef = useRef<GameState>(createInitialState(config));
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const tickAccumulatorRef = useRef<number>(0);

  // We mirror the engine state into React state for the UI (score, status, etc.)
  const [state, setState] = useState<GameState>(() => createInitialState(config));
  const [muted, setMuted] = useState<boolean>(() => soundRef.current.isMuted());

  // Sync React state from the ref (called after each tick or status change)
  const syncState = useCallback(() => {
    setState({ ...stateRef.current });
  }, []);

  /** Resize the canvas to match its display size (device-pixel-ratio aware). */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    // Determine the largest square that fits in the parent
    const parentW = parent.clientWidth;
    const parentH = parent.clientHeight;
    const size = Math.min(parentW, parentH);

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);

    if (rendererRef.current) {
      rendererRef.current.resize(config);
    }
  }, [config]);

  // ---- Game control functions ----

  const start = useCallback(() => {
    const s = stateRef.current;
    if (s.status === 'running') return;
    soundRef.current.resume();
    if (s.status === 'idle' || s.status === 'gameover') {
      // Fresh start
      stateRef.current = createInitialState(config);
      stateRef.current.status = 'running';
    } else if (s.status === 'paused') {
      stateRef.current = { ...s, status: 'running' };
    }
    lastTickRef.current = performance.now();
    tickAccumulatorRef.current = 0;
    syncState();
    soundRef.current.play('start');
  }, [config, syncState]);

  const pause = useCallback(() => {
    if (stateRef.current.status !== 'running') return;
    stateRef.current = { ...stateRef.current, status: 'paused' };
    syncState();
  }, [syncState]);

  const resume = useCallback(() => {
    if (stateRef.current.status !== 'paused') return;
    soundRef.current.resume();
    stateRef.current = { ...stateRef.current, status: 'running' };
    lastTickRef.current = performance.now();
    tickAccumulatorRef.current = 0;
    syncState();
  }, [syncState]);

  const restart = useCallback(() => {
    stateRef.current = createInitialState(config);
    stateRef.current.status = 'running';
    lastTickRef.current = performance.now();
    tickAccumulatorRef.current = 0;
    syncState();
    soundRef.current.resume();
    soundRef.current.play('start');
  }, [config, syncState]);

  const toggleMute = useCallback(() => {
    const m = soundRef.current.toggleMute();
    setMuted(m);
  }, []);

  const setDirection = useCallback((dir: Direction) => {
    stateRef.current = engineSetDirection(stateRef.current, dir);
  }, []);

  // ---- Keyboard input ----

  useEffect(() => {
    const KEY_MAP: Record<string, Direction> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Space: pause / resume toggle
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (stateRef.current.status === 'running') pause();
        else if (stateRef.current.status === 'paused') resume();
        else if (stateRef.current.status === 'idle' || stateRef.current.status === 'gameover') start();
        return;
      }

      const dir = KEY_MAP[e.key];
      if (dir) {
        e.preventDefault();
        // Auto-start if idle
        if (stateRef.current.status === 'idle') {
          start();
        }
        setDirection(dir);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [start, pause, resume, setDirection]);

  // ---- Resize observer ----

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resizeCanvas]);

  // ---- Main game loop (requestAnimationFrame) ----

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current = new Renderer(canvas, config);

    const loop = (now: number) => {
      const renderer = rendererRef.current;
      if (!renderer) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const dt = now - lastFrameRef.current;
      lastFrameRef.current = now;

      const s = stateRef.current;

      if (s.status === 'running') {
        // Accumulate time and tick when enough has passed
        tickAccumulatorRef.current += now - lastTickRef.current;
        lastTickRef.current = now;

        while (tickAccumulatorRef.current >= s.tickRate) {
          // Snapshot for interpolation before ticking
          renderer.snapshotForInterpolation(s);
          const { state: newState, ateFood } = engineTick(s, config);
          stateRef.current = newState;
          tickAccumulatorRef.current -= s.tickRate;

          if (ateFood) {
            soundRef.current.play('eat');
            renderer.spawnParticles(newState.food.x, newState.food.y, '#ff10f0');
          }

          if (newState.status === 'gameover') {
            soundRef.current.play('gameover');
            syncState();
            break;
          }
        }

        // Set interpolation progress for smooth movement
        renderer.setInterpolation(tickAccumulatorRef.current / s.tickRate);

        // Sync UI state periodically (every frame is fine, React will dedupe)
        if (stateRef.current.score !== state.score || stateRef.current.status !== state.status) {
          syncState();
        }
      } else {
        // Not running — no interpolation
        renderer.setInterpolation(1);
        // Still keep lastTickRef fresh so resume doesn't jump
        lastTickRef.current = now;
      }

      // Always render (so paused / gameover still show the board + particles)
      renderer.draw(stateRef.current, config, dt);
      rafRef.current = requestAnimationFrame(loop);
    };

    lastFrameRef.current = performance.now();
    lastTickRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    muted,
    start,
    pause,
    resume,
    restart,
    toggleMute,
    setDirection,
    canvasRef,
  };
}
