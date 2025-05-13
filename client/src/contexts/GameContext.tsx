import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ClientPlayer, GameEvent } from '@shared/schema';
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
      setSocket(null);
    }
    
    try {
      // Create new WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Connecting to WebSocket at ${wsUrl}...`);
      const newSocket = new WebSocket(wsUrl);
      
      // Store the socket reference
      setSocket(newSocket);
      
      newSocket.onopen = () => {
        console.log('WebSocket connection established successfully');
        
        // Identify the user to the server
        console.log(`Identifying user ${userId} to server...`);
        newSocket.send(JSON.stringify({ type: 'IDENTIFY', userId }));
        
        // Join the game room
        console.log(`Joining game ${gameId}...`);
        newSocket.send(JSON.stringify({ type: 'JOIN_GAME', gameId, userId }));
      };
      
      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          // Handle different message types
          if (data.type === 'IDENTIFIED') {
            console.log('User successfully identified with server');
          }
          else if (data.type === 'JOIN_GAME') {
            console.log(`Joined game ${data.gameId} as user ${data.userId}`);
          }
          else if (data.type === 'GAME_STATE') {
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
          else if (data.type === 'PLAYER_READY') {
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
          }
          else if (data.type === 'GAME_STARTING') {
            setCountdown(data.countdown);
            setGameState(prevState => {
              if (!prevState) return null;
              return { ...prevState, lastEvent: data, countdown: data.countdown };
            });
          }
          else if (data.type === 'GAME_START') {
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
          }
          else if (data.type === 'ROUND_START') {
            setGameState(prevState => {
              if (!prevState) return null;
              return { 
                ...prevState, 
                currentRound: data.roundNumber,
                lastEvent: data 
              };
            });
          }
          else if (data.type === 'BUZZER_HOLD' || data.type === 'BUZZER_RELEASE') {
            // Just update the lastEvent
            setGameState(prevState => {
              if (!prevState) return null;
              return { ...prevState, lastEvent: data };
            });
          }
          else if (data.type === 'ROUND_END') {
            setGameState(prevState => {
              if (!prevState) return null;
              return { 
                ...prevState, 
                currentRound: data.nextRound,
                lastEvent: data 
              };
            });
          }
          else if (data.type === 'GAME_END') {
            setGameState(prevState => {
              if (!prevState) return null;
              return { 
                ...prevState, 
                status: 'completed',
                lastEvent: data 
              };
            });
          }
          else if (data.type === 'PLAYER_LEFT' || data.type === 'GAME_CANCELLED') {
            toast({
              title: data.type === 'PLAYER_LEFT' ? 'Player Left' : 'Game Cancelled',
              description: data.type === 'PLAYER_LEFT' 
                ? 'A player has left the game.'
                : `Game cancelled: ${data.reason}`,
              variant: data.type === 'GAME_CANCELLED' ? 'destructive' : 'default'
            });
            
            if (data.type === 'PLAYER_LEFT') {
              setGameState(prevState => {
                if (!prevState) return null;
                return {
                  ...prevState,
                  players: prevState.players.filter(p => p.id !== data.userId),
                  lastEvent: data
                };
              });
            }
            else {
              setGameState(prevState => {
                if (!prevState) return null;
                return { ...prevState, status: 'completed', lastEvent: data };
              });
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      newSocket.onclose = (event) => {
        console.log('WebSocket connection closed:', event);
        
        if (!event.wasClean) {
          // Connection lost unexpectedly
          setReconnectCount(prev => prev + 1);
          
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
        
        // Only show error toast on first error
        if (reconnectCount === 0) {
          toast({
            title: "Connection Error",
            description: "There was an error connecting to the game server. Trying to reconnect...",
            variant: "destructive"
          });
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      toast({
        title: "Connection Error",
        description: "Could not establish a connection to the game server.",
        variant: "destructive"
      });
    }
  }, [reconnectCount, socket, toast]);
  
  // Disconnect from game
  const disconnectFromGame = useCallback(() => {
    if (socket) {
      socket.close();
      setSocket(null);
    }
    setGameState(null);
    setCountdown(null);
  }, [socket]);
  
  // Update player ready status
  const updatePlayerReady = useCallback((gameId: number, userId: number, isReady: boolean) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'PLAYER_READY',
        gameId,
        userId,
        isReady
      }));
    } else {
      console.error('Socket not connected, cannot update player ready status');
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
    } else {
      console.error('Socket not connected, cannot send buzzer hold');
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
    } else {
      console.error('Socket not connected, cannot send buzzer release');
    }
  }, [socket]);
  
  // Clean up WebSocket on unmount
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