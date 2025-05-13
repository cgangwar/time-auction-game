import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { ClientGame, ClientPlayer, GameEvent } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

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
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const { toast } = useToast();
  
  // Initialize WebSocket connection
  const connectToGame = useCallback((gameId: number, userId: number) => {
    // Close existing socket if there is one
    if (socket) {
      socket.close();
    }
    
    // Create new WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Connecting to WebSocket at ${wsUrl}...`);
    const newSocket = new WebSocket(wsUrl);
    
    newSocket.onopen = () => {
      console.log('WebSocket connection established successfully');
      
      // Identify the user to the server
      console.log(`Identifying user ${userId} to server...`);
      newSocket.send(JSON.stringify({ type: 'IDENTIFY', userId }));
      
      // Join the game room
      setTimeout(() => {
        if (newSocket.readyState === WebSocket.OPEN) {
          console.log(`Joining game ${gameId}...`);
          newSocket.send(JSON.stringify({ type: 'JOIN_GAME', gameId }));
        } else {
          console.error('WebSocket not in OPEN state, cannot join game');
          toast({
            title: "Connection Error",
            description: "Unable to join game - please try refreshing the page",
            variant: "destructive"
          });
        }
      }, 500); // Small delay to ensure IDENTIFY is processed
    };
    
    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        if (data.type === 'ERROR') {
          console.error('Server reported error:', data.message);
          toast({
            title: "Server Error",
            description: data.message,
            variant: "destructive"
          });
          return;
        }
        
        if (data.type === 'IDENTIFIED') {
          console.log('User successfully identified with server');
        }
        
        if (data.type === 'GAME_STATE') {
          // Initialize game state
          setGameState({
            id: data.gameId,
            code: data.code || '',
            status: data.status,
            currentRound: data.currentRound,
            totalRounds: data.totalRounds,
            startingTimeBank: data.startingTimeBank || 600,
            isPublic: data.isPublic || true,
            players: data.players || [],
            lastEvent: null,
            countdown: null
          });
        } else if (data.type === 'JOIN_GAME') {
          // Update players when someone joins
          setGameState(prev => {
            if (!prev) return prev;
            
            // Check if player already exists
            const playerExists = prev.players.some(p => p.id === data.userId);
            
            if (playerExists) {
              return prev;
            }
            
            const newPlayer: ClientPlayer = {
              id: data.userId,
              username: data.username,
              displayName: data.displayName,
              initials: data.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
              isHost: false,
              isReady: false,
              timeBank: prev.startingTimeBank,
              tokensWon: 0,
              isEliminated: false
            };
            
            return {
              ...prev,
              players: [...prev.players, newPlayer],
              lastEvent: data
            };
          });
        } else if (data.type === 'PLAYER_READY') {
          // Update player ready status
          setGameState(prev => {
            if (!prev) return prev;
            
            return {
              ...prev,
              players: prev.players.map(p => 
                p.id === data.userId 
                  ? { ...p, isReady: data.isReady } 
                  : p
              ),
              lastEvent: data
            };
          });
        } else if (data.type === 'GAME_STARTING') {
          // Update countdown
          setCountdown(data.countdown);
          setGameState(prev => prev ? { ...prev, countdown: data.countdown, lastEvent: data } : prev);
        } else if (data.type === 'GAME_START') {
          // Game started
          setCountdown(null);
          setGameState(prev => {
            if (!prev) return prev;
            
            return {
              ...prev,
              status: 'in_progress',
              countdown: null,
              lastEvent: data
            };
          });
        } else if (data.type === 'ROUND_START') {
          // Round started
          setGameState(prev => {
            if (!prev) return prev;
            
            return {
              ...prev,
              currentRound: data.roundNumber,
              lastEvent: data
            };
          });
        } else if (data.type === 'BUZZER_HOLD') {
          // Someone is holding the buzzer
          setGameState(prev => prev ? { ...prev, lastEvent: data } : prev);
        } else if (data.type === 'BUZZER_RELEASE') {
          // Someone released the buzzer
          setGameState(prev => {
            if (!prev) return prev;
            
            // Update player's time bank
            return {
              ...prev,
              players: prev.players.map(p => {
                if (p.id === data.userId) {
                  // Convert holdTime from ms to seconds for display
                  const holdTimeSeconds = data.holdTime / 1000;
                  const newTimeBank = Math.max(0, p.timeBank - holdTimeSeconds);
                  
                  return {
                    ...p,
                    timeBank: newTimeBank
                  };
                }
                return p;
              }),
              lastEvent: data
            };
          });
        } else if (data.type === 'ROUND_END') {
          // Round ended
          setGameState(prev => {
            if (!prev) return prev;
            
            // Update winner's token count
            return {
              ...prev,
              players: prev.players.map(p => {
                if (p.id === data.winnerId) {
                  return {
                    ...p,
                    tokensWon: p.tokensWon + 1
                  };
                }
                return p;
              }),
              lastEvent: data
            };
          });
        } else if (data.type === 'GAME_END') {
          // Game ended
          setGameState(prev => {
            if (!prev) return prev;
            
            return {
              ...prev,
              status: 'completed',
              lastEvent: data
            };
          });
        } else if (data.type === 'PLAYER_LEFT') {
          // Player left
          setGameState(prev => {
            if (!prev) return prev;
            
            return {
              ...prev,
              players: prev.players.filter(p => p.id !== data.userId),
              lastEvent: data
            };
          });
        }
        
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    // Use a reconnection counter to prevent infinite reconnection loops
    const [reconnectCount, setReconnectCount] = useState(0);
    
    newSocket.onclose = (event) => {
      console.log('WebSocket disconnected', event);
      
      // Only attempt to reconnect a limited number of times
      if (event.code !== 1000 && reconnectCount < 3) {
        setReconnectCount(prev => prev + 1);
        
        toast({
          title: "Connection Lost",
          description: `Connection to game server was lost. Attempt ${reconnectCount + 1}/3...`,
          variant: "destructive"
        });
        
        // Try to reconnect after a delay that increases with each attempt
        setTimeout(() => {
          connectToGame(gameId, userId);
        }, 2000 + (reconnectCount * 1000));
      } else if (reconnectCount >= 3) {
        toast({
          title: "Connection Failed",
          description: "Unable to connect to the game server after multiple attempts. Please try again later.",
          variant: "destructive"
        });
        // Return to home page
        window.location.href = "/";
      }
    };
    
    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to game server. Please try refreshing the page.",
        variant: "destructive"
      });
    };
    
    setSocket(newSocket);
  }, [socket, toast]);
  
  // Disconnect from WebSocket
  const disconnectFromGame = useCallback(() => {
    if (socket) {
      socket.close();
      setSocket(null);
      setGameState(null);
      setCountdown(null);
    }
  }, [socket]);
  
  // Send player ready update
  const updatePlayerReady = useCallback((gameId: number, userId: number, isReady: boolean) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'PLAYER_READY',
        gameId,
        userId,
        isReady
      }));
    }
  }, [socket]);
  
  // Send buzzer hold event
  const buzzerHold = useCallback((gameId: number, userId: number) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'BUZZER_HOLD',
        gameId,
        userId,
        timestamp: Date.now()
      }));
    }
  }, [socket]);
  
  // Send buzzer release event
  const buzzerRelease = useCallback((gameId: number, userId: number, holdTime: number) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'BUZZER_RELEASE',
        gameId,
        userId,
        timestamp: Date.now(),
        holdTime
      }));
    }
  }, [socket]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);
  
  const value = {
    gameState,
    connectToGame,
    disconnectFromGame,
    updatePlayerReady,
    buzzerHold,
    buzzerRelease
  };
  
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  
  return context;
}
