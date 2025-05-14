import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ClientPlayer, GameEvent } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { GameWebSocket, gameSocket, GameEventHandler } from '@/lib/websocket';

interface GameState {
  id: number;
  code: string;
  status: 'waiting' | 'in_progress' | 'completed';
  currentRound: number;
  totalRounds: number;
  startingTimeBank: number;
  isPublic: boolean;
  players: ClientPlayer[];
  lastEvent: GameEvent | null;
  countdown: number | null;
}

interface GameContextType {
  gameState: GameState | null;
  connectToGame: (gameId: number, userId: number) => void;
  disconnectFromGame: () => void;
  updatePlayerReady: (gameId: number, userId: number, isReady: boolean) => void;
  buzzerHold: (gameId: number, userId: number) => void;
  buzzerRelease: (gameId: number, userId: number, holdTime: number) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { toast } = useToast();
  const sessionGameId = useRef<number | null>(null);
  const sessionUserId = useRef<number | null>(null);
  
  // Set up event handlers for the WebSocket
  useEffect(() => {
    // Handle identified event
    const handleIdentified: GameEventHandler<'IDENTIFIED'> = (data) => {
      console.log('User successfully identified with server');
      
      // If we have an active game session, automatically join it
      if (sessionGameId.current && sessionUserId.current) {
        gameSocket.joinGame(sessionGameId.current, sessionUserId.current);
      }
    };
    
    // Handle join game event
    const handleJoinGame: GameEventHandler<'JOIN_GAME'> = (data) => {
      console.log(`Player joined: ${data.userId}`);
    };
    
    // Handle game state
    const handleGameState = (data: any) => {
      if (data.type === 'GAME_STATE') {
        setGameState({
          id: data.gameId,
          code: data.code,
          status: data.status,
          currentRound: data.currentRound,
          totalRounds: data.totalRounds,
          startingTimeBank: data.startingTimeBank,
          isPublic: data.isPublic,
          players: data.players,
          lastEvent: null,
          countdown: null
        });
      }
    };
    
    // Handle player ready event
    const handlePlayerReady: GameEventHandler<'PLAYER_READY'> = (data) => {
      setGameState(prevState => {
        if (!prevState) return null;
        
        return {
          ...prevState,
          players: prevState.players.map(player => 
            player.id === data.userId 
              ? { ...player, isReady: data.isReady } 
              : player
          ),
          lastEvent: data
        };
      });
    };
    
    // Handle game starting event
    const handleGameStarting: GameEventHandler<'GAME_STARTING'> = (data) => {
      setCountdown(data.countdown);
      setGameState(prevState => {
        if (!prevState) return null;
        return { ...prevState, lastEvent: data, countdown: data.countdown };
      });
    };
    
    // Handle game start event
    const handleGameStart: GameEventHandler<'GAME_START'> = (data) => {
      setCountdown(null);
      setGameState(prevState => {
        if (!prevState) return null;
        return { 
          ...prevState, 
          status: 'in_progress', 
          lastEvent: data,
          countdown: null
        };
      });
    };
    
    // Handle round start event
    const handleRoundStart: GameEventHandler<'ROUND_START'> = (data) => {
      setGameState(prevState => {
        if (!prevState) return null;
        return { 
          ...prevState, 
          currentRound: data.roundNumber,
          lastEvent: data 
        };
      });
    };
    
    // Handle buzzer events
    const handleBuzzerEvent = (data: any) => {
      if (data.type === 'BUZZER_HOLD' || data.type === 'BUZZER_RELEASE') {
        setGameState(prevState => {
          if (!prevState) return null;
          return { ...prevState, lastEvent: data };
        });
      }
    };
    
    // Handle round end event
    const handleRoundEnd: GameEventHandler<'ROUND_END'> = (data) => {
      setGameState(prevState => {
        if (!prevState) return null;
        return { 
          ...prevState, 
          currentRound: data.nextRound,
          lastEvent: data 
        };
      });
    };
    
    // Handle game end event
    const handleGameEnd: GameEventHandler<'GAME_END'> = (data) => {
      setGameState(prevState => {
        if (!prevState) return null;
        return { 
          ...prevState, 
          status: 'completed',
          lastEvent: data 
        };
      });
    };
    
    // Handle player left and game cancelled events
    const handlePlayerLeft: GameEventHandler<'PLAYER_LEFT'> = (data) => {
      toast({
        title: 'Player Left',
        description: 'A player has left the game.',
        variant: 'default'
      });
      
      setGameState(prevState => {
        if (!prevState) return null;
        return {
          ...prevState,
          players: prevState.players.filter(p => p.id !== data.userId),
          lastEvent: data
        };
      });
    };
    
    const handleGameCancelled: GameEventHandler<'GAME_CANCELLED'> = (data) => {
      toast({
        title: 'Game Cancelled',
        description: `Game cancelled: ${data.reason}`,
        variant: 'destructive'
      });
      
      setGameState(prevState => {
        if (!prevState) return null;
        return { ...prevState, status: 'completed', lastEvent: data };
      });
    };
    
    // Handle error messages
    const handleError = (data: any) => {
      if (data.type === 'ERROR') {
        console.error('WebSocket error message:', data.message);
        
        // If the error says user not found, show a more specific error
        if (data.message === 'User not found') {
          toast({
            title: 'Authentication Error',
            description: 'User not found. Please try logging in again.',
            variant: 'destructive'
          });
        }
      }
    };
    
    // Subscribe to WebSocket events
    gameSocket.on('IDENTIFIED', handleIdentified);
    gameSocket.on('JOIN_GAME', handleJoinGame);
    gameSocket.on('GAME_STATE', handleGameState);
    gameSocket.on('PLAYER_READY', handlePlayerReady);
    gameSocket.on('GAME_STARTING', handleGameStarting);
    gameSocket.on('GAME_START', handleGameStart);
    gameSocket.on('ROUND_START', handleRoundStart);
    gameSocket.on('BUZZER_HOLD', handleBuzzerEvent);
    gameSocket.on('BUZZER_RELEASE', handleBuzzerEvent);
    gameSocket.on('ROUND_END', handleRoundEnd);
    gameSocket.on('GAME_END', handleGameEnd);
    gameSocket.on('PLAYER_LEFT', handlePlayerLeft);
    gameSocket.on('GAME_CANCELLED', handleGameCancelled);
    gameSocket.on('ERROR', handleError);
    
    // Set up connection error handler
    gameSocket.options.onError = () => {
      toast({
        title: 'Connection Error',
        description: 'There was an error connecting to the game server. Trying to reconnect...',
        variant: 'destructive'
      });
    };
    
    // Cleanup on unmount
    return () => {
      gameSocket.off('IDENTIFIED', handleIdentified);
      gameSocket.off('JOIN_GAME', handleJoinGame);
      gameSocket.off('GAME_STATE', handleGameState);
      gameSocket.off('PLAYER_READY', handlePlayerReady);
      gameSocket.off('GAME_STARTING', handleGameStarting);
      gameSocket.off('GAME_START', handleGameStart);
      gameSocket.off('ROUND_START', handleRoundStart);
      gameSocket.off('BUZZER_HOLD', handleBuzzerEvent);
      gameSocket.off('BUZZER_RELEASE', handleBuzzerEvent);
      gameSocket.off('ROUND_END', handleRoundEnd);
      gameSocket.off('GAME_END', handleGameEnd);
      gameSocket.off('PLAYER_LEFT', handlePlayerLeft);
      gameSocket.off('GAME_CANCELLED', handleGameCancelled);
      gameSocket.off('ERROR', handleError);
    };
  }, [toast]);
  
  // Initialize WebSocket connection
  const connectToGame = useCallback((gameId: number, userId: number) => {
    console.log(`Connecting to game ${gameId} as user ${userId}`);
    
    // Store the game and user ID for potential reconnections
    sessionGameId.current = gameId;
    sessionUserId.current = userId;
    
    // Connect to WebSocket if not already connected
    if (!gameSocket.isConnected()) {
      gameSocket.connect(userId)
        .then(() => {
          console.log('WebSocket connected, joining game...');
          gameSocket.joinGame(gameId, userId);
        })
        .catch(error => {
          console.error('Failed to connect to WebSocket:', error);
          toast({
            title: 'Connection Error',
            description: 'Could not establish a connection to the game server.',
            variant: 'destructive'
          });
        });
    } else {
      // Already connected, just join the game
      gameSocket.joinGame(gameId, userId);
    }
  }, [toast]);
  
  // Disconnect from game
  const disconnectFromGame = useCallback(() => {
    console.log('Disconnecting from game');
    sessionGameId.current = null;
    sessionUserId.current = null;
    setGameState(null);
    setCountdown(null);
    
    // No need to close the socket, we'll keep it alive for potential future connections
  }, []);
  
  // Update player ready status
  const updatePlayerReady = useCallback((gameId: number, userId: number, isReady: boolean) => {
    gameSocket.updatePlayerReady(gameId, userId, isReady);
  }, []);
  
  // Send buzzer hold event
  const buzzerHold = useCallback((gameId: number, userId: number) => {
    gameSocket.buzzerHold(gameId, userId);
  }, []);
  
  // Send buzzer release event
  const buzzerRelease = useCallback((gameId: number, userId: number, holdTime: number) => {
    gameSocket.buzzerRelease(gameId, userId, holdTime);
  }, []);
  
  const value = {
    gameState,
    connectToGame,
    disconnectFromGame,
    updatePlayerReady,
    buzzerHold,
    buzzerRelease
  };
  
  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}