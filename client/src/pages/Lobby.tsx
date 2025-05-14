import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useGame } from "@/contexts/GameContext";
import { Button } from "@/components/ui/button";
import { ClientPlayer } from "@shared/schema";

// Lobby component
function Lobby() {
  const [, params] = useRoute("/lobby/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { connectToGame, gameState, updatePlayerReady, disconnectFromGame } = useGame();
  
  const gameId = params?.id ? parseInt(params.id) : undefined;
  
  // Use a ref to track if we've connected already
  const hasConnectedRef = useRef(false);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    // Connect to the game WebSocket only once
    if (gameId && user && !hasConnectedRef.current) {
      console.log(`Lobby: Connecting to game ${gameId} as user ${user.id}`);
      connectToGame(gameId, user.id);
      hasConnectedRef.current = true;
    }
    
    // Cleanup when leaving the page
    return () => {
      if (gameId) {
        console.log(`Lobby: Disconnecting from game ${gameId}`);
        disconnectFromGame();
        hasConnectedRef.current = false;
      }
    };
  }, [gameId, user, navigate, connectToGame, disconnectFromGame]);
  
  // Listen for game start event
  useEffect(() => {
    if (gameState?.lastEvent?.type === 'GAME_START') {
      navigate(`/game/${gameId}`);
    }
  }, [gameState, gameId, navigate]);
  
  // Handle player ready toggle
  const handleToggleReady = () => {
    if (!gameId || !user || !gameState) return;
    
    const currentPlayer = gameState.players.find((p: ClientPlayer) => p.id === user.id);
    if (currentPlayer) {
      updatePlayerReady(gameId, user.id, !currentPlayer.isReady);
    }
  };
  
  // Handle leave lobby
  const handleLeaveLobby = () => {
    disconnectFromGame();
    navigate("/");
  };
  
  // Loading state
  if (!user || !gameId || !gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="material-icons text-4xl text-neutral animate-spin">refresh</span>
          <p className="mt-4 text-neutral">Loading lobby...</p>
        </div>
      </div>
    );
  }
  
  // Get player data
  const currentPlayer = gameState.players.find((p: ClientPlayer) => p.id === user.id);
  const isHost = currentPlayer?.isHost || false;
  const isReady = currentPlayer?.isReady || false;
  
  // Check if all players are ready
  const allPlayersReady = gameState.players.length >= 2 && 
                          gameState.players.every((p: ClientPlayer) => p.isReady);
  
  return (
    <div className="h-full flex flex-col">
      {/* Lobby Header */}
      <div className="bg-primary p-5 text-white">
        <h2 className="font-display text-xl font-bold mb-1">Game Lobby</h2>
        <p className="text-white/80 text-sm flex items-center">
          <span className="material-icons text-sm mr-1">link</span>
          Share code: <span className="font-mono font-medium ml-1">{gameState.code}</span>
        </p>
      </div>
      
      {/* Lobby Settings */}
      <div className="p-4 border-b border-neutral-light">
        <h3 className="font-display font-bold text-neutral-dark text-lg mb-3">Game Settings</h3>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-light space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-neutral-dark">Rounds</div>
              <div className="text-xs text-neutral mt-0.5">Number of rounds to play</div>
            </div>
            <div className="font-display font-bold text-lg text-primary-dark">
              {gameState.totalRounds}
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-neutral-dark">Starting Time</div>
              <div className="text-xs text-neutral mt-0.5">Time bank per player</div>
            </div>
            <div className="font-display font-bold text-lg text-primary-dark">
              {Math.floor(gameState.startingTimeBank / 60)}:{String(gameState.startingTimeBank % 60).padStart(2, '0')}
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-neutral-dark">Privacy</div>
              <div className="text-xs text-neutral mt-0.5">Who can join this game</div>
            </div>
            <div className="bg-neutral-light text-neutral-dark text-sm px-3 py-1 rounded-full font-medium">
              {gameState.isPublic ? 'Public' : 'Private'}
            </div>
          </div>
        </div>
      </div>
      
      {/* Player List */}
      <div className="p-4 flex-1">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-display font-bold text-neutral-dark text-lg">
            Players ({gameState.players.length}/4)
          </h3>
          <div className="text-sm text-neutral">
            {gameState.players.length < 2 
              ? 'Waiting for more players' 
              : gameState.players.length >= 4 
                ? 'Lobby full' 
                : `Waiting for ${4 - gameState.players.length} more`}
          </div>
        </div>
        
        <div className="space-y-3">
          {/* Existing players */}
          {gameState.players.map((player: ClientPlayer) => (
            <div 
              key={player.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-neutral-light flex items-center"
            >
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
                {player.initials}
              </div>
              <div className="ml-3 flex-1">
                <div className="font-medium text-neutral-dark">{player.displayName}</div>
                <div className="text-xs text-neutral mt-0.5">
                  {player.isHost ? 'Host • ' : ''}{player.isReady ? 'Ready' : 'Not ready'}
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full ${player.isReady ? 'bg-[#10B981]' : 'bg-neutral-light'} flex items-center justify-center`}>
                <span className={`material-icons text-${player.isReady ? 'white' : 'neutral'} text-sm`}>
                  {player.isReady ? 'check' : 'hourglass_empty'}
                </span>
              </div>
            </div>
          ))}
          
          {/* Empty slots */}
          {Array.from({ length: Math.min(4 - gameState.players.length, 4) }).map((_, index) => (
            <div 
              key={`empty-${index}`}
              className="bg-white rounded-xl p-4 shadow-sm border border-neutral-light flex items-center border-dashed"
            >
              <div className="w-10 h-10 rounded-full bg-neutral-light flex items-center justify-center text-neutral">
                <span className="material-icons">person_add</span>
              </div>
              <div className="ml-3 flex-1">
                <div className="font-medium text-neutral-dark">Waiting for player...</div>
                <div className="text-xs text-neutral mt-0.5">Slot available</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Start Game Button */}
      <div className="p-4 border-t border-neutral-light">
        {isHost ? (
          <Button 
            className="w-full py-6"
            disabled={!allPlayersReady || gameState.players.length < 2}
            onClick={handleToggleReady}
          >
            <span className="material-icons mr-2">play_arrow</span>
            {allPlayersReady ? 'Start Game' : 'Waiting for players'}
          </Button>
        ) : (
          <Button 
            className={`w-full py-6 ${isReady ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
            onClick={handleToggleReady}
          >
            <span className="material-icons mr-2">{isReady ? 'cancel' : 'check_circle'}</span>
            {isReady ? 'Cancel Ready' : 'Ready Up'}
          </Button>
        )}
        
        <Button 
          className="mt-2 w-full py-2 border border-neutral-light bg-white text-neutral-dark hover:bg-neutral-lighter"
          onClick={handleLeaveLobby}
        >
          Leave Lobby
        </Button>
      </div>
      
      {/* Game Starting Overlay (when countdown starts) */}
      {gameState.countdown !== null && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          <div className="text-center text-white px-6">
            <h2 className="font-display text-2xl font-bold mb-2">Game Starting</h2>
            <p className="text-white/80 mb-6">Get ready! The game will begin in:</p>
            
            <div className="font-display text-6xl font-bold text-primary mb-8 countdown">
              {gameState.countdown}
            </div>
            
            <div className="text-white/80 text-sm">
              <p className="mb-1"><span className="font-medium">Remember:</span> Hold the buzzer as long as you dare!</p>
              <p>The longer you hold, the more time you spend from your bank.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lobby;