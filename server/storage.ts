import {
  users,
  games,
  gameParticipants,
  gameRounds,
  roundBids,
  type User,
  type InsertUser,
  type Game,
  type InsertGame,
  type GameParticipant,
  type InsertGameParticipant,
  type GameRound,
  type InsertGameRound,
  type RoundBid,
  type InsertRoundBid,
  type ClientGame,
  type ClientPlayer,
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Game operations
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: number): Promise<Game | undefined>;
  getGameByCode(code: string): Promise<Game | undefined>;
  updateGameStatus(id: number, status: "waiting" | "in_progress" | "completed"): Promise<void>;
  updateGameCurrentRound(id: number, roundNumber: number): Promise<void>;
  setGameStartTime(id: number): Promise<void>;
  setGameEndTime(id: number): Promise<void>;
  getPublicGames(): Promise<Game[]>;
  getActiveGames(userId: number): Promise<ClientGame[]>;

  // Game participant operations
  addParticipant(participant: InsertGameParticipant): Promise<GameParticipant>;
  getParticipant(gameId: number, userId: number): Promise<GameParticipant | undefined>;
  getParticipantsByGame(gameId: number): Promise<GameParticipant[]>;
  updateParticipantReadyStatus(gameId: number, userId: number, isReady: boolean): Promise<void>;
  updateParticipantHostStatus(gameId: number, userId: number, isHost: boolean): Promise<void>;
  updateParticipantTimeBank(gameId: number, userId: number, timeBank: number): Promise<void>;
  updateParticipantTokens(gameId: number, userId: number, tokens: number): Promise<void>;
  eliminateParticipant(gameId: number, userId: number): Promise<void>;

  // Game round operations
  createRound(round: InsertGameRound): Promise<GameRound>;
  getRound(id: number): Promise<GameRound | undefined>;
  getGameRounds(gameId: number): Promise<GameRound[]>;
  completeRound(roundId: number, winnerId: number): Promise<void>;

  // Round bid operations
  createBid(bid: InsertRoundBid): Promise<RoundBid>;
  getBidsByRound(roundId: number): Promise<RoundBid[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private games: Map<number, Game>;
  private gameParticipants: Map<string, GameParticipant>; // key: `${gameId}-${userId}`
  private gameRounds: Map<number, GameRound>;
  private roundBids: Map<number, RoundBid>;
  
  private userIdCounter: number;
  private gameIdCounter: number;
  private participantIdCounter: number;
  private roundIdCounter: number;
  private bidIdCounter: number;

  constructor() {
    this.users = new Map();
    this.games = new Map();
    this.gameParticipants = new Map();
    this.gameRounds = new Map();
    this.roundBids = new Map();
    
    this.userIdCounter = 1;
    this.gameIdCounter = 1;
    this.participantIdCounter = 1;
    this.roundIdCounter = 1;
    this.bidIdCounter = 1;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const user: User = { ...insertUser, id, createdAt: now };
    this.users.set(id, user);
    return user;
  }

  // Game operations
  async createGame(insertGame: InsertGame): Promise<Game> {
    const id = this.gameIdCounter++;
    const now = new Date();
    
    // Ensure all required fields have default values
    const game: Game = { 
      ...insertGame, 
      id,
      code: insertGame.code || '',
      status: "waiting", 
      currentRound: insertGame.currentRound || 0,
      totalRounds: insertGame.totalRounds || 10,
      startingTimeBank: insertGame.startingTimeBank || 600,
      isPublic: insertGame.isPublic ?? true,
      createdAt: now, 
      startedAt: null, 
      endedAt: null,
      hasBots: insertGame.hasBots || false,
      botCount: insertGame.botCount || 0,
      botProfiles: insertGame.botProfiles || []
    };
    
    this.games.set(id, game);
    console.log(`Created new game with ID ${id}, status: ${game.status}`);
    return game;
  }

  async getGame(id: number): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async getGameByCode(code: string): Promise<Game | undefined> {
    return Array.from(this.games.values()).find((game) => game.code === code);
  }

  async updateGameStatus(id: number, status: "waiting" | "in_progress" | "completed"): Promise<void> {
    const game = this.games.get(id);
    if (game) {
      this.games.set(id, { ...game, status });
    }
  }

  async updateGameCurrentRound(id: number, roundNumber: number): Promise<void> {
    const game = this.games.get(id);
    if (game) {
      this.games.set(id, { ...game, currentRound: roundNumber });
    }
  }

  async setGameStartTime(id: number): Promise<void> {
    const game = this.games.get(id);
    if (game) {
      this.games.set(id, { ...game, startedAt: new Date() });
    }
  }

  async setGameEndTime(id: number): Promise<void> {
    const game = this.games.get(id);
    if (game) {
      this.games.set(id, { ...game, endedAt: new Date() });
    }
  }

  async getPublicGames(): Promise<Game[]> {
    return Array.from(this.games.values()).filter(
      (game) => game.isPublic && game.status === "waiting"
    );
  }

  async getActiveGames(userId: number): Promise<ClientGame[]> {
    // Get all game IDs where the user is a participant
    const participantEntries = Array.from(this.gameParticipants.entries())
      .filter(([key, participant]) => participant.userId === userId)
      .map(([key, participant]) => participant);
    
    const gameIds = new Set(participantEntries.map(p => p.gameId));
    
    // Map games to client format
    const clientGames: ClientGame[] = [];
    
    for (const gameId of gameIds) {
      const game = this.games.get(gameId);
      if (!game) continue;
      
      const gameParticipants = await this.getParticipantsByGame(gameId);
      
      // Get all users for this game
      const userIds = gameParticipants.map(p => p.userId);
      const gameUsers: Map<number, User> = new Map();
      
      for (const userId of userIds) {
        const user = await this.getUser(userId);
        if (user) {
          gameUsers.set(userId, user);
        }
      }
      
      // Map participants to client players
      const players: ClientPlayer[] = gameParticipants.map(p => {
        const user = gameUsers.get(p.userId);
        const initials = user ? user.displayName.split(' ').map(part => part[0]).join('').toUpperCase() : '??';
        
        return {
          id: p.userId,
          username: user?.username || 'unknown',
          displayName: user?.displayName || 'Unknown Player',
          initials,
          isHost: p.isHost,
          isReady: p.isReady,
          timeBank: p.timeBank || game.startingTimeBank,
          tokensWon: p.tokensWon,
          isEliminated: p.isEliminated
        };
      });
      
      clientGames.push({
        id: game.id,
        code: game.code,
        hostId: game.createdById,
        status: game.status,
        currentRound: game.currentRound,
        totalRounds: game.totalRounds,
        startingTimeBank: game.startingTimeBank,
        isPublic: game.isPublic,
        players,
        createdAt: game.createdAt.toISOString(),
        startedAt: game.startedAt?.toISOString(),
        endedAt: game.endedAt?.toISOString(),
      });
    }
    
    return clientGames;
  }

  // Game participant operations
  async addParticipant(insertParticipant: InsertGameParticipant): Promise<GameParticipant> {
    const id = this.participantIdCounter++;
    const now = new Date();
    
    const participant: GameParticipant = {
      ...insertParticipant,
      id,
      joinedAt: now
    };
    
    const key = `${participant.gameId}-${participant.userId}`;
    this.gameParticipants.set(key, participant);
    
    return participant;
  }

  async getParticipant(gameId: number, userId: number): Promise<GameParticipant | undefined> {
    const key = `${gameId}-${userId}`;
    return this.gameParticipants.get(key);
  }

  async getParticipantsByGame(gameId: number): Promise<GameParticipant[]> {
    return Array.from(this.gameParticipants.values()).filter(
      (participant) => participant.gameId === gameId
    );
  }

  async updateParticipantReadyStatus(gameId: number, userId: number, isReady: boolean): Promise<void> {
    const key = `${gameId}-${userId}`;
    const participant = this.gameParticipants.get(key);
    
    if (participant) {
      this.gameParticipants.set(key, { ...participant, isReady });
    }
  }
  
  async updateParticipantHostStatus(gameId: number, userId: number, isHost: boolean): Promise<void> {
    const key = `${gameId}-${userId}`;
    const participant = this.gameParticipants.get(key);
    
    if (participant) {
      this.gameParticipants.set(key, { ...participant, isHost });
    }
  }

  async updateParticipantTimeBank(gameId: number, userId: number, timeBank: number): Promise<void> {
    const key = `${gameId}-${userId}`;
    const participant = this.gameParticipants.get(key);
    
    if (participant) {
      this.gameParticipants.set(key, { ...participant, timeBank });
    }
  }

  async updateParticipantTokens(gameId: number, userId: number, tokens: number): Promise<void> {
    const key = `${gameId}-${userId}`;
    const participant = this.gameParticipants.get(key);
    
    if (participant) {
      this.gameParticipants.set(key, { ...participant, tokensWon: tokens });
    }
  }

  async eliminateParticipant(gameId: number, userId: number): Promise<void> {
    const key = `${gameId}-${userId}`;
    const participant = this.gameParticipants.get(key);
    
    if (participant) {
      this.gameParticipants.set(key, { ...participant, isEliminated: true });
    }
  }

  // Game round operations
  async createRound(insertRound: InsertGameRound): Promise<GameRound> {
    const id = this.roundIdCounter++;
    const now = new Date();
    
    const round: GameRound = {
      ...insertRound,
      id,
      startedAt: now,
      endedAt: null
    };
    
    this.gameRounds.set(id, round);
    return round;
  }

  async getRound(id: number): Promise<GameRound | undefined> {
    return this.gameRounds.get(id);
  }

  async getGameRounds(gameId: number): Promise<GameRound[]> {
    return Array.from(this.gameRounds.values())
      .filter((round) => round.gameId === gameId)
      .sort((a, b) => a.roundNumber - b.roundNumber);
  }

  async completeRound(roundId: number, winnerId: number): Promise<void> {
    const round = this.gameRounds.get(roundId);
    
    if (round) {
      this.gameRounds.set(roundId, {
        ...round,
        winnerId,
        endedAt: new Date()
      });
    }
  }

  // Round bid operations
  async createBid(insertBid: InsertRoundBid): Promise<RoundBid> {
    const id = this.bidIdCounter++;
    const now = new Date();
    
    const bid: RoundBid = {
      ...insertBid,
      id,
      createdAt: now
    };
    
    this.roundBids.set(id, bid);
    return bid;
  }

  async getBidsByRound(roundId: number): Promise<RoundBid[]> {
    return Array.from(this.roundBids.values()).filter(
      (bid) => bid.roundId === roundId
    );
  }
}

export const storage = new MemStorage();
