import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { 
  insertUserSchema,
  insertGameSchema,
  insertGameParticipantSchema,
  type GameEvent,
  type BotProfileType
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
      
      // Allow rejoining games that are in progress for existing participants
      if (game.status !== 'waiting') {
        console.log(`Game ${gameId} status: ${game.status}`);
        
        // Check if the user is already a participant in this game
        const existingParticipant = await storage.getParticipant(gameId, userId);
        
        if (!existingParticipant) {
          // If not a participant, reject the join attempt
          console.log(`Game ${gameId} has already started and user ${userId} is not a participant`);
          socket.send(JSON.stringify({ type: 'ERROR', message: 'Game already started' }));
          return;
        } else {
          console.log(`User ${userId} is rejoining game ${gameId} that is in progress`);
          // Continue and let them rejoin
        }
      }
      
      // Check if user is already a participant
      let participant = await storage.getParticipant(gameId, userId);
      console.log(`Participant check for game ${gameId}, user ${userId}: ${participant ? 'exists' : 'not found'}`);
      
      // Check if this user is the creator of the game
      const isCreator = game.createdById === userId;
      console.log(`User ${userId} is creator of game ${gameId}: ${isCreator}`);
      
      if (!participant) {
        // Add as new participant
        const user = await storage.getUser(userId);
        if (!user) {
          console.log(`User ${userId} not found`);
          socket.send(JSON.stringify({ type: 'ERROR', message: 'User not found' }));
          return;
        }
        
        // Only set as host if they're the creator AND there isn't already a host
        const currentHost = (await storage.getParticipantsByGame(gameId)).find(p => p.isHost);
        const shouldBeHost = isCreator && !currentHost;
        
        console.log(`handleJoinGame: User ${userId}, isCreator: ${isCreator}, currentHost: ${currentHost?.userId}, shouldBeHost: ${shouldBeHost}`);
        
        console.log(`Adding user ${userId} as participant to game ${gameId}, isHost: ${shouldBeHost}`);
        participant = await storage.addParticipant({
          gameId,
          userId,
          isHost: shouldBeHost,
          isReady: shouldBeHost, // Set isReady to true if the participant is the host
          timeBank: game.startingTimeBank,
          tokensWon: 0,
          isEliminated: false,
          isBot: false
        });

        console.log(`handleJoinGame: Participant added/updated. userId: ${participant.userId}, isHost: ${participant.isHost}, isReady: ${participant.isReady}`);

        if (shouldBeHost) {
          await storage.updateGameHost(gameId, userId);
        }
      } else if (isCreator && !participant.isHost) {
        // If they're the creator but not marked as host, and no other host exists
        const currentHost = (await storage.getParticipantsByGame(gameId)).find(p => p.isHost);
        if (!currentHost) {
          console.log(`Updating host status for user ${userId} in game ${gameId}`);
          await storage.updateParticipantHostStatus(gameId, userId, true);
          await storage.updateGameHost(gameId, userId);
          // After updating host status, ensure isReady is also true if they are now the host
          participant = await storage.getParticipant(gameId, userId); // Re-fetch participant to get updated status
          if (participant && !participant.isReady) {
             await storage.updateParticipantReadyStatus(gameId, userId, true);
             console.log(`handleJoinGame: Updated isReady to true for new host ${userId}`);
          }
        }
      }
      
      // Re-fetch participant after any potential updates to log the final state
      const finalParticipantState = await storage.getParticipant(gameId, userId);
      console.log(`handleJoinGame: Final participant state for userId ${userId}: isHost: ${finalParticipantState?.isHost}, isReady: ${finalParticipantState?.isReady}`);

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
    console.log(`sendGameState called for gameId: ${gameId}, userId: ${userId}`);
    try {
      const game = await storage.getGame(gameId);
      if (!game) {
        console.error(`Game ${gameId} not found when sending game state`);
        socket.send(JSON.stringify({ type: 'ERROR', message: 'Game not found' }));
        return;
      }
      
      console.log(`Sending game state to player: { gameId: ${gameId}, playerId: ${userId}, gameStatus: ${game.status} }`);
      
      const participants = await storage.getParticipantsByGame(gameId);
      console.log(`Found ${participants.length} participants for game ${gameId}`);
      
      // Debug participant information
      // console.log('Participants:', participants.map(p => ({
      //   userId: p.userId,
      //   isHost: p.isHost,
      //   isBot: p.isBot
      // })));
      
      // Filter out any invalid participants (userId of 0 or undefined/null)
      const validParticipants = participants.filter(p => p.userId && p.userId > 0);
      
      const playerDetails = await Promise.all(
        validParticipants.map(async (p) => {
          const u = await storage.getUser(p.userId);
          if (!u) {
            console.log(`User ${p.userId} not found for participant`);
          }
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
      // Ensure only one host is marked per game
      const hostId = game.createdById;
      const clientPlayers = validParticipants.map(p => {
        const user = playerDetails.find(pd => pd.userId === p.userId);
        return {
          id: p.userId,
          username: user?.username || '',
          displayName: user?.displayName || '',
          initials: user?.displayName ? user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase() : '??',
          isHost: p.userId === hostId, // Use game.createdById as source of truth
          isReady: p.isReady,
          timeBank: p.timeBank || game.startingTimeBank,
          tokensWon: p.tokensWon,
          isEliminated: p.isEliminated,
          isBot: p.isBot || false,
          botProfile: p.botProfile && ['aggressive', 'conservative', 'erratic'].includes(p.botProfile) ? p.botProfile as BotProfileType : undefined,
          hasBidThisRound: p.hasBidThisRound,
          lastHoldTime: p.lastHoldTime,
        };
      });
  
      // console.log('Sending game state to player:', { gameId, playerId: userId, playerCount: clientPlayers.length });
      
      const gameStateMessage: GameEvent = {
        type: 'GAME_STATE',
        gameId,
        code: game.code,
        status: game.status,
        currentRound: game.currentRound,
        totalRounds: game.totalRounds,
        startingTimeBank: game.startingTimeBank,
        isPublic: game.isPublic,
        players: clientPlayers,
        maxHoldTimeLastRound: game.maxHoldTimeLastRound,
        roundWinnerId: game.roundWinnerId,
        hasBots: game.hasBots,
        botCount: game.botCount === null ? undefined : game.botCount,
        botProfiles: game.botProfiles === null ? undefined : game.botProfiles as BotProfileType[] | undefined
      };
      
      console.log(`sendGameState: Sending GAME_STATE to userId: ${userId} in gameId: ${gameId}. Players:`, clientPlayers.map(p => ({ id: p.id, isReady: p.isReady, isHost: p.isHost })));
      socket.send(JSON.stringify(gameStateMessage));
      console.log('Game state sent successfully');
    } catch (error) {
      console.error('Error sending game state:', error);
      socket.send(JSON.stringify({ type: 'ERROR', message: 'Error retrieving game state' }));
    }
  }
  
  // Handle player ready state changes
  async function handlePlayerReady(gameId: number, userId: number, isReady: boolean) {
    console.log(`handlePlayerReady called for gameId: ${gameId}, userId: ${userId}, isReady: ${isReady}`);
    await storage.updateParticipantReadyStatus(gameId, userId, isReady);
    
    // Broadcast to all players in the game
    console.log(`Broadcasting PLAYER_READY for gameId: ${gameId}, userId: ${userId}, isReady: ${isReady}`);
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
    
    const game = await storage.getGame(gameId);
    if (!game || game.status !== 'in_progress') {
      console.log(`Game ${gameId} not in progress or not found, cannot process buzzer release.`);
      return;
    }
    
    let participant = await storage.getParticipant(gameId, userId);
    if (!participant || participant.isEliminated) {
      console.log(`Participant ${userId} in game ${gameId} not found or is eliminated.`);
      return;
    }

    if (participant.hasBidThisRound) {
      console.log(`Participant ${userId} in game ${gameId} has already bid this round.`);
      // Optionally send an error or ignore, for now, ignore.
      return;
    }
    
    // Update participant's time bank
    if (participant.timeBank !== null) {
      const holdTimeSeconds = holdTime / 1000;
      const newTimeBank = Math.max(0, participant.timeBank - holdTimeSeconds);
      await storage.updateParticipantTimeBank(gameId, userId, newTimeBank);
    }

    // Update participant's bid details for the round
    // This assumes storage.updateParticipantBidDetails exists or similar functionality
    await storage.updateParticipantBidDetails(gameId, userId, {
      hasBidThisRound: true,
      lastHoldTime: holdTime
    });
    
    // Broadcast buzzer release to all players
    broadcastToGame(gameId, {
      type: 'BUZZER_RELEASE',
      gameId,
      userId,
      timestamp,
      holdTime
    });
    
    // Refresh participants data before checking bids
    const freshParticipants = await storage.getParticipantsByGame(gameId);
    const activePlayers = freshParticipants.filter(p => !p.isEliminated);
    const playersWhoHaveBid = freshParticipants.filter(p => p.hasBidThisRound);
    
    console.log(`Game ${gameId}: Active players:`, activePlayers.map(p => p.userId));
    console.log(`Game ${gameId}: Players who have bid:`, playersWhoHaveBid.map(p => p.userId));

    const allActivePlayersHaveBid = activePlayers.length > 0 &&
      activePlayers.every(p => playersWhoHaveBid.some(b => b.userId === p.userId));

    if (allActivePlayersHaveBid) {
      console.log(`All active players in game ${gameId} have bid. Ending round.`);
      await endCurrentRound(gameId);
    } else {
      console.log(`Game ${gameId}: Waiting for ${activePlayers.length - playersWhoHaveBid.length} more players to bid`);
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
  async function endCurrentRound(gameId: number) {
    let game = await storage.getGame(gameId);
    if (!game || game.status !== 'in_progress') {
      console.log(`Game ${gameId} not in progress or not found, cannot end round.`);
      return;
    }

    const participants = await storage.getParticipantsByGame(gameId);
    const activeBidders = participants.filter(p => !p.isEliminated && p.hasBidThisRound);

    let roundWinner: (typeof participants[0]) | null = null;
    let maxHoldTimeThisRound = 0;

    if (activeBidders.length > 0) {
      roundWinner = activeBidders.reduce((prev, current) =>
        (prev.lastHoldTime > current.lastHoldTime) ? prev : current
      );
      maxHoldTimeThisRound = roundWinner.lastHoldTime;
      
      // Award token to winner
      await storage.updateParticipantTokens(gameId, roundWinner.id, roundWinner.tokensWon + 1);
      console.log(`Round ${game.currentRound} winner in game ${gameId}: User ${roundWinner.id} with hold time ${maxHoldTimeThisRound}`);
    } else {
      console.log(`No active bidders in game ${gameId} for round ${game.currentRound}. No winner.`);
      // No winner if no one bid or all who bid were eliminated mid-round (edge case)
    }

    // Update game state with round results
    await storage.updateGameRoundResults(gameId, {
      roundWinnerId: roundWinner ? roundWinner.id : null,
      maxHoldTimeLastRound: maxHoldTimeThisRound,
      currentRound: game.currentRound + 1 // Increment round number
    });
    
    // Reset bid status for all participants for the next round
    for (const p of participants) {
      await storage.updateParticipantBidDetails(gameId, p.id, {
        hasBidThisRound: false,
        lastHoldTime: 0
      });
    }

    // Fetch the updated game state after updates
    game = await storage.getGame(gameId);
    if (!game) return; // Should not happen

    const nextRoundNumber = game.currentRound; // This is now the *next* round number
    const isLastRoundCompleted = (nextRoundNumber -1) >= game.totalRounds;


    // Broadcast ROUND_END event
    broadcastToGame(gameId, {
      type: 'ROUND_END',
      gameId,
      roundNumber: nextRoundNumber - 1, // The round that just ended
      winnerId: roundWinner ? roundWinner.id : 0, // Use 0 or null for no winner
      winnerHoldTime: maxHoldTimeThisRound,
      nextRound: isLastRoundCompleted ? -1 : nextRoundNumber
    });

    if (isLastRoundCompleted) {
      console.log(`Game ${gameId} completed after round ${nextRoundNumber - 1}.`);
      await endGame(gameId);
    } else {
      console.log(`Game ${gameId} advancing to round ${nextRoundNumber}.`);
      // Start next round after a delay
      setTimeout(() => {
        broadcastToGame(gameId, {
          type: 'ROUND_START',
          gameId,
          roundNumber: nextRoundNumber
        });
        // Potentially trigger bot actions for the new round here if needed
        // processBotActions(gameId);
      }, 3000); // 3-second delay between rounds
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
          timeRemaining: p.timeBank === null ? 0 : p.timeBank // Ensure timeRemaining is a number
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
  async function broadcastToGame(gameId: number, message: GameEvent) { // Made async to allow await sendGameState
    const clients = gameClients.get(gameId);
    if (!clients) return;
    
    const messageStr = JSON.stringify(message);
    let connectedPlayers = 0;
    
    clients.forEach((socket, userId) => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(messageStr);
          connectedPlayers++;
        } catch (error) {
          console.error(`Error broadcasting to user ${userId}:`, error);
        }
      }
    });
    
    // If no players are connected to this game, check if we should clean it up
    // Also, if the message is GAME_STATE, we don't need to check for empty game cleanup here
    // as sendGameState is usually targeted or part of a broader update.
    if (message.type !== 'GAME_STATE' && connectedPlayers === 0 && message.type !== 'GAME_CANCELLED') {
      console.log(`No players connected to game ${gameId} during broadcast of ${message.type}, checking if cleanup needed`);
      await handleEmptyGame(gameId);
    }

    // If the game state changed significantly (e.g. ROUND_END), resend full game state to all.
    if (message.type === 'ROUND_END' || message.type === 'GAME_START' || message.type === 'PLAYER_LEFT') {
        console.log(`Broadcasting full game state after ${message.type} for game ${gameId}`);
        clients?.forEach(async (socket, userId) => {
            if (socket.readyState === WebSocket.OPEN) {
                await sendGameState(gameId, userId, socket);
            }
        });
    }
  }
  
  // Handle case when a game is empty (no connected players)
  async function handleEmptyGame(gameId: number) {
    try {
      const game = await storage.getGame(gameId);
      if (!game) return;
      
      const participants = await storage.getParticipantsByGame(gameId);
      
      // If game has less than 2 players or is in waiting state with no players
      if (participants.length < 2 || 
          (game.status === 'waiting' && gameClients.get(gameId)?.size === 0)) {
        console.log(`Game ${gameId} has insufficient players (${participants.length}), marking as completed`);
        await storage.updateGameStatus(gameId, 'completed');
        await storage.setGameEndTime(gameId);
        
        // Clean up game clients map
        gameClients.delete(gameId);
      }
    } catch (error) {
      console.error(`Error handling empty game ${gameId}:`, error);
    }
  }
  
  // Game cleanup function - run periodically to clean up inactive or empty games
  async function cleanupGames() {
    try {
      console.log("Running game cleanup process...");
      const allGames = await storage.getPublicGames();
      
      for (const game of allGames) {
        // Check if game should be cleaned up
        const participants = await storage.getParticipantsByGame(game.id);
        
        // Calculate active clients in this game
        const gameClientMap = gameClients.get(game.id) || new Map();
        const activeClients = Array.from(gameClientMap.values()).filter(
          socket => socket.readyState === WebSocket.OPEN
        ).length;
        
        // Mark games as completed if:
        // 1. Game has fewer than 2 participants, or
        // 2. Game has no active clients connected and is in waiting state
        if (participants.length < 2 || 
            (activeClients === 0 && game.status === 'waiting')) {
          console.log(`Cleaning up game ${game.id} - ${participants.length} participants, ${activeClients} active clients`);
          await storage.updateGameStatus(game.id, 'completed');
          await storage.setGameEndTime(game.id);
          if (gameClients.has(game.id)) {
            gameClients.delete(game.id);
          }
        }
      }
    } catch (error) {
      console.error("Error in game cleanup process:", error);
    }
  }
  
  // Set up periodic game cleanup (every 5 minutes)
  setInterval(cleanupGames, 5 * 60 * 1000);
  
  // API Routes
  
  // User registration - simplified to username-only
  app.post('/api/register', async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse({
        ...req.body,
        // Always set display name to username if not provided
        displayName: req.body.displayName || req.body.username
      });
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        // If user exists, just return the user (simplified login)
        const { password, ...userWithoutPassword } = existingUser;
        return res.status(200).json(userWithoutPassword);
      }
      
      // Create new user with just username and displayName
      const user = await storage.createUser({
        username: validatedData.username,
        displayName: validatedData.displayName
      });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid input', errors: error.errors });
      } else {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });
  
  // User login - simplified to username-only
  app.post('/api/login', async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: 'Username is required' });
      }
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        // Auto-create user if not found
        const newUser = await storage.createUser({
          username,
          displayName: username
        });
        
        const { password, ...userWithoutPassword } = newUser;
        return res.status(200).json(userWithoutPassword);
      }
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error('Login error:', error);
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
        userId: validatedData.createdById,
        isHost: true,
        isReady: false, // Host needs to explicitly mark themselves ready
        timeBank: validatedData.startingTimeBank,
        tokensWon: 0,
        isEliminated: false,
        isBot: false
      });

      // Update the game to set the creator as host
      await storage.updateGameHost(game.id, validatedData.createdById);
      
      // If bots are requested, add them
      if (validatedData.hasBots && validatedData.botCount && validatedData.botCount > 0) {
        await addBotsToGame(game.id, validatedData.createdById, validatedData.botCount, validatedData.botProfiles);
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
      // No game ID needed for this endpoint - it returns all public games
      const publicGames = await storage.getPublicGames();
      
      // Only return games that are in the 'waiting' state and are public
      const waitingPublicGames = publicGames.filter(game => 
        game.status === 'waiting' && game.isPublic === true
      );
      
      if (waitingPublicGames.length === 0) {
        return res.status(200).json([]);
      }
      
      const gamesWithParticipants = await Promise.all(
        waitingPublicGames.map(async (game) => {
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
            maxPlayers: 4,
            hostName: players.find(p => p.isHost)?.displayName || 'Unknown',
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
        // Bot actions will be handled differently, likely per round or event
      }
    } catch (error) {
      console.error('Error processing bot actions:', error);
    }
  }, 2000); // Check every 2 seconds
  
  return httpServer;
}