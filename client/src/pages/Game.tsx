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
import { apiRequest } from "@/lib/queryClient";

function Game() {
  const [, params] = useRoute("/game/:id");
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { 
    connectToGame, 
    gameState, 
    buzzerHold, 
    buzzerRelease, 
    disconnectFromGame,
    error: contextError
  } = useGame();
  const { toast } = useToast();
  
  const gameId = params?.id ? parseInt(params.id) : undefined;
  
  // Buzzer state
  const [buzzerActive, setBuzzerActive] = useState(false);
  const [buzzerStartTime, setBuzzerStartTime] = useState<number | null>(null);
  const [buzzerHoldTime, setBuzzerHoldTime] = useState(0);
  const [commonTime, setCommonTime] = useState("00:00.0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Fetch game details to check if it exists and what state it's in
  const { data: gameInfo } = useQuery({
    queryKey: [`/api/games/${gameId}`],
    enabled: !!gameId,
    retry: false,
    refetchOnWindowFocus: false
  });
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    // Connect to the game WebSocket
    if (gameId && user) {
      console.log(`Game page: Connecting to game ${gameId} as user ${user.id}`);
      setLoading(true);
      setError(null);
      
      // Connect to the game
      connectToGame(gameId, user.id);
      
      // Set a timeout to check if we've received game state
      const timeoutId = setTimeout(() => {
        if (!gameState && !contextError) {
          console.log('Game connection timeout - no game state received');
          setError("Could not connect to game. The connection timed out or the game may have already started.");
          setLoading(false);
        }
      }, 5000);
      
      // Cleanup function
      return () => {
        clearTimeout(timeoutId);
        // We don't want to disconnect from the game when this component unmounts
        // as that could interrupt the WebSocket connection
        // disconnectFromGame();
      };
    }
    
    return undefined;
  }, [gameId, user, navigate, connectToGame]);
  
  // Reset loading state when game state is received or handle errors
  useEffect(() => {
    if (gameState) {
      setLoading(false);
      setError(null);
    } else if (contextError) {
      setError(contextError);
      setLoading(false);
    }
  }, [gameState, contextError]);
  
  // Handle buzzer hold event
  const handleBuzzerDown = useCallback(() => {
    if (!gameState || !user) return;
    if (gameState.status !== 'in_progress') return;
    if (buzzerActive) return;
    
    const currentPlayer = gameState.players.find(p => p.id === user.id);
    if (!currentPlayer || currentPlayer.isEliminated) return;
    
    console.log('Buzzer hold initiated');
    const currentTime = Date.now();
    setBuzzerActive(true);
    setBuzzerStartTime(currentTime);
    buzzerHold(gameId as number, user.id);
    
    // Start the animation frame for updating the timer
    const updateTimer = () => {
      const startTime = currentTime;
      if (startTime) {
        const elapsed = Date.now() - startTime;
        const seconds = elapsed / 1000;
        
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const formattedTime = `${String(mins).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
        
        setCommonTime(formattedTime);
        setBuzzerHoldTime(elapsed);
        
        // Update the player's time bank preview
        const newTimeBank = Math.max(0, currentPlayer.timeBank - (elapsed / 1000));
        const player = document.getElementById('player-timebank');
        if (player) {
          const mins = Math.floor(newTimeBank / 60);
          const secs = newTimeBank % 60;
          player.textContent = `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
        }
        
        if (buzzerActive) {
          animationRef.current = requestAnimationFrame(updateTimer);
        }
      }
    };
    
    animationRef.current = requestAnimationFrame(updateTimer);
  }, [buzzerActive, gameId, gameState, user, buzzerHold]);
  
  // Handle buzzer release event
  const handleBuzzerUp = useCallback(() => {
    if (!buzzerActive || !gameState || !user || !gameId) return;
    
    console.log('Buzzer release initiated with hold time:', buzzerHoldTime);
    setBuzzerActive(false);
    
    // Cancel animation frame
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Send the buzzer release event with hold time
    if (buzzerHoldTime > 0) {
      // Make sure we send the final hold time
      const finalHoldTime = buzzerStartTime ? Date.now() - buzzerStartTime : buzzerHoldTime;
      console.log('Sending buzzer release with hold time:', finalHoldTime);
      buzzerRelease(gameId, user.id, finalHoldTime);
      
      // Update the game state after release
      toast({
        title: "Time spent",
        description: `You spent ${(finalHoldTime / 1000).toFixed(1)} seconds from your time bank.`,
      });
    }
    
    // Reset buzzer state
    setBuzzerStartTime(null);
    setBuzzerHoldTime(0);
  }, [buzzerActive, buzzerHoldTime, buzzerStartTime, gameId, gameState, user, buzzerRelease, toast]);
  
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
  
  if (!user || !gameId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="material-icons text-4xl text-neutral animate-spin">refresh</span>
          <p className="mt-4 text-neutral">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Display loading state or error message
  if (loading && !gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="material-icons text-4xl text-neutral animate-spin">refresh</span>
          <p className="mt-4 text-neutral">Connecting to game...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    let errorTitle = "Unable to Join Game";
    let errorMessage = error;
    let errorSubtext = "Please go back to the home page and try joining another game or creating a new one.";
    let isGameAlreadyStarted = false;
    
    // Customize error message based on content
    if (error.includes("already started")) {
      errorTitle = "Game Already Started";
      errorSubtext = "This game has already begun and cannot be joined. Please join a different game or create a new one.";
      isGameAlreadyStarted = true;
    } else if (error.includes("not found")) {
      errorTitle = "Game Not Found";
      errorSubtext = "This game may have been deleted or never existed. Please check the game code and try again.";
    } else if (error.includes("authentication")) {
      errorTitle = "Authentication Error";
      errorSubtext = "Please try logging in again to resolve this issue.";
    }
    
    return (
      <>
        <AppHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
            <span className="material-icons text-4xl text-red-500 mb-2">error_outline</span>
            <h3 className="font-bold text-lg text-red-700 mb-2">{errorTitle}</h3>
            <p className="text-red-600 mb-4">{errorMessage}</p>
            <p className="text-neutral mb-4">{errorSubtext}</p>
            <div className="flex justify-center space-x-3">
              {!isGameAlreadyStarted && (
                <button
                  onClick={() => {
                    console.log("Manually retrying game connection...");
                    setError(null);
                    setLoading(true);
                    if (gameId && user) {
                      // Try to reconnect
                      connectToGame(gameId, user.id);
                    }
                  }}
                  className="bg-neutral hover:bg-neutral-dark text-white font-bold py-2 px-4 rounded"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => navigate("/")}
                className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="material-icons text-4xl text-neutral animate-spin">refresh</span>
          <p className="mt-4 text-neutral">Loading game data...</p>
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
              <div id="player-timebank" className="font-display font-bold text-lg text-accent-dark">
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
      
      {/* Game Controls */}
      <div className="fixed top-20 right-4 z-10">
        <button 
          onClick={() => navigate("/")}
          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg"
          aria-label="Exit Game"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Game Starting Overlay */}
      {gameState.countdown !== null && (
        <GameStartingOverlay countdown={gameState.countdown} />
      )}
    </>
  );
}

export default Game;
