import { useState, useEffect, useRef } from 'react';

interface BuzzerProps {
  active: boolean;
  onHold: () => void;
  onRelease: () => void;
  disabled?: boolean;
  timeBank?: number;
}

function Buzzer({ active, onHold, onRelease, disabled = false, timeBank = 0 }: BuzzerProps) {
  const [touchStarted, setTouchStarted] = useState(false);
  const [localActive, setLocalActive] = useState(false); // Local active state 
  const [holdTime, setHoldTime] = useState(0);
  const [displayTime, setDisplayTime] = useState('00:00.0');
  const startTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  // Sync the local active state with the prop
  useEffect(() => {
    setLocalActive(active);
  }, [active]);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    // Start timing and call the hold function
    setLocalActive(true);
    startTimeRef.current = Date.now();
    onHold();
    startTimer();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    // Only release if we're currently active
    if (localActive) {
      stopTimer();
      onRelease();
      setLocalActive(false);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    if (localActive) {
      stopTimer();
      onRelease();
      setLocalActive(false);
    }
  };

  // Handle touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setTouchStarted(true);
    // Start timing and call hold
    setLocalActive(true);
    startTimeRef.current = Date.now();
    onHold();
    startTimer();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setTouchStarted(false);
    // Stop timing and release
    if (localActive) {
      stopTimer();
      onRelease();
      setLocalActive(false);
    }
  };

  // Timer functions
  const startTimer = () => {
    if (!startTimeRef.current) return;
    
    const updateTimer = () => {
      if (startTimeRef.current && localActive) {
        const elapsed = Date.now() - startTimeRef.current;
        const seconds = elapsed / 1000;
        
        // Format time as MM:SS.T
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const formattedTime = `${String(mins).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
        
        setHoldTime(elapsed);
        setDisplayTime(formattedTime);
        
        // Calculate remaining time bank
        const remainingTimeBank = Math.max(0, timeBank - seconds);
        const remainingMins = Math.floor(remainingTimeBank / 60);
        const remainingSecs = remainingTimeBank % 60;
        const remainingDisplay = `${remainingMins}:${remainingSecs.toFixed(1).padStart(4, '0')}`;
        
        // Update the remaining time display
        const timeBankEl = document.getElementById('player-timebank');
        if (timeBankEl) {
          timeBankEl.textContent = remainingDisplay;
        }
        
        // Keep the timer running only if we're still active
        if (localActive) {
          animationRef.current = requestAnimationFrame(updateTimer);
        }
      }
    };
    
    // Initial call to set things up
    updateTimer();
  };

  const stopTimer = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    startTimeRef.current = null;
    setHoldTime(0);
    setDisplayTime('00:00.0');
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (active) {
        onRelease();
      }
    };
  }, [active, onRelease]);

  return (
    <div 
      className={`w-56 h-56 rounded-full bg-primary flex flex-col items-center justify-center shadow-lg transition-all duration-200 ${localActive ? 'bg-secondary buzzer-active' : 'buzzer-shadow'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
            : localActive 
              ? "HOLDING..." 
              : "HOLD TO BID"
          }
        </div>
        
        {localActive && (
          <div className="text-2xl font-bold mt-2">
            {displayTime}
          </div>
        )}
        
        <div className="text-sm opacity-80 mt-1">
          {!localActive ? "Longest hold wins the round" : "Time remaining"}
        </div>
      </div>
    </div>
  );
}

export default Buzzer;
