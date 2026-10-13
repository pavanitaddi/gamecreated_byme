import { useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Gamepad2,
  Trophy,
  Target,
  Zap,
  Keyboard,
} from 'lucide-react';
import { useSnakeGame } from '@/game/useSnakeGame';
import type { Direction } from '@/game/engine';

export default function SnakeGame() {
  const game = useSnakeGame();
  const { state, muted } = game;

  // Touch / D-pad handler — prevent default to avoid scrolling
  const handleDir = useCallback(
    (dir: Direction) => (e: React.PointerEvent) => {
      e.preventDefault();
      if (state.status === 'idle') game.start();
      game.setDirection(dir);
    },
    [game, state.status],
  );

  const speedLevel = Math.floor(state.foodEaten / 3) + 1;
  const isNewHighScore = state.status === 'gameover' && state.score > 0 && state.score >= state.highScore;

  return (
    <div className="bg-grid min-h-screen w-full flex flex-col items-center px-3 py-4 sm:px-6 sm:py-6 overflow-y-auto">
      {/* Header */}
      <header className="w-full max-w-5xl flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg neon-border flex items-center justify-center bg-emerald-950/50">
            <Gamepad2 className="w-6 h-6 text-[#39ff14]" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-black tracking-wider neon-text text-[#39ff14]">
              NEON SNAKE
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-500 tracking-widest uppercase">Arcade Edition</p>
          </div>
        </div>

        <button
          onClick={game.toggleMute}
          className="w-10 h-10 rounded-lg neon-border flex items-center justify-center bg-gray-900/80 hover:bg-emerald-950/50 transition-colors"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX className="w-5 h-5 text-gray-500" /> : <Volume2 className="w-5 h-5 text-[#39ff14]" />}
        </button>
      </header>

      {/* Score Bar */}
      <div className="w-full max-w-5xl grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <ScoreCard icon={<Target className="w-4 h-4" />} label="Score" value={state.score} color="cyan" />
        <ScoreCard icon={<Trophy className="w-4 h-4" />} label="High Score" value={state.highScore} color="yellow" />
        <ScoreCard icon={<Zap className="w-4 h-4" />} label="Speed" value={`Lv ${speedLevel}`} color="green" />
      </div>

      {/* Main game area */}
      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-4 sm:gap-6 items-center lg:items-start justify-center">
        {/* Canvas + overlays */}
        <div className="relative flex-shrink-0">
          <div
            className="relative scanlines neon-border rounded-xl overflow-hidden bg-[#0a0e14]"
            style={{ width: 'min(92vw, 560px)', height: 'min(92vw, 560px)' }}
          >
            <canvas ref={game.canvasRef} className="block no-touch-scroll w-full h-full" />

            {/* Idle overlay */}
            {state.status === 'idle' && (
              <Overlay>
                <div className="text-center animate-scale-in">
                  <Gamepad2 className="w-12 h-12 text-[#39ff14] mx-auto mb-3 animate-pulse-glow" />
                  <h2 className="font-display text-2xl font-black neon-text text-[#39ff14] mb-2">READY?</h2>
                  <p className="text-gray-400 text-sm mb-4">Use arrow keys, WASD, or the D-pad to move</p>
                  <button onClick={game.start} className="neon-btn">
                    <Play className="inline w-4 h-4 mr-1" /> Start Game
                  </button>
                </div>
              </Overlay>
            )}

            {/* Paused overlay */}
            {state.status === 'paused' && (
              <Overlay>
                <div className="text-center animate-scale-in">
                  <Pause className="w-12 h-12 text-[#00f0ff] mx-auto mb-3" />
                  <h2 className="font-display text-2xl font-black neon-text-cyan text-[#00f0ff] mb-4">PAUSED</h2>
                  <button onClick={game.resume} className="neon-btn neon-btn-cyan">
                    <Play className="inline w-4 h-4 mr-1" /> Resume
                  </button>
                </div>
              </Overlay>
            )}

            {/* Game Over overlay */}
            {state.status === 'gameover' && (
              <Overlay>
                <div className="text-center animate-scale-in">
                  <h2 className="font-display text-3xl font-black neon-text-pink text-[#ff10f0] mb-2">GAME OVER</h2>
                  {isNewHighScore && (
                    <p className="font-display text-sm text-[#ffea00] neon-text-cyan mb-2 animate-pulse-glow">
                      ★ NEW HIGH SCORE ★
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-6 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Score</p>
                      <p className="font-display text-2xl font-bold text-[#39ff14] neon-text">{state.score}</p>
                    </div>
                    <div className="w-px h-10 bg-gray-700" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Best</p>
                      <p className="font-display text-2xl font-bold text-[#ffea00]">{state.highScore}</p>
                    </div>
                  </div>
                  <button onClick={game.restart} className="neon-btn neon-btn-pink">
                    <RotateCcw className="inline w-4 h-4 mr-1" /> Play Again
                  </button>
                </div>
              </Overlay>
            )}
          </div>

          {/* Control buttons (below canvas) */}
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {state.status === 'idle' && (
              <button onClick={game.start} className="neon-btn">
                <Play className="inline w-4 h-4 mr-1" /> Start
              </button>
            )}
            {state.status === 'running' && (
              <button onClick={game.pause} className="neon-btn neon-btn-cyan">
                <Pause className="inline w-4 h-4 mr-1" /> Pause
              </button>
            )}
            {state.status === 'paused' && (
              <button onClick={game.resume} className="neon-btn neon-btn-cyan">
                <Play className="inline w-4 h-4 mr-1" /> Resume
              </button>
            )}
            {(state.status === 'running' || state.status === 'paused' || state.status === 'gameover') && (
              <button onClick={game.restart} className="neon-btn neon-btn-pink">
                <RotateCcw className="inline w-4 h-4 mr-1" /> Restart
              </button>
            )}
          </div>
        </div>

        {/* Side panel: instructions + D-pad */}
        <div className="w-full max-w-xs flex flex-col gap-4">
          {/* Instructions */}
          <div className="neon-border rounded-xl bg-gray-900/80 p-4">
            <h3 className="font-display text-sm font-bold text-[#39ff14] mb-3 flex items-center gap-2">
              <Keyboard className="w-4 h-4" /> HOW TO PLAY
            </h3>
            <ul className="space-y-2 text-xs text-gray-400 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-[#39ff14] mt-0.5">▸</span>
                Use <Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>←</Kbd> <Kbd>→</Kbd> or <Kbd>W</Kbd> <Kbd>A</Kbd> <Kbd>S</Kbd> <Kbd>D</Kbd> to steer
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#39ff14] mt-0.5">▸</span>
                Press <Kbd>Space</Kbd> to pause / resume
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#ff10f0] mt-0.5">▸</span>
                Eat the pink food to grow and score points
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#ffea00] mt-0.5">▸</span>
                Speed increases every 3 foods eaten
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#ff10f0] mt-0.5">▸</span>
                Don't hit the walls or your own tail!
              </li>
            </ul>
          </div>

          {/* Touch D-pad (always visible, primary for mobile) */}
          <div className="neon-border rounded-xl bg-gray-900/80 p-4 lg:hidden">
            <h3 className="font-display text-sm font-bold text-[#00f0ff] mb-3 text-center">D-PAD</h3>
            <div className="grid grid-cols-3 gap-2 w-44 mx-auto">
              <div />
              <DpadButton onPointerDown={handleDir('up')}>
                <ChevronUp className="w-7 h-7" />
              </DpadButton>
              <div />
              <DpadButton onPointerDown={handleDir('left')}>
                <ChevronLeft className="w-7 h-7" />
              </DpadButton>
              <div className="flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[#39ff14]/30 shadow-[0_0_8px_rgba(57,255,20,0.4)]" />
              </div>
              <DpadButton onPointerDown={handleDir('right')}>
                <ChevronRight className="w-7 h-7" />
              </DpadButton>
              <div />
              <DpadButton onPointerDown={handleDir('down')}>
                <ChevronDown className="w-7 h-7" />
              </DpadButton>
              <div />
            </div>
          </div>

          {/* Desktop D-pad hint */}
          <div className="neon-border-cyan rounded-xl bg-gray-900/80 p-4 hidden lg:block">
            <h3 className="font-display text-sm font-bold text-[#00f0ff] mb-2">STATUS</h3>
            <div className="space-y-1 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>State</span>
                <span className={
                  state.status === 'running' ? 'text-[#39ff14]' :
                  state.status === 'paused' ? 'text-[#00f0ff]' :
                  state.status === 'gameover' ? 'text-[#ff10f0]' : 'text-gray-500'
                }>
                  {state.status.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Length</span>
                <span className="text-gray-300">{state.snake.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Food eaten</span>
                <span className="text-gray-300">{state.foodEaten}</span>
              </div>
              <div className="flex justify-between">
                <span>Tick rate</span>
                <span className="text-gray-300">{state.tickRate}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-6 text-xs text-gray-600 text-center">
        Built with React, Canvas, and the Web Audio API
      </footer>
    </div>
  );
}

// ---- Small presentational sub-components ----

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm z-10">
      {children}
    </div>
  );
}

function ScoreCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'green' | 'cyan' | 'yellow';
}) {
  const colorMap = {
    green: 'text-[#39ff14] neon-text border-[#39ff14]/30',
    cyan: 'text-[#00f0ff] neon-text-cyan border-[#00f0ff]/30',
    yellow: 'text-[#ffea00] border-[#ffea00]/30',
  };
  return (
    <div className={`rounded-xl bg-gray-900/80 border ${colorMap[color]} px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        <span className={colorMap[color].split(' ')[0]}>{icon}</span>
        <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider hidden sm:inline">{label}</span>
      </div>
      <span className={`font-display text-lg sm:text-2xl font-bold ${colorMap[color].split(' ')[0]} ${colorMap[color].split(' ')[1]}`}>
        {value}
      </span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded border border-gray-600 bg-gray-800 text-gray-300 text-[10px] font-mono">
      {children}
    </kbd>
  );
}

function DpadButton({ children, onPointerDown }: { children: React.ReactNode; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <button
      onPointerDown={onPointerDown}
      className="w-12 h-12 rounded-lg neon-border bg-gray-800/80 flex items-center justify-center text-[#39ff14] active:bg-[#39ff14]/20 active:shadow-[0_0_15px_rgba(57,255,20,0.4)] transition-all no-touch-scroll"
    >
      {children}
    </button>
  );
}
