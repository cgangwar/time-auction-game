import { useState, useEffect, useRef, useCallback } from 'react';

interface BuzzerProps {
  active: boolean;
  onHold: () => void;
  onRelease: (holdTime: number) => void;
  disabled?: boolean;
  timeBank?: number;
}

interface BuzzerProps {
  active: boolean;
  onHold: () => void;
  onRelease: (holdTime: number) => void; // Updated to accept holdTime
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
  const onReleaseRef = useRef(onRelease); // Ref to hold the latest onRelease callback

  // Keep onReleaseRef updated with the latest onRelease prop
  useEffect(() => {
    onReleaseRef.current = onRelease;
  }, [onRelease]);

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
      onRelease(finalHoldTime);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    if (localActive) {
      console.log('Mouse leave - stopping timer');
      const finalHoldTime = holdTime > 0 ? holdTime : 0;
      stopTimer();
      setLocalActive(false);
      onRelease(finalHoldTime);
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
      onRelease(finalHoldTime);
    }
  };

  // Timer functions
  const stopTimer = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    startTimeRef.current = null;
    setHoldTime(0);
    setDisplayTime('00:00.0');
    setLocalActive(false); // Ensure local state is consistent
  }, []); // Stable: depends only on setters from useState

  const startTimer = useCallback(() => {
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }
    
    const updateTimer = () => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        const seconds = elapsed / 1000;
        const formattedTime = seconds.toFixed(1) + "s";
        
        setHoldTime(elapsed);
        setDisplayTime(formattedTime);
        
        const remainingTimeBank = Math.max(0, timeBank - seconds);
        const timeBankEl = document.getElementById('player-timebank');
        if (timeBankEl) {
          const remainingMins = Math.floor(remainingTimeBank / 60);
          const remainingSecs = remainingTimeBank % 60;
          timeBankEl.textContent = `${remainingMins}:${remainingSecs.toFixed(1).padStart(4, '0')}`;
        }
        
        animationRef.current = requestAnimationFrame(updateTimer);
      }
    };
    updateTimer();
  }, [timeBank]); // timeBank is a prop, include if it can change during hold

  // Effect to handle external deactivation by `active` prop (from parent)
  useEffect(() => {
    // If the parent tells us to be inactive, and we locally think we are active
    if (!active && localActive) {
      console.log('Buzzer: active prop turned false. Stopping timer and calling onRelease.');
      stopTimer();
      // setLocalActive(false); // stopTimer now handles this
      onReleaseRef.current(0); // Call latest onRelease with 0 hold time
    }
  }, [active, localActive, stopTimer]);

  // Effect for actual component unmount cleanup
  useEffect(() => {
    return () => {
      console.log('Buzzer: Component unmounted. Cleaning up animation frame.');
      if (animationRef.current) { // If animation was running
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        // If timer was running when unmounted (e.g. user navigated away while holding)
        if (startTimeRef.current) {
          console.log('Buzzer: Unmounted while timer was active. Calling latest onRelease.');
          const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
          onReleaseRef.current(elapsed); // Call the latest onRelease with elapsed time
        }
      }
    };
  }, []); // Empty dependency array: runs only on mount, cleans up only on unmount.

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
