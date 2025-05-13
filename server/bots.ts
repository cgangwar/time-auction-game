// AI Bot profiles and behavior logic
import { storage } from './storage';

export type BotProfile = 'aggressive' | 'conservative' | 'erratic';

export interface Bot {
  id: number;
  username: string;
  displayName: string;
  profile: BotProfile;
}

// Bot profiles with their decision-making tendencies
interface BotBehavior {
  // The min and max percentage of time bank the bot will use
  minTimePercentage: number;
  maxTimePercentage: number;
  // Probability of deciding to go aggressive on a round (0-1)
  aggressiveProbability: number;
  // How much this bot adjusts to other players' moves (0-1)
  adaptability: number;
  // Minimum and maximum hold times in milliseconds
  minHoldTime: number;
  maxHoldTime: number;
}

// Different bot behaviors based on their psychological profiles
const botBehaviors: Record<BotProfile, BotBehavior> = {
  aggressive: {
    minTimePercentage: 0.6,  // Will use at least 60% of available time
    maxTimePercentage: 0.95, // Will use up to 95% of available time
    aggressiveProbability: 0.8, // 80% chance to be aggressive
    adaptability: 0.3, // Doesn't adapt much to other players
    minHoldTime: 3000,  // Minimum 3 seconds
    maxHoldTime: 10000  // Maximum 10 seconds
  },
  conservative: {
    minTimePercentage: 0.2,  // Will use at least 20% of available time
    maxTimePercentage: 0.5,  // Will use at most 50% of available time
    aggressiveProbability: 0.2, // Only 20% chance to be aggressive
    adaptability: 0.7, // Highly adaptive to other players
    minHoldTime: 1000,  // Minimum 1 second
    maxHoldTime: 5000   // Maximum 5 seconds
  },
  erratic: {
    minTimePercentage: 0.1,  // Can use as little as 10% of available time
    maxTimePercentage: 0.9,  // Can use up to 90% of available time
    aggressiveProbability: 0.5, // 50% chance to be aggressive
    adaptability: 0.1, // Very unpredictable, doesn't adapt
    minHoldTime: 500,   // Can hold as little as 0.5 seconds
    maxHoldTime: 15000  // Can hold up to 15 seconds
  }
};

// Available bot players
export const bots: Bot[] = [
  { id: -1, username: 'bot_aggressor', displayName: 'Aggressor Bot', profile: 'aggressive' },
  { id: -2, username: 'bot_cautious', displayName: 'Cautious Bot', profile: 'conservative' },
  { id: -3, username: 'bot_wildcard', displayName: 'Wildcard Bot', profile: 'erratic' },
  { id: -4, username: 'bot_terminator', displayName: 'Terminator Bot', profile: 'aggressive' },
  { id: -5, username: 'bot_tactician', displayName: 'Tactician Bot', profile: 'conservative' },
  { id: -6, username: 'bot_chaotic', displayName: 'Chaotic Bot', profile: 'erratic' }
];

/**
 * Get a random bot of a specified profile, or any profile if not specified
 */
export function getRandomBot(profile?: BotProfile): Bot {
  const availableBots = profile 
    ? bots.filter(bot => bot.profile === profile) 
    : bots;
  
  const randomIndex = Math.floor(Math.random() * availableBots.length);
  return availableBots[randomIndex];
}

/**
 * Get multiple random bots, ensuring no duplicates
 */
export function getRandomBots(count: number, profiles?: BotProfile[]): Bot[] {
  // Clone the bots array to avoid modifying the original
  const availableBots = [...bots];
  const selectedBots: Bot[] = [];
  
  // Shuffle the bots array
  for (let i = availableBots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableBots[i], availableBots[j]] = [availableBots[j], availableBots[i]];
  }
  
  // Select bots based on profiles if specified
  if (profiles && profiles.length > 0) {
    const filteredBots = availableBots.filter(bot => 
      profiles.includes(bot.profile)
    );
    return filteredBots.slice(0, count);
  }
  
  // Otherwise return random selection
  return availableBots.slice(0, count);
}

/**
 * Determine how long a bot will hold the buzzer in milliseconds
 */
export function determineBotHoldTime(
  botId: number, 
  gameId: number, 
  roundNumber: number,
  winningHoldTimeLastRound?: number
): number {
  // Get the bot and its behavior profile
  const bot = bots.find(b => b.id === botId);
  if (!bot) return 3000; // Default 3 seconds if bot not found
  
  const behavior = botBehaviors[bot.profile];
  
  // Get the bot's participant data for this game
  const getParticipantAsync = async () => {
    try {
      return await storage.getParticipant(gameId, botId);
    } catch (err) {
      console.error(`Error getting bot participant data: ${err}`);
      return null;
    }
  };
  
  // Get the game data
  const getGameAsync = async () => {
    try {
      return await storage.getGame(gameId);
    } catch (err) {
      console.error(`Error getting game data: ${err}`);
      return null;
    }
  };
  
  // Determine base hold time based on behavior
  let baseHoldTime = randomInRange(behavior.minHoldTime, behavior.maxHoldTime);
  
  // Adjust based on round number (bots might get more aggressive in later rounds)
  const roundFactor = Math.min(roundNumber / 10, 1); // 0-1 scale based on round progress
  
  // Add randomness based on the bot profile
  if (bot.profile === 'erratic') {
    // Erratic bots have high variance in their decisions
    baseHoldTime = Math.random() < 0.3 
      ? randomInRange(behavior.minHoldTime * 2, behavior.maxHoldTime * 2) // Sometimes go extreme
      : randomInRange(behavior.minHoldTime / 2, behavior.maxHoldTime / 2); // Sometimes be very cautious
  } else if (bot.profile === 'aggressive') {
    // Aggressive bots might go all-in in later rounds
    if (roundNumber > 10 && Math.random() < 0.4) {
      baseHoldTime *= 1.5; // 50% increase in hold time for high-stakes rounds
    }
  } else if (bot.profile === 'conservative') {
    // Conservative bots adjust based on previous rounds
    if (winningHoldTimeLastRound && Math.random() < behavior.adaptability) {
      // Try to slightly beat the last winning time
      baseHoldTime = winningHoldTimeLastRound * (1 + Math.random() * 0.2);
    }
  }
  
  // Ensure the hold time is within the bot's range
  return Math.max(
    behavior.minHoldTime,
    Math.min(behavior.maxHoldTime, baseHoldTime)
  );
}

/**
 * Generate a random number within a range
 */
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Add bot players to a game
 */
export async function addBotsToGame(
  gameId: number, 
  hostId: number, 
  botCount: number, 
  profiles?: BotProfile[]
): Promise<void> {
  try {
    const game = await storage.getGame(gameId);
    if (!game) {
      console.error(`Game ${gameId} not found`);
      return;
    }
    
    const bots = getRandomBots(botCount, profiles);
    
    for (const bot of bots) {
      // First ensure the bot exists as a user in the system
      let botUser = await storage.getUserByUsername(bot.username);
      
      if (!botUser) {
        // Create the bot user
        botUser = await storage.createUser({
          username: bot.username,
          displayName: bot.displayName,
          password: 'bot-password', // Bots don't need real passwords
          email: `${bot.username}@timeauction.bot` // Fake email for bots
        });
      }
      
      // Add the bot as a participant to the game
      await storage.addParticipant({
        gameId,
        userId: botUser.id,
        isHost: false,
        isReady: true, // Bots are always ready
        timeBank: game.startingTimeBank,
        tokensWon: 0,
        isEliminated: false
      });
      
      console.log(`Added bot ${bot.displayName} to game ${gameId}`);
    }
  } catch (err) {
    console.error(`Error adding bots to game: ${err}`);
  }
}

/**
 * Process bot actions for the current round
 */
export async function processBotActions(
  gameId: number, 
  roundId: number
): Promise<void> {
  try {
    // Get game and round information
    const game = await storage.getGame(gameId);
    if (!game || game.status !== 'in_progress') return;
    
    // Get participants
    const participants = await storage.getParticipantsByGame(gameId);
    if (!participants || participants.length === 0) return;
    
    // Identify bot participants
    const botParticipants = participants.filter(p => {
      const bot = bots.find(b => b.id === p.userId);
      return bot !== undefined;
    });
    
    if (botParticipants.length === 0) return; // No bots in this game
    
    // Get previous round data to inform bot decisions (if not round 1)
    let previousRoundWinningTime: number | undefined;
    
    if (game.currentRound > 1) {
      const previousRounds = await storage.getGameRounds(gameId);
      const previousRound = previousRounds.find(r => r.roundNumber === game.currentRound - 1);
      
      if (previousRound && previousRound.winnerId) {
        const previousBids = await storage.getBidsByRound(previousRound.id);
        const winningBid = previousBids.find(b => b.userId === previousRound.winnerId);
        if (winningBid) {
          previousRoundWinningTime = winningBid.bidTime;
        }
      }
    }
    
    // Make bots decide their hold times
    for (const botParticipant of botParticipants) {
      if (botParticipant.isEliminated) continue;
      
      // Get the bot behavior profile
      const bot = bots.find(b => b.id === botParticipant.userId);
      if (!bot) continue;
      
      // Determine how long the bot will hold the buzzer
      const holdTime = determineBotHoldTime(
        botParticipant.userId,
        gameId,
        game.currentRound,
        previousRoundWinningTime
      );
      
      // Create a bid for this bot
      await storage.createBid({
        roundId,
        userId: botParticipant.userId,
        bidTime: holdTime
      });
      
      // Update the bot's time bank
      const holdTimeSeconds = holdTime / 1000;
      if (botParticipant.timeBank !== null) {
        const newTimeBank = Math.max(0, botParticipant.timeBank - holdTimeSeconds);
        await storage.updateParticipantTimeBank(gameId, botParticipant.userId, newTimeBank);
      }
      
      console.log(`Bot ${bot.displayName} held buzzer for ${holdTime}ms in game ${gameId} round ${game.currentRound}`);
    }
  } catch (err) {
    console.error(`Error processing bot actions: ${err}`);
  }
}