import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type LeaderboardEntry = {
  id: number;
  username: string;
  displayName: string;
  gamesWon: number;
  gamesPlayed: number;
  winRate: number;
  totalTokens: number;
  rank: number;
};

function Leaderboard() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("weekly");

  // Mock data for the leaderboard (to be replaced with API call)
  const mockLeaderboard: LeaderboardEntry[] = [
    {
      id: 1,
      username: "champion",
      displayName: "Champion Player",
      gamesWon: 28,
      gamesPlayed: 42,
      winRate: 67,
      totalTokens: 523,
      rank: 1
    },
    {
      id: 2,
      username: "strategist",
      displayName: "Master Strategist",
      gamesWon: 25,
      gamesPlayed: 39,
      winRate: 64,
      totalTokens: 498,
      rank: 2
    },
    {
      id: 3,
      username: "timelord",
      displayName: "Time Lord",
      gamesWon: 22,
      gamesPlayed: 37,
      winRate: 59,
      totalTokens: 465,
      rank: 3
    },
    {
      id: 4,
      username: "gamemaster",
      displayName: "Game Master",
      gamesWon: 20,
      gamesPlayed: 36,
      winRate: 56,
      totalTokens: 412,
      rank: 4
    },
    {
      id: 5,
      username: "bidexpert",
      displayName: "Bidding Expert",
      gamesWon: 18,
      gamesPlayed: 34,
      winRate: 53,
      totalTokens: 389,
      rank: 5
    },
    {
      id: 6,
      username: "timekeeper",
      displayName: "Timekeeper",
      gamesWon: 16,
      gamesPlayed: 32,
      winRate: 50,
      totalTokens: 356,
      rank: 6
    },
    {
      id: 7,
      username: "auctioneer",
      displayName: "The Auctioneer",
      gamesWon: 15,
      gamesPlayed: 31,
      winRate: 48,
      totalTokens: 332,
      rank: 7
    },
    {
      id: 8,
      username: "tokenmaster",
      displayName: "Token Master",
      gamesWon: 14,
      gamesPlayed: 30,
      winRate: 47,
      totalTokens: 305,
      rank: 8
    },
    // Include current user at a random position
    {
      id: user?.id || 999,
      username: user?.username || "you",
      displayName: user?.displayName || "You",
      gamesWon: 3,
      gamesPlayed: 7,
      winRate: 43,
      totalTokens: 65,
      rank: 42
    }
  ];

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) {
    return null; // Will redirect to login
  }

  // Helper function to get background color based on rank
  const getRankColor = (rank: number) => {
    if (rank === 1) return "bg-[#FFD700]"; // Gold
    if (rank === 2) return "bg-[#C0C0C0]"; // Silver
    if (rank === 3) return "bg-[#CD7F32]"; // Bronze
    return "bg-neutral";
  };

  // Helper function to get text color based on rank
  const getRankTextColor = (rank: number) => {
    if (rank <= 3) return "text-white";
    return "text-neutral-light";
  };

  return (
    <>
      <AppHeader />
      
      <div className="flex-1 overflow-y-auto pb-16">
        {/* Header */}
        <div className="bg-gradient-to-r from-accent to-secondary p-5 text-white">
          <h2 className="font-display text-xl font-bold mb-1">Leaderboard</h2>
          <p className="text-white/80 text-sm">See how you rank against other players</p>
        </div>
        
        {/* Leaderboard Tabs */}
        <div className="p-4">
          <Tabs defaultValue="weekly" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="alltime">All Time</TabsTrigger>
            </TabsList>
            
            <TabsContent value="weekly" className="mt-4">
              <LeaderboardList entries={mockLeaderboard} period="weekly" currentUserId={user.id} />
            </TabsContent>
            
            <TabsContent value="monthly" className="mt-4">
              <LeaderboardList entries={mockLeaderboard} period="monthly" currentUserId={user.id} />
            </TabsContent>
            
            <TabsContent value="alltime" className="mt-4">
              <LeaderboardList entries={mockLeaderboard} period="all time" currentUserId={user.id} />
            </TabsContent>
          </Tabs>
        </div>
        
        {/* User's Stats */}
        <div className="px-4 pb-20">
          <h3 className="font-display font-bold text-neutral-dark text-lg mb-3">Your Stats</h3>
          
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm text-neutral mb-1">Current Rank</p>
                  <p className="font-display text-2xl font-bold text-secondary">{mockLeaderboard.find(entry => entry.id === user.id)?.rank || '-'}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-neutral mb-1">Win Rate</p>
                  <p className="font-display text-2xl font-bold text-secondary">{mockLeaderboard.find(entry => entry.id === user.id)?.winRate || 0}%</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-neutral mb-1">Games Won</p>
                  <p className="font-display text-2xl font-bold text-primary">{mockLeaderboard.find(entry => entry.id === user.id)?.gamesWon || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-neutral mb-1">Total Tokens</p>
                  <p className="font-display text-2xl font-bold text-primary">{mockLeaderboard.find(entry => entry.id === user.id)?.totalTokens || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <BottomNavigation active="leaderboard" />
    </>
  );
}

interface LeaderboardListProps {
  entries: LeaderboardEntry[];
  period: string;
  currentUserId: number;
}

function LeaderboardList({ entries, period, currentUserId }: LeaderboardListProps) {
  // Sort entries by rank
  const sortedEntries = [...entries].sort((a, b) => a.rank - b.rank);
  
  // Helper function to get background color based on rank
  const getRankColor = (rank: number) => {
    if (rank === 1) return "bg-[#FFD700]"; // Gold
    if (rank === 2) return "bg-[#C0C0C0]"; // Silver
    if (rank === 3) return "bg-[#CD7F32]"; // Bronze
    return "bg-neutral-light";
  };
  
  return (
    <div className="space-y-3">
      {sortedEntries.map(entry => (
        <Card 
          key={entry.id} 
          className={`${entry.id === currentUserId ? 'border-primary border-2' : ''}`}
        >
          <CardContent className="p-3 flex items-center">
            <div className={`w-8 h-8 rounded-full ${getRankColor(entry.rank)} flex items-center justify-center text-white font-bold text-sm`}>
              {entry.rank}
            </div>
            <div className="ml-3 flex-1">
              <div className="font-medium text-neutral-dark">
                {entry.displayName}
                {entry.id === currentUserId && <span className="ml-2 text-xs text-primary font-bold">(You)</span>}
              </div>
              <div className="text-xs text-neutral mt-0.5">
                <span className="font-medium">{entry.gamesWon}</span> wins • <span className="font-medium">{entry.totalTokens}</span> tokens
              </div>
            </div>
            <div className="font-display font-bold text-lg text-secondary-dark">
              {entry.winRate}%
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default Leaderboard;