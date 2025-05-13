import { pgTable, text, serial, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull().unique(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
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
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
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
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  endedAt: true,
  code: true, // We'll generate this server-side
});

export const insertGameParticipantSchema = createInsertSchema(gameParticipants).omit({
  id: true,
  joinedAt: true,
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
export type InsertGame = z.infer<typeof insertGameSchema>;

export type GameParticipant = typeof gameParticipants.$inferSelect;
export type InsertGameParticipant = z.infer<typeof insertGameParticipantSchema>;

export type GameRound = typeof gameRounds.$inferSelect;
export type InsertGameRound = z.infer<typeof insertGameRoundSchema>;

export type RoundBid = typeof roundBids.$inferSelect;
export type InsertRoundBid = z.infer<typeof insertRoundBidSchema>;

// WebSocket message types
export type GameEvent = 
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
  | { type: "GAME_CANCELLED"; gameId: number; reason: string };

// Client-specific types
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
