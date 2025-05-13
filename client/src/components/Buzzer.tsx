import { useState, useEffect } from 'react';

interface BuzzerProps {
  active: boolean;
  onHold: () => void;
  onRelease: () => void;
  disabled?: boolean;
}

function Buzzer({ active, onHold, onRelease, disabled = false }: BuzzerProps) {
  const [touchStarted, setTouchStarted] = useState(false);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    onHold();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    onRelease();
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    if (active) {
      onRelease();
    }
  };

  // Handle touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setTouchStarted(true);
    onHold();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setTouchStarted(false);
    onRelease();
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (active) {
        onRelease();
      }
    };
  }, [active, onRelease]);

  return (
    <div 
      className={`w-56 h-56 rounded-full bg-primary flex items-center justify-center shadow-lg transition-all duration-200 ${active ? 'buzzer-active' : 'buzzer-shadow'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="text-center text-white">
        <div className="font-display text-lg font-medium">
          {disabled 
            ? "BUZZER DISABLED" 
            : active 
              ? "HOLDING..." 
              : "HOLD TO BID"
          }
        </div>
        <div className="text-sm opacity-80 mt-1">Longest hold wins the round</div>
      </div>
    </div>
  );
}

export default Buzzer;
