# Time Auction - Architecture Documentation

## Overview

Time Auction is a real-time multiplayer strategy game featuring a time-based bidding system. Players compete against each other (or bots) in rounds by strategically bidding time from their personal time bank. The player who holds down the buzzer for the longest time without exceeding their time bank wins each round.

## Tech Stack

- **Frontend**: React with TypeScript, TailwindCSS
- **Backend**: Node.js with Express
- **Real-time Communication**: WebSockets (ws package)
- **State Management**: Custom context-based state management
- **Storage**: In-memory storage with option for PostgreSQL database
- **Authentication**: Username-based authentication (with Replit Auth support)

## System Architecture

The application follows a client-server architecture with real-time bidirectional communication:

```
┌───────────────┐                 ┌───────────────┐
│   Frontend    │◄───WebSocket───►│    Backend    │
│  React + Vite │◄─────REST─────►│  Express.js   │
└───────────────┘                 └───────────────┘
                                         │
                                         ▼
                                  ┌───────────────┐
                                  │    Storage    │
                                  │  In-Memory/DB │
                                  └───────────────┘
```

## Core Components

### 1. Client-Side Components

#### Game Context (`client/src/contexts/GameContext.tsx`)
Manages the real-time game state, WebSocket connection, and game events. Provides the following functionality:
- Connect/disconnect to games
- Handle buzzer actions (hold/release)
- Process game events (rounds starting/ending, player actions)
- Update UI based on game state changes

#### Auth Context (`client/src/contexts/AuthContext.tsx`)
Handles user authentication and session management:
- User login and registration
- Session persistence
- User profile information

#### WebSocket Client (`client/src/lib/websocket.ts`)
Manages the WebSocket connection with the server:
- Connection establishment with auto-reconnect
- Message sending and receiving
- Identification sequence handling

#### Game Interface Components
- **Buzzer Component** (`client/src/components/Buzzer.tsx`): The main interactive element for bidding time
- **Game Page** (`client/src/pages/Game.tsx`): Main game interface
- **Lobby Page** (`client/src/pages/Lobby.tsx`): Pre-game waiting area
- **Results Page** (`client/src/pages/Results.tsx`): Round and game results

### 2. Server-Side Components

#### WebSocket Server (`server/routes.ts`)
Handles real-time communication:
- Player connections and identification
- Game state broadcasting
- Game events processing (buzzer holds/releases, round transitions)

#### Game Logic (`server/routes.ts`)
Implements core game mechanics:
- Game creation and management
- Round progression logic
- Time bank and token calculations
- Winner determination

#### Bot System (`server/bots.ts`)
Implements artificial opponents with different psychological profiles:
- Aggressive: Takes larger risks with time
- Conservative: Uses smaller, safer bids
- Erratic: Unpredictable bidding behavior
- Bot decision-making based on behavioral patterns

#### Storage Interface (`server/storage.ts`)
Abstract interface for data persistence:
- In-memory implementation for development
- Database implementation option for production
- Manages users, games, rounds, and bids data

#### Data Schema (`shared/schema.ts`)
Defines the data model for the application:
- User model
- Game model
- Game participant model
- Round model
- Bid model

## Data Flow

### Game Session Flow

1. **Game Creation**:
   - Host creates a game with settings (rounds, time bank, privacy)
   - System generates a unique game code for joining
   - Host is marked as ready by default

2. **Lobby Phase**:
   - Players join using the game code
   - Players mark themselves as ready
   - When all players are ready, countdown begins

3. **Round Execution**:
   - Round begins
   - Players hold the buzzer to bid time
   - Time is deducted from their time bank
   - Player who holds longest wins the round
   - Winner receives a token

4. **Game Completion**:
   - After all rounds, final rankings are displayed
   - Players with the most tokens win
   - Time banks are used as tiebreakers

### WebSocket Message Flow

```
┌─────────┐                      ┌──────────┐
│ Client  │                      │  Server  │
└────┬────┘                      └────┬─────┘
     │        IDENTIFY              │
     │─────────────────────────────>│
     │        IDENTIFIED            │
     │<─────────────────────────────│
     │        JOIN_GAME             │
     │─────────────────────────────>│
     │        GAME_STATE            │
     │<─────────────────────────────│
     │        PLAYER_READY          │
     │─────────────────────────────>│
     │        GAME_STARTING         │
     │<─────────────────────────────│
     │        GAME_START            │
     │<─────────────────────────────│
     │        ROUND_START           │
     │<─────────────────────────────│
     │        BUZZER_HOLD           │
     │─────────────────────────────>│
     │        BUZZER_RELEASE        │
     │─────────────────────────────>│
     │        ROUND_END             │
     │<─────────────────────────────│
     │        GAME_END              │
     │<─────────────────────────────│
```

## System Behaviors

### Error Handling

- **Connection Issues**: Auto-reconnect with exponential backoff
- **Game State Synchronization**: Full state sync on reconnection
- **Game Cleanup**: Automatic cleanup for inactive or empty games
- **Player Disconnection**: Handling of player drops during gameplay

### Performance Considerations

- WebSocket messages are kept minimal to reduce latency
- Game state updates are optimized to send only necessary information
- Client-side prediction is used to improve UI responsiveness
- Animation frames are used for smooth timer display

## Security

- WebSocket connections require user identification
- Game access is restricted to authenticated participants
- Server validates all time-related actions to prevent cheating
- Input validation is performed on all client requests

## Future Architecture Extensions

1. **Persistent Storage**: Full PostgreSQL database implementation
2. **Matchmaking System**: Automatic game creation based on player skill
3. **Achievement System**: Tracking player accomplishments
4. **Advanced Bot Behaviors**: More sophisticated AI opponents
5. **Cross-Platform Support**: Support for mobile clients (iOS/Android)