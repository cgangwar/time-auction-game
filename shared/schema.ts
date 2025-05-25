import { pgTable, text, serial, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";

export interface GameState {
  id: number;
  code: string;
  createdById: number;
  status: 'waiting' | 'in_progress' | 'completed';
  currentRound: number;
  totalRounds: number;
  startingTimeBank: number;
  isPublic: boolean;
  hasBots: boolean;
  botCount?: number;
  botProfiles?: string[];
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  maxHoldTimeLastRound: number | null;
  roundWinnerId?: number;
  players: PlayerState[];
  lastEvent?: GameEvent;
  countdown?: number;
}

export interface PlayerState {
  id: number;
  username: string;
  displayName: string;
  isHost: boolean;
  isReady: boolean;
  timeBank: number;
  tokensWon: number;
  isEliminated: boolean;
  isBot: boolean;
  botProfile?: 'aggressive' | 'conservative' | 'erratic';
  hasBidThisRound: boolean;
  lastHoldTime?: number;
}

export type GameEvent = {
  type: string;
  gameId: number;
  [key: string]: any;
};
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gameStatusEnum = pgEnum("game_status", [
  "waiting",
  "in_progress",
  "completed",
]);

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdById: integer("created_by_id").notNull().references(() => users.id),
  status: gameStatusEnum("status").notNull().default("waiting"),
  currentRound: integer("current_round").notNull().default(1),
  totalRounds: integer("total_rounds").notNull().default(18),
  startingTimeBank: integer("starting_time_bank").notNull().default(600), // 10 minutes in seconds
  isPublic: boolean("is_public").notNull().default(true),
  hasBots: boolean("has_bots").notNull().default(false), // Whether this game includes AI bots
  botCount: integer("bot_count").default(0), // Number of bots if using AI mode
  botProfiles: text("bot_profiles").array(), // Array of bot profile types
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  maxHoldTimeLastRound: integer("max_hold_time_last_round").notNull().default(0), // Max hold time in ms for the previous round
  roundWinnerId: integer("round_winner_id").references(() => users.id), // ID of the user who won the last round
});

export const gameParticipants = pgTable("game_participants", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => games.id),
  userId: integer("user_id").notNull().references(() => users.id),
  isHost: boolean("is_host").notNull().default(false),
  isReady: boolean("is_ready").notNull().default(false),
  timeBank: integer("time_bank"), // in seconds
  tokensWon: integer("tokens_won").notNull().default(0),
  isEliminated: boolean("is_eliminated").notNull().default(false),
  isBot: boolean("is_bot").notNull().default(false), // Whether this participant is an AI bot
  botProfile: text("bot_profile"), // Type of bot profile if this is a bot
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  hasBidThisRound: boolean("has_bid_this_round").notNull().default(false),
  lastHoldTime: integer("last_hold_time").notNull().default(0), // Hold time in ms for the current round bid
});

export const gameRounds = pgTable("game_rounds", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => games.id),
  roundNumber: integer("round_number").notNull(),
  winnerId: integer("winner_id").references(() => users.id),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

export const roundBids = pgTable("round_bids", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id").notNull().references(() => gameRounds.id),
  userId: integer("user_id").notNull().references(() => users.id),
  bidTime: integer("bid_time").notNull(), // in milliseconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  username: z.string().min(2, "Username must be at least 2 characters").max(20, "Username must be less than 20 characters"),
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(50, "Display name must be less than 50 characters").optional(),
  email: z.string().email("Please enter a valid email address").optional(),
  password: z.string().optional(),
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  endedAt: true,
  code: true, // We'll generate this server-side
}).extend({
  hasBots: z.boolean().optional().default(false),
  botCount: z.number().int().min(0).max(5).optional().default(0),
  botProfiles: z.array(z.enum(['aggressive', 'conservative', 'erratic'])).optional()
});

export const insertGameParticipantSchema = createInsertSchema(gameParticipants).omit({
  id: true,
  joinedAt: true,
}).extend({
  isBot: z.boolean().default(false), // Default to human player
  botProfile: z.enum(['aggressive', 'conservative', 'erratic']).optional()
});

export const insertGameRoundSchema = createInsertSchema(gameRounds).omit({
  id: true,
  startedAt: true,
  endedAt: true,
});

export const insertRoundBidSchema = createInsertSchema(roundBids).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema> & { code?: string };

export type GameParticipant = typeof gameParticipants.$inferSelect;
export type InsertGameParticipant = z.infer<typeof insertGameParticipantSchema>;

export type GameRound = typeof gameRounds.$inferSelect;
export type InsertGameRound = z.infer<typeof insertGameRoundSchema>;

export type RoundBid = typeof roundBids.$inferSelect;
export type InsertRoundBid = z.infer<typeof insertRoundBidSchema>;

// WebSocket message types
export type GameEvent = 
  | { type: "IDENTIFY"; userId: number }
  | { type: "IDENTIFIED"; userId: number }
  | { type: "JOIN_GAME"; gameId: number; userId: number; username: string; displayName: string }
  | { type: "PLAYER_READY"; gameId: number; userId: number; isReady: boolean }
  | { type: "GAME_STARTING"; gameId: number; countdown: number }
  | { type: "GAME_START"; gameId: number }
  | { type: "ROUND_START"; gameId: number; roundNumber: number }
  | { type: "BUZZER_HOLD"; gameId: number; userId: number; timestamp: number }
  | { type: "BUZZER_RELEASE"; gameId: number; userId: number; timestamp: number; holdTime: number }
  | { type: "ROUND_END"; gameId: number; roundNumber: number; winnerId: number; winnerHoldTime: number; nextRound: number }
  | { type: "GAME_END"; gameId: number; rankings: Array<{userId: number; username: string; displayName: string; tokens: number; timeRemaining: number}> }
  | { type: "PLAYER_LEFT"; gameId: number; userId: number }
  | { type: "GAME_CANCELLED"; gameId: number; reason: string }
  | { type: "GAME_STATE"; gameId: number; code: string; status: string; currentRound: number;
      totalRounds: number; startingTimeBank: number; isPublic: boolean; players: ClientPlayer[];
      maxHoldTimeLastRound: number; roundWinnerId: number | null;
      hasBots?: boolean; botCount?: number; botProfiles?: BotProfileType[] }
  | { type: "ERROR"; message: string };

// Client-specific types
export type BotProfileType = 'aggressive' | 'conservative' | 'erratic';

export type ClientPlayer = {
  id: number;
  username: string;
  displayName: string;
  initials: string;
  isHost: boolean;
  isReady: boolean;
  timeBank: number;
  tokensWon: number;
  isEliminated: boolean;
  isBot?: boolean;
  botProfile?: BotProfileType;
  hasBidThisRound: boolean;
  lastHoldTime: number;
};

export type ClientGame = {
  id: number;
  code: string;
  hostId: number;
  status: "waiting" | "in_progress" | "completed";
  currentRound: number;
  totalRounds: number;
  startingTimeBank: number;
  isPublic: boolean;
  hasBots?: boolean;
  botCount?: number;
  botProfiles?: BotProfileType[];
  players: ClientPlayer[];
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
};

export type ClientRound = {
  roundNumber: number;
  winnerId?: number;
  players: Array<{
    userId: number;
    holdTime: number;
  }>;
  startedAt: string;
  endedAt?: string;
};
