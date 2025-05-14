import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { 
  insertUserSchema, 
  insertGameSchema, 
  insertGameParticipantSchema,
  type GameEvent
} from "@shared/schema";
import crypto from "crypto";
import { addBotsToGame, processBotActions } from "./bots";

// Map to track connected WebSocket clients
type SocketClient = {
  userId: number;
  socket: WebSocket;
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Track games and their participants
  const gameClients: Map<number, Map<number, WebSocket>> = new Map();
  const userSocketMap: Map<number, WebSocket> = new Map();
  
  // WebSocket connection handling
  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection established');
    let userIdentified = false;
    let userId: number | null = null;
    let gameId: number | null = null;
    
    // Set a simple ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping();
        } catch (err) {
          console.error('Error sending ping:', err);
          clearInterval(pingInterval);
        }
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // ping every 30 seconds
    
    ws.on('close', () => {
      console.log(`WebSocket closed${userId ? ` for user ${userId}` : ''}`);
      clearInterval(pingInterval);
      
      // Clean up user mapping
      if (userId && userSocketMap.get(userId) === ws) {
        userSocketMap.delete(userId);
      }
      
      // Clean up game client mapping
      if (userId && gameId) {
        const gameUsers = gameClients.get(gameId);
        if (gameUsers && gameUsers.get(userId) === ws) {
          gameUsers.delete(userId);
          if (gameUsers.size === 0) {
            gameClients.delete(gameId);
          }
          
          // Notify other players that this player left
          broadcastToGame(gameId, {
            type: 'PLAYER_LEFT',
            gameId,
            userId
          });
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log('Received message:', data);
        
        // Handle identification
        if (data.type === 'IDENTIFY') {
          if (!data.userId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'User ID required' }));
            return;
          }
          
          const user = await storage.getUser(data.userId);
          if (!user) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'User not found' }));
            return;
          }
          
          // Update user ID
          userId = user.id;
          userIdentified = true;
          
          // Map this connection to the user
          userSocketMap.set(userId, ws);
          
          // Send confirmation
          console.log(`User ${userId} successfully identified`);
          ws.send(JSON.stringify({ type: 'IDENTIFIED', userId }));
          return;
        }
        
        // All other messages require user identification
        if (!userIdentified || !userId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Please identify first' }));
          return;
        }
        
        // Handle game-related messages (all require authentication)
        if (data.type === 'JOIN_GAME' && data.gameId && userId) {
          console.log(`User ${userId} is joining game ${data.gameId}`);
          gameId = data.gameId; // Store gameId in connection state
          
          try {
            await handleJoinGame(data.gameId, userId, ws);
          } catch (err) {
            console.error(`Error joining game ${data.gameId}:`, err);
            ws.send(JSON.stringify({ 
              type: 'ERROR', 
              message: 'Failed to join game' 
            }));
          }
        } else if (data.type === 'PLAYER_READY' && data.gameId && userId) {
          console.log(`User ${userId} toggled ready state to ${data.isReady} in game ${data.gameId}`);
          
          try {
            await handlePlayerReady(data.gameId, userId, data.isReady);
          } catch (err) {
            console.error(`Error updating player ready status:`, err);
            ws.send(JSON.stringify({ 
              type: 'ERROR', 
              message: 'Failed to update ready status'
            }));
          }
        } else if (data.type === 'BUZZER_HOLD' && data.gameId && userId) {
          console.log(`User ${userId} is holding buzzer in game ${data.gameId}`);
          
          try {
            await handleBuzzerHold(data.gameId, userId);
          } catch (err) {
            console.error(`Error handling buzzer hold:`, err);
          }
        } else if (data.type === 'BUZZER_RELEASE' && data.gameId && userId && typeof data.holdTime === 'number') {
          console.log(`User ${userId} released buzzer after ${data.holdTime}ms in game ${data.gameId}`);
          
          try {
            await handleBuzzerRelease(data.gameId, userId, data.holdTime);
          } catch (err) {
            console.error(`Error handling buzzer release:`, err);
          }
        } else {
          console.log('Received unhandled or invalid WebSocket message:', data);
          ws.send(JSON.stringify({ 
            type: 'ERROR', 
            message: 'Invalid or incomplete message'
          }));
        }
        
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }));
      }
    });
  });
  
  // Helper function to add a client to a game room
  async function handleJoinGame(gameId: number, userId: number, socket: WebSocket) {
    console.log(`Handling JOIN_GAME for gameId=${gameId}, userId=${userId}`);
    
    try {
      const game = await storage.getGame(gameId);
      
      if (!game) {
        console.log(`Game ${gameId} not found`);
        socket.send(JSON.stringify({ type: 'ERROR', message: 'Game not found' }));
        return;
      }
      
      if (game.status !== 'waiting') {
        console.log(`Game ${gameId} has already started`);
        socket.send(JSON.stringify({ type: 'ERROR', message: 'Game already started' }));
        return;
      }
      
      // Check if user is already a participant
      let participant = await storage.getParticipant(gameId, userId);
      console.log(`Participant check for game ${gameId}, user ${userId}: ${participant ? 'exists' : 'not found'}`);
      
      if (!participant) {
        // Add as new participant
        const user = await storage.getUser(userId);
        if (!user) {
          console.log(`User ${userId} not found`);
          socket.send(JSON.stringify({ type: 'ERROR', message: 'User not found' }));
          return;
        }
        
        console.log(`Adding user ${userId} as participant to game ${gameId}`);
        participant = await storage.addParticipant({
          gameId,
          userId,
          isHost: false,
          isReady: false,
          timeBank: game.startingTimeBank,
          tokensWon: 0,
          isEliminated: false,
          isBot: false // Human player
        });
      }
    } catch (error) {
      console.error(`Error in handleJoinGame:`, error);
      socket.send(JSON.stringify({ type: 'ERROR', message: 'Internal server error' }));
      return;
    }
    
    // Add to game room
    if (!gameClients.has(gameId)) {
      gameClients.set(gameId, new Map());
    }
    
    const gameUsers = gameClients.get(gameId);
    if (gameUsers) {
      gameUsers.set(userId, socket);
    }
    
    // Get user details
    const user = await storage.getUser(userId);
    
    // Notify other players that this player joined
    broadcastToGame(gameId, {
      type: 'JOIN_GAME',
      gameId,
      userId,
      username: user?.username || '',
      displayName: user?.displayName || ''
    });
    
    // Send game state to connected user
    await sendGameState(gameId, userId, socket);
  }
  
  // Send game state to connected user
  async function sendGameState(gameId: number, userId: number, socket: WebSocket) {
    try {
      const game = await storage.getGame(gameId);
      if (!game) {
        console.error(`Game ${gameId} not found when sending game state`);
        socket.send(JSON.stringify({ type: 'ERROR', message: 'Game not found' }));
        return;
      }
      
      const participants = await storage.getParticipantsByGame(gameId);
      console.log(`Found ${participants.length} participants for game ${gameId}`);
      
      const playerDetails = await Promise.all(
        participants.map(async (p) => {
          const u = await storage.getUser(p.userId);
          return {
            userId: p.userId,
            isHost: p.isHost,
            isReady: p.isReady,
            username: u?.username || '',
            displayName: u?.displayName || ''
          };
        })
      );
      
      // Build player list with all required information for the client
      const clientPlayers = participants.map(p => {
        const user = playerDetails.find(pd => pd.userId === p.userId);
        return {
          id: p.userId,
          username: user?.username || '',
          displayName: user?.displayName || '',
          initials: user?.displayName ? user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase() : '??',
          isHost: p.isHost,
          isReady: p.isReady,
          timeBank: p.timeBank || game.startingTimeBank,
          tokensWon: p.tokensWon,
          isEliminated: p.isEliminated,
          isBot: p.isBot || false,
          botProfile: p.botProfile
        };
      });
  
      console.log('Sending game state to player:', { gameId, playerId: userId, playerCount: clientPlayers.length });
      
      const gameState = {
        type: 'GAME_STATE',
        gameId,
        code: game.code,
        status: game.status,
        currentRound: game.currentRound,
        totalRounds: game.totalRounds,
        startingTimeBank: game.startingTimeBank,
        isPublic: game.isPublic,
        players: clientPlayers,
        hasBots: game.hasBots,
        botCount: game.botCount,
        botProfiles: game.botProfiles
      };
      
      socket.send(JSON.stringify(gameState));
      console.log('Game state sent successfully');
    } catch (error) {
      console.error('Error sending game state:', error);
      socket.send(JSON.stringify({ type: 'ERROR', message: 'Error retrieving game state' }));
    }
  }
  
  // Handle player ready state changes
  async function handlePlayerReady(gameId: number, userId: number, isReady: boolean) {
    await storage.updateParticipantReadyStatus(gameId, userId, isReady);
    
    // Broadcast to all players in the game
    broadcastToGame(gameId, {
      type: 'PLAYER_READY',
      gameId,
      userId,
      isReady
    });
    
    // Check if all players are ready to start the game
    const game = await storage.getGame(gameId);
    const participants = await storage.getParticipantsByGame(gameId);
    
    if (game && game.status === 'waiting' && participants.length >= 2) {
      const allReady = participants.every(p => p.isReady);
      
      if (allReady) {
        // Start game countdown
        startGameCountdown(gameId);
      }
    }
  }
  
  // Handle buzzer hold event
  async function handleBuzzerHold(gameId: number, userId: number) {
    const timestamp = Date.now();
    
    // Broadcast to all players in the game
    broadcastToGame(gameId, {
      type: 'BUZZER_HOLD',
      gameId,
      userId,
      timestamp
    });
  }
  
  // Handle buzzer release event
  async function handleBuzzerRelease(gameId: number, userId: number, holdTime: number) {
    const timestamp = Date.now();
    
    // Get the game and current round
    const game = await storage.getGame(gameId);
    if (!game || game.status !== 'in_progress') {
      return;
    }
    
    // Get the participant to update their time bank
    const participant = await storage.getParticipant(gameId, userId);
    if (participant && participant.timeBank !== null) {
      // Convert hold time from ms to seconds for calculation
      const holdTimeSeconds = holdTime / 1000;
      const newTimeBank = Math.max(0, participant.timeBank - holdTimeSeconds);
      
      // Update participant's time bank
      await storage.updateParticipantTimeBank(gameId, userId, newTimeBank);
    }
    
    // Broadcast to all players in the game
    broadcastToGame(gameId, {
      type: 'BUZZER_RELEASE',
      gameId,
      userId,
      timestamp,
      holdTime
    });
    
    // Find rounds for this game
    const rounds = await storage.getGameRounds(gameId);
    const currentRound = rounds.find(r => r.roundNumber === game.currentRound);
    
    if (currentRound) {
      // Create a bid for this round
      await storage.createBid({
        roundId: currentRound.id,
        userId,
        bidTime: holdTime
      });
      
      // Check if this is the first release (meaning everyone has released)
      const participants = await storage.getParticipantsByGame(gameId);
      const activePlayers = participants.filter(p => !p.isEliminated);
      
      // Get all bids for this round
      const bids = await storage.getBidsByRound(currentRound.id);
      
      // If we have a bid from each active player, end the round
      if (bids.length === activePlayers.length) {
        await endRound(gameId, currentRound.id);
      }
    }
  }
  
  // Start game countdown
  async function startGameCountdown(gameId: number) {
    // Start countdown from 3
    let countdown = 3;
    
    // Notify players of countdown
    const countdownInterval = setInterval(async () => {
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        await startGame(gameId);
      } else {
        broadcastToGame(gameId, {
          type: 'GAME_STARTING',
          gameId,
          countdown
        });
        countdown--;
      }
    }, 1000);
  }
  
  // Start the game
  async function startGame(gameId: number) {
    const game = await storage.getGame(gameId);
    if (!game || game.status !== 'waiting') {
      return;
    }
    
    // Update game status
    await storage.updateGameStatus(gameId, 'in_progress');
    await storage.setGameStartTime(gameId);
    
    // Create first round
    const round = await storage.createRound({
      gameId,
      roundNumber: 1,
      winnerId: null
    });
    
    // Broadcast game start
    broadcastToGame(gameId, {
      type: 'GAME_START',
      gameId
    });
    
    // Start first round
    broadcastToGame(gameId, {
      type: 'ROUND_START',
      gameId,
      roundNumber: 1
    });
  }
  
  // End the current round
  async function endRound(gameId: number, roundId: number) {
    const round = await storage.getRound(roundId);
    const game = await storage.getGame(gameId);
    
    if (!round || !game) {
      return;
    }
    
    // Get all bids for this round
    const bids = await storage.getBidsByRound(roundId);
    
    // Find the highest bid
    let highestBid: { userId: number, bidTime: number } | null = null;
    
    for (const bid of bids) {
      if (!highestBid || bid.bidTime > highestBid.bidTime) {
        highestBid = { userId: bid.userId, bidTime: bid.bidTime };
      }
    }
    
    if (highestBid) {
      // Complete the round with the winner
      await storage.completeRound(roundId, highestBid.userId);
      
      // Update winner's token count
      const participant = await storage.getParticipant(gameId, highestBid.userId);
      if (participant) {
        await storage.updateParticipantTokens(
          gameId, 
          highestBid.userId, 
          participant.tokensWon + 1
        );
      }
      
      // Check if this was the last round
      const nextRound = round.roundNumber + 1;
      const isLastRound = nextRound > game.totalRounds;
      
      // Broadcast round end
      broadcastToGame(gameId, {
        type: 'ROUND_END',
        gameId,
        roundNumber: round.roundNumber,
        winnerId: highestBid.userId,
        winnerHoldTime: highestBid.bidTime,
        nextRound: isLastRound ? -1 : nextRound
      });
      
      if (isLastRound) {
        // This was the last round, end the game
        await endGame(gameId);
      } else {
        // Update game current round
        await storage.updateGameCurrentRound(gameId, nextRound);
        
        // Create next round
        await storage.createRound({
          gameId,
          roundNumber: nextRound,
          winnerId: null
        });
        
        // Start next round after a delay
        setTimeout(() => {
          broadcastToGame(gameId, {
            type: 'ROUND_START',
            gameId,
            roundNumber: nextRound
          });
        }, 5000); // 5 second delay between rounds
      }
    }
  }
  
  // End the game and determine final results
  async function endGame(gameId: number) {
    const game = await storage.getGame(gameId);
    if (!game) {
      return;
    }
    
    // Mark game as completed
    await storage.updateGameStatus(gameId, 'completed');
    await storage.setGameEndTime(gameId);
    
    // Get all participants
    const participants = await storage.getParticipantsByGame(gameId);
    
    // Find the player with the lowest number of tokens and eliminate them
    const lowestTokens = Math.min(...participants.map(p => p.tokensWon));
    
    for (const participant of participants) {
      if (participant.tokensWon === lowestTokens) {
        await storage.eliminateParticipant(gameId, participant.userId);
      }
    }
    
    // Prepare rankings
    const rankings = await Promise.all(
      participants.map(async (p) => {
        const user = await storage.getUser(p.userId);
        return {
          userId: p.userId,
          username: user?.username || '',
          displayName: user?.displayName || '',
          tokens: p.tokensWon,
          timeRemaining: p.timeBank
        };
      })
    );
    
    // Sort rankings by tokens won (descending) and time remaining (descending)
    const sortedRankings = rankings.sort((a, b) => {
      if (b.tokens !== a.tokens) {
        return b.tokens - a.tokens;
      }
      return (b.timeRemaining || 0) - (a.timeRemaining || 0);
    });
    
    // Broadcast game end with rankings
    broadcastToGame(gameId, {
      type: 'GAME_END',
      gameId,
      rankings: sortedRankings
    });
  }
  
  // Helper to broadcast a message to all clients in a game
  function broadcastToGame(gameId: number, message: GameEvent) {
    const clients = gameClients.get(gameId);
    if (!clients) return;
    
    const messageStr = JSON.stringify(message);
    
    clients.forEach((socket, userId) => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(messageStr);
        } catch (error) {
          console.error(`Error broadcasting to user ${userId}:`, error);
        }
      }
    });
  }
  
  // API Routes
  
  // User registration
  app.post('/api/register', async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse({
        ...req.body,
        // Add default display name if not provided
        displayName: req.body.displayName || req.body.username
      });
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(409).json({ message: 'Username already taken' });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(409).json({ message: 'Email already registered' });
      }
      
      // Hash password (in a real app you would use bcrypt)
      const hashedPassword = crypto
        .createHash('sha256')
        .update(validatedData.password)
        .digest('hex');
      
      // Create user
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword
      });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid input', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });
  
  // User login
  app.post('/api/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password required' });
      }
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Hash password and compare
      const hashedPassword = crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');
      
      if (user.password !== hashedPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Get user by ID
  app.get('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Create a new game
  app.post('/api/games', async (req: Request, res: Response) => {
    try {
      // Validate the request body
      const validatedData = insertGameSchema.parse(req.body);
      
      // Generate a random 6-character code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Create the game
      const game = await storage.createGame({
        ...validatedData,
        code,
        status: 'waiting',
        currentRound: 0
      });
      
      // Add the creator as the first participant and host
      const participant = await storage.addParticipant({
        gameId: game.id,
        userId: validatedData.hostId,
        isHost: true,
        isReady: false,
        timeBank: validatedData.startingTimeBank,
        tokensWon: 0,
        isEliminated: false,
        isBot: false
      });
      
      // If bots are requested, add them
      if (validatedData.hasBots && validatedData.botCount && validatedData.botCount > 0) {
        await addBotsToGame(game.id, validatedData.botCount, validatedData.botProfiles, validatedData.startingTimeBank);
      }
      
      res.status(201).json(game);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid input', errors: error.errors });
      } else {
        console.error('Error creating game:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });
  
  // Get a game by ID
  app.get('/api/games/:id', async (req: Request, res: Response) => {
    try {
      const gameId = parseInt(req.params.id);
      if (isNaN(gameId)) {
        return res.status(400).json({ message: 'Invalid game ID' });
      }
      
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: 'Game not found' });
      }
      
      // Get participants
      const participants = await storage.getParticipantsByGame(gameId);
      
      // Build player list
      const players = await Promise.all(
        participants.map(async (p) => {
          const user = await storage.getUser(p.userId);
          return {
            id: p.userId,
            username: user?.username || '',
            displayName: user?.displayName || '',
            initials: user?.displayName 
              ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase() 
              : '',
            isHost: p.isHost,
            isReady: p.isReady,
            timeBank: p.timeBank,
            tokensWon: p.tokensWon,
            isEliminated: p.isEliminated,
            isBot: p.isBot,
            botProfile: p.botProfile
          };
        })
      );
      
      // Return game data with players
      res.status(200).json({
        ...game,
        players
      });
    } catch (error) {
      console.error('Error getting game:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Join a game by code
  app.post('/api/games/join', async (req: Request, res: Response) => {
    try {
      const { userId, code } = req.body;
      
      if (!userId || !code) {
        return res.status(400).json({ message: 'User ID and game code required' });
      }
      
      // Find the game
      const game = await storage.getGameByCode(code);
      if (!game) {
        return res.status(404).json({ message: 'Game not found' });
      }
      
      // Check if game has already started
      if (game.status !== 'waiting') {
        return res.status(400).json({ message: 'Game has already started' });
      }
      
      // Check if user already in game
      const existingParticipant = await storage.getParticipant(game.id, userId);
      if (existingParticipant) {
        return res.status(400).json({ message: 'User already in game' });
      }
      
      // Add user to game
      await storage.addParticipant({
        gameId: game.id,
        userId,
        isHost: false,
        isReady: false,
        timeBank: game.startingTimeBank,
        tokensWon: 0,
        isEliminated: false,
        isBot: false
      });
      
      res.status(200).json(game);
    } catch (error) {
      console.error('Error joining game:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Get active games for a user
  app.get('/api/users/:id/games', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      const activeGames = await storage.getActiveGames(userId);
      
      res.status(200).json(activeGames);
    } catch (error) {
      console.error('Error getting user games:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Get public games
  app.get('/api/games/public', async (req: Request, res: Response) => {
    try {
      const publicGames = await storage.getPublicGames();
      
      const gamesWithParticipants = await Promise.all(
        publicGames.map(async (game) => {
          const participants = await storage.getParticipantsByGame(game.id);
          
          const players = await Promise.all(
            participants.map(async (p) => {
              const user = await storage.getUser(p.userId);
              return {
                id: p.userId,
                username: user?.username || '',
                displayName: user?.displayName || '',
                isHost: p.isHost,
                isBot: p.isBot
              };
            })
          );
          
          return {
            ...game,
            playerCount: participants.length,
            players
          };
        })
      );
      
      res.status(200).json(gamesWithParticipants);
    } catch (error) {
      console.error('Error getting public games:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Setup a timer to process bot actions for in-progress games
  setInterval(async () => {
    // Get all games that are in progress and have bots
    try {
      const allGames = await storage.getPublicGames();
      const inProgressGamesWithBots = allGames.filter(g => 
        g.status === 'in_progress' && g.hasBots
      );
      
      for (const game of inProgressGamesWithBots) {
        await processBotActions(game.id);
      }
    } catch (error) {
      console.error('Error processing bot actions:', error);
    }
  }, 2000); // Check every 2 seconds
  
  return httpServer;
}