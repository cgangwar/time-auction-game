import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useGame } from "@/contexts/GameContext";
import { useQuery } from "@tanstack/react-query";
import AppHeader from "@/components/AppHeader";
import Buzzer from "@/components/Buzzer";
import PlayerTokens from "@/components/PlayerTokens";
import GameStartingOverlay from "@/components/GameStartingOverlay";
import { useToast } from "@/hooks/use-toast";

function Game() {
  const [, params] = useRoute("/game/:id");
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { 
    connectToGame, 
    gameState, 
    buzzerHold, 
    buzzerRelease, 
    disconnectFromGame 
  } = useGame();
  const { toast } = useToast();
  
  const gameId = params?.id ? parseInt(params.id) : undefined;
  
  // Buzzer state
  const [buzzerActive, setBuzzerActive] = useState(false);
  const [buzzerStartTime, setBuzzerStartTime] = useState<number | null>(null);
  const [buzzerHoldTime, setBuzzerHoldTime] = useState(0);
  const [commonTime, setCommonTime] = useState("00:00.0");
  const animationRef = useRef<number | null>(null);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    // Connect to the game WebSocket
    if (gameId && user) {
      connectToGame(gameId, user.id);
    }
    
    // Cleanup when leaving the page
    return () => {
      if (gameId) {
        disconnectFromGame();
      }
    };
  }, [gameId, user, navigate, connectToGame, disconnectFromGame]);
  
  // Handle buzzer hold event
  const handleBuzzerDown = useCallback(() => {
    if (!gameState || !user) return;
    if (gameState.status !== 'in_progress') return;
    if (buzzerActive) return;
    
    const currentPlayer = gameState.players.find(p => p.id === user.id);
    if (!currentPlayer || currentPlayer.isEliminated) return;
    
    const currentTime = Date.now();
    setBuzzerActive(true);
    setBuzzerStartTime(currentTime);
    buzzerHold(gameId as number, user.id);
    
    // Start the animation frame for updating the timer
    const updateTimer = () => {
      if (buzzerStartTime) {
        const elapsed = Date.now() - buzzerStartTime;
        const seconds = elapsed / 1000;
        
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const formattedTime = `${String(mins).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
        
        setCommonTime(formattedTime);
        setBuzzerHoldTime(elapsed);
        
        animationRef.current = requestAnimationFrame(updateTimer);
      }
    };
    
    animationRef.current = requestAnimationFrame(updateTimer);
  }, [buzzerActive, buzzerStartTime, gameId, gameState, user, buzzerHold]);
  
  // Handle buzzer release event
  const handleBuzzerUp = useCallback(() => {
    if (!buzzerActive || !gameState || !user || !gameId) return;
    
    setBuzzerActive(false);
    
    // Cancel animation frame
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Send the buzzer release event with hold time
    if (buzzerHoldTime > 0) {
      buzzerRelease(gameId, user.id, buzzerHoldTime);
    }
    
    // Reset buzzer state
    setBuzzerStartTime(null);
    setBuzzerHoldTime(0);
  }, [buzzerActive, buzzerHoldTime, gameId, gameState, user, buzzerRelease]);
  
  // Handle buzzer hold/release events from other players
  useEffect(() => {
    if (!gameState) return;
    
    // If we receive a ROUND_END event, navigate to results page
    if (gameState.lastEvent?.type === 'ROUND_END') {
      const event = gameState.lastEvent;
      navigate(`/results/${event.gameId}/${event.roundNumber}`);
    }
  }, [gameState, navigate]);
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  
  // Get current player data
  const currentPlayer = gameState?.players.find(p => p?.id === user?.id);
  const timeBank = currentPlayer?.timeBank || 0;
  const timeBankPercentage = gameState ? (timeBank / gameState.startingTimeBank) * 100 : 0;
  
  if (!user || !gameId || !gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="material-icons text-4xl text-neutral animate-spin">refresh</span>
          <p className="mt-4 text-neutral">Loading game...</p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <AppHeader />
      
      <div className="flex-1 flex flex-col">
        {/* Game Info */}
        <div className="bg-neutral-lighter p-4 border-b border-neutral-light">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-neutral">
              Round <span className="font-semibold">{gameState.currentRound}</span> of{" "}
              <span>{gameState.totalRounds}</span>
            </div>
            <div className="flex items-center space-x-1 text-sm text-neutral">
              <span className="material-icons text-sm">people</span>
              <span>{gameState.players.filter(p => !p.isEliminated).length}</span> players
            </div>
          </div>
          
          {/* Player Tokens */}
          <PlayerTokens players={gameState.players} />
        </div>
        
        {/* Game Play */}
        <div className="flex-1 flex flex-col items-center justify-between p-6 relative">
          {/* Common Timer Display */}
          <div className="text-center mb-4">
            <div className="text-lg font-medium text-neutral-dark">Common Timer</div>
            <div className="font-display text-4xl font-bold text-primary-dark">
              {commonTime}
            </div>
          </div>
          
          {/* Buzzer Area */}
          <Buzzer 
            active={buzzerActive}
            onHold={handleBuzzerDown}
            onRelease={handleBuzzerUp}
            disabled={!gameState || gameState.status !== 'in_progress' || (currentPlayer?.isEliminated || false)}
          />
          
          {/* Player's Remaining Time Bank */}
          <div className="w-full mt-6">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-medium text-neutral-dark">Your Time Bank</div>
              <div className="font-display font-bold text-lg text-accent-dark">
                {formatTime(timeBank)}
              </div>
            </div>
            
            {/* Time Bank Progress Bar */}
            <div className="h-3 bg-neutral-light rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent" 
                style={{ width: `${timeBankPercentage}%` }}
              ></div>
            </div>
            
            <div className="mt-2 text-xs text-neutral text-center">
              Started with {formatTime(gameState.startingTimeBank)} minutes
            </div>
          </div>
        </div>
      </div>
      
      {/* Game Starting Overlay */}
      {gameState.countdown !== null && (
        <GameStartingOverlay countdown={gameState.countdown} />
      )}
    </>
  );
}

export default Game;
