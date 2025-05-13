interface GameStartingOverlayProps {
  countdown: number;
}

function GameStartingOverlay({ countdown }: GameStartingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
      <div className="text-center text-white px-6">
        <h2 className="font-display text-2xl font-bold mb-2">Game Starting</h2>
        <p className="text-white/80 mb-6">Get ready! The game will begin in:</p>
        
        <div className="font-display text-6xl font-bold text-primary mb-8 countdown pulse-animation">
          {countdown}
        </div>
        
        <div className="text-white/80 text-sm">
          <p className="mb-1"><span className="font-medium">Remember:</span> Hold the buzzer as long as you dare!</p>
          <p>The longer you hold, the more time you spend from your bank.</p>
        </div>
      </div>
    </div>
  );
}

export default GameStartingOverlay;
