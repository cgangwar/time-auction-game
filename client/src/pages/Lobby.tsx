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
  
  // Handle start game (for host)
  const handleStartGame = () => {
    if (!gameId || !user || !gameState) return;
    
    // The host is already marked as ready by default
    // We are showing this button only to the host and only when conditions are met
    if (allPlayersReady && validPlayers.length >= 2) {
      console.log('Host starting the game...');
      // This will push a message to start game
      updatePlayerReady(gameId, user.id, true);
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
  
  // Check if all players are ready - filter out any invalid players
  const validPlayers = gameState.players.filter(p => p.id > 0 && p.username !== '');
  const allPlayersReady = validPlayers.length >= 2 && 
                          validPlayers.every((p: ClientPlayer) => p.isReady);
  
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
            Players ({validPlayers.length}/2)
          </h3>
          <div className="text-sm text-neutral">
            {validPlayers.length < 2 
              ? 'Waiting for more players' 
              : validPlayers.length >= 2 
                ? 'Ready to start!' 
                : `Waiting for ${2 - validPlayers.length} more`}
          </div>
        </div>
        
        <div className="space-y-3">
          {/* Existing players - filtered to exclude players with invalid data */}
          {gameState.players
            .filter((player: ClientPlayer) => player.id > 0 && player.username !== '')
            .map((player: ClientPlayer) => (
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
                {player.id === user.id && !player.isHost ? (
                  // If this is the current user and not the host, show a checkbox
                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer">
                      <div className={`w-5 h-5 mr-2 border rounded-sm ${player.isReady ? 'bg-green-500 border-green-600' : 'bg-white border-gray-300'} flex items-center justify-center`}>
                        {player.isReady && <span className="material-icons text-white text-xs">check</span>}
                      </div>
                      <input 
                        type="checkbox"
                        className="sr-only"
                        checked={player.isReady}
                        onChange={handleToggleReady}
                      />
                      <span className="text-sm">{player.isReady ? 'Ready' : 'Ready?'}</span>
                    </label>
                  </div>
                ) : (
                  // For other players, just show the ready status indicator
                  <div className={`w-6 h-6 rounded-full ${player.isReady ? 'bg-[#10B981]' : 'bg-neutral-light'} flex items-center justify-center`}>
                    <span className={`material-icons text-${player.isReady ? 'white' : 'neutral'} text-sm`}>
                      {player.isReady ? 'check' : 'hourglass_empty'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          
          {/* Empty slots - shown only if we need more players to reach minimum */}
          {validPlayers.length < 2 && Array.from({ length: 2 - validPlayers.length }).map((_, index) => (
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
      
      {/* Game Controls */}
      <div className="p-4 border-t border-neutral-light">
        {isHost ? (
          // Host controls
          <div className="space-y-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-light">
              <h3 className="font-bold text-neutral-dark mb-2">Host Controls</h3>
              <p className="text-sm text-neutral mb-3">
                As the host, you can start the game when all players are ready.
              </p>
              
              {allPlayersReady && validPlayers.length >= 2 ? (
                // Show a prominent Start Game button when conditions are met
                <Button 
                  className="w-full py-4 bg-green-600 hover:bg-green-700 text-lg"
                  onClick={handleStartGame}
                >
                  <span className="material-icons mr-2 text-2xl">play_circle</span>
                  START GAME
                </Button>
              ) : (
                // Show a disabled button with status
                <Button 
                  className="w-full py-4"
                  disabled={true}
                >
                  <span className="material-icons mr-2">info</span>
                  {validPlayers.length < 2 
                    ? 'Need at least 2 players' 
                    : 'Waiting for players to be ready'}
                </Button>
              )}
              
              <div className="mt-4 text-sm text-neutral text-center">
                <span className="inline-flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  Host status: Ready
                </span>
              </div>
            </div>
            
            <Button 
              className="w-full py-2 border border-neutral-light bg-white text-neutral-dark hover:bg-neutral-lighter"
              onClick={handleLeaveLobby}
            >
              Leave Lobby
            </Button>
          </div>
        ) : (
          // Player controls
          <div className="space-y-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-light">
              <h3 className="font-bold text-neutral-dark mb-2">Ready Status</h3>
              <p className="text-sm text-neutral mb-3">
                Click the button below to indicate you're ready to play.
              </p>
              <Button 
                className={`w-full py-4 ${isReady ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                onClick={handleToggleReady}
              >
                <span className="material-icons mr-2">{isReady ? 'cancel' : 'check_circle'}</span>
                {isReady ? 'Cancel Ready' : 'Ready Up'}
              </Button>
            </div>
            
            <Button 
              className="w-full py-2 border border-neutral-light bg-white text-neutral-dark hover:bg-neutral-lighter"
              onClick={handleLeaveLobby}
            >
              Leave Lobby
            </Button>
          </div>
        )}
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
      
      {/* Redirect to game when game starts */}
      {gameState.status === 'in_progress' && (
        <>{navigate(`/game/${gameState.id}`, { replace: true })}</>
      )}
    </div>
  );
}

export default Lobby;