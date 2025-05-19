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
  // Only update local state from props when props change from inactive to active
  useEffect(() => {
    if (active !== localActive && active === true) {
      setLocalActive(true);
    } else if (active === false && !startTimeRef.current) {
      // Only set to inactive if we're not currently timing
      setLocalActive(false);
    }
  }, [active, localActive]);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    // Start timing and call the hold function
    if (!localActive) {
      console.log('Mouse down - starting timer');
      setLocalActive(true);
      startTimeRef.current = Date.now(); // Set start time
      startTimer(); // Start the timer animation
      onHold(); // Call parent callback
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    // Only release if we're currently active
    if (localActive) {
      console.log('Mouse up - stopping timer');
      const finalHoldTime = holdTime > 0 ? holdTime : 0;
      stopTimer();
      setLocalActive(false);
      onRelease();
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    if (localActive) {
      console.log('Mouse leave - stopping timer');
      const finalHoldTime = holdTime > 0 ? holdTime : 0;
      stopTimer();
      setLocalActive(false);
      onRelease();
    }
  };

  // Handle touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    // Start timing and call hold
    if (!localActive) {
      console.log('Touch start - starting timer');
      setTouchStarted(true);
      setLocalActive(true);
      startTimeRef.current = Date.now();
      startTimer();
      onHold();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    // Stop timing and release
    if (localActive) {
      console.log('Touch end - stopping timer');
      setTouchStarted(false);
      const finalHoldTime = holdTime > 0 ? holdTime : 0;
      stopTimer();
      setLocalActive(false);
      onRelease();
    }
  };

  // Timer functions
  const startTimer = () => {
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }
    
    const updateTimer = () => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        const seconds = elapsed / 1000;
        
        // Format time as SS.SS
        const formattedTime = seconds.toFixed(1) + "s";
        
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
        
        // Continue the animation frame loop
        animationRef.current = requestAnimationFrame(updateTimer);
      }
    };
    
    // Start the animation loop immediately
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
        {localActive ? (
          <>
            <div className="font-display text-lg font-medium">
              HOLDING...
            </div>
            <div className="text-2xl font-bold mt-2">
              {displayTime}
            </div>
            <div className="text-sm opacity-80 mt-1">
              Time spent
            </div>
          </>
        ) : (
          <>
            <div className="font-display text-lg font-medium">
              {disabled ? "BUZZER DISABLED" : "HOLD TO BID"}
            </div>
            <div className="text-sm opacity-80 mt-4">
              Longest hold wins the round
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Buzzer;
