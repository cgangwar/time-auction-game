import { GameEvent } from "@shared/schema";

type MessageHandler<T> = (data: T) => void;
type ErrorHandler = (error: Event) => void;
type ConnectionHandler = () => void;

interface WebSocketOptions {
  onOpen?: ConnectionHandler;
  onClose?: ConnectionHandler;
  onError?: ErrorHandler;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class GameWebSocket {
  private socket: WebSocket | null = null;
  private messageHandlers: Map<string, MessageHandler<any>[]> = new Map();
  private url: string;
  private reconnectAttempts = 0;
  private options: WebSocketOptions;

  constructor(url?: string, options: WebSocketOptions = {}) {
    // If no URL is provided, use the default WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.url = url || `${protocol}//${window.location.host}/ws`;
    
    this.options = {
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      ...options
    };
  }

  connect(userId?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
          console.log('WebSocket connection established');
          this.reconnectAttempts = 0;
          
          // Identify user if userId is provided
          if (userId) {
            this.send({ type: 'IDENTIFY', userId });
          }
          
          if (this.options.onOpen) {
            this.options.onOpen();
          }
          
          resolve();
        };

        this.socket.onclose = (event) => {
          console.log('WebSocket connection closed', event);
          
          if (this.options.onClose) {
            this.options.onClose();
          }

          // Attempt to reconnect if enabled
          if (this.options.reconnect && this.reconnectAttempts < (this.options.maxReconnectAttempts || 5)) {
            this.reconnectAttempts++;
            setTimeout(() => {
              console.log(`Attempting to reconnect (${this.reconnectAttempts})...`);
              this.connect(userId);
            }, this.options.reconnectInterval);
          }
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          
          if (this.options.onError) {
            this.options.onError(error);
          }
          
          reject(error);
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);
            
            if (data.type) {
              const handlers = this.messageHandlers.get(data.type) || [];
              handlers.forEach(handler => handler(data));
              
              // Also trigger handlers for wildcard '*'
              const wildcardHandlers = this.messageHandlers.get('*') || [];
              wildcardHandlers.forEach(handler => handler(data));
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(data: any): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  on<T extends GameEvent>(eventType: T['type'] | '*', handler: MessageHandler<T>): void {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, []);
    }
    
    this.messageHandlers.get(eventType)!.push(handler);
  }

  off<T extends GameEvent>(eventType: T['type'] | '*', handler?: MessageHandler<T>): void {
    if (!this.messageHandlers.has(eventType)) {
      return;
    }
    
    if (!handler) {
      // Remove all handlers for this event type
      this.messageHandlers.delete(eventType);
    } else {
      // Remove specific handler
      const handlers = this.messageHandlers.get(eventType) || [];
      this.messageHandlers.set(
        eventType,
        handlers.filter(h => h !== handler)
      );
    }
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  // Join a specific game
  joinGame(gameId: number, userId: number): boolean {
    return this.send({
      type: 'JOIN_GAME',
      gameId,
      userId
    });
  }

  // Update player ready status
  updatePlayerReady(gameId: number, userId: number, isReady: boolean): boolean {
    return this.send({
      type: 'PLAYER_READY',
      gameId,
      userId,
      isReady
    });
  }

  // Send buzzer hold event
  buzzerHold(gameId: number, userId: number): boolean {
    return this.send({
      type: 'BUZZER_HOLD',
      gameId,
      userId,
      timestamp: Date.now()
    });
  }

  // Send buzzer release event
  buzzerRelease(gameId: number, userId: number, holdTime: number): boolean {
    return this.send({
      type: 'BUZZER_RELEASE',
      gameId,
      userId,
      timestamp: Date.now(),
      holdTime
    });
  }
}

// Export a singleton instance for common usage
export const gameSocket = new GameWebSocket();

// Helper types for better typing support
export type GameEventHandler<T extends GameEvent['type']> = MessageHandler<Extract<GameEvent, { type: T }>>;
