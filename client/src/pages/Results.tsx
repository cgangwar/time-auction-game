import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useGame } from "@/contexts/GameContext";
import { Button } from "@/components/ui/button";

function Results() {
  const [, params] = useRoute("/results/:id/:round");
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { gameState } = useGame();
  
  const gameId = params?.id ? parseInt(params.id) : undefined;
  const roundNumber = params?.round ? parseInt(params.round) : undefined;
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user || !gameId || !roundNumber || !gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="material-icons text-4xl text-neutral animate-spin">refresh</span>
          <p className="mt-4 text-neutral">Loading results...</p>
        </div>
      </div>
    );
  }
  
  // Find winner for this round
  const lastRoundEvent = gameState.lastEvent?.type === 'ROUND_END' ? gameState.lastEvent : null;
  const winnerId = lastRoundEvent?.winnerId;
  const winnerHoldTime = lastRoundEvent?.winnerHoldTime || 0;
  const winner = gameState.players.find(p => p.id === winnerId);
  
  // Format time showing milliseconds
  const formatTimeWithMs = (ms: number) => {
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
    }
  };
  
  // Sort players by hold time for this round (descending)
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    // Winner should always be first
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    
    // Otherwise sort by tokens (descending)
    return b.tokensWon - a.tokensWon;
  });
  
  const handleContinue = () => {
    navigate(`/game/${gameId}`);
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Round Results Header */}
      <div className="bg-primary p-5 text-white text-center">
        <h2 className="font-display text-xl font-bold mb-1">Round {roundNumber} Results</h2>
        <p className="text-white/80 text-sm">
          {gameState.totalRounds - roundNumber} rounds remaining
        </p>
      </div>
      
      {/* Round Winner */}
      <div className="p-6 text-center border-b border-neutral-light">
        <div className="inline-block rounded-full bg-neutral-lighter p-1.5 mb-3">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
            <span className="material-icons text-white text-3xl">emoji_events</span>
          </div>
        </div>
        <h3 className="font-display font-bold text-lg text-neutral-dark">
          {winner ? winner.displayName : 'Unknown'} won this round!
        </h3>
        <p className="text-sm text-neutral mt-1">
          Held the buzzer for <span className="font-medium">{formatTimeWithMs(winnerHoldTime)}</span>
        </p>
      </div>
      
      {/* Player Rankings */}
      <div className="p-4 flex-1 overflow-y-auto">
        <h3 className="font-display font-bold text-neutral-dark text-lg mb-3">Player Rankings</h3>
        
        <div className="space-y-3">
          {sortedPlayers.map((player, index) => {
            const isWinner = player.id === winnerId;
            
            return (
              <div 
                key={player.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-neutral-light flex items-center"
              >
                <div className={`w-7 h-7 rounded-full bg-${index === 0 ? 'secondary' : index === 1 ? 'primary' : 'neutral'} flex items-center justify-center text-white font-medium text-sm`}>
                  {index + 1}
                </div>
                <div className={`w-10 h-10 rounded-full bg-${index === 0 ? 'secondary' : index === 1 ? 'primary' : index === 2 ? '[#10B981]' : 'accent'} flex items-center justify-center text-white font-medium ml-3`}>
                  {player.initials}
                </div>
                <div className="ml-3 flex-1">
                  <div className="font-medium text-neutral-dark">{player.displayName}</div>
                  <div className="text-xs text-neutral mt-0.5">
                    {player.tokensWon} tokens • {formatTimeWithMs(player.timeBank * 1000)} remaining
                  </div>
                </div>
                <div className="font-display font-bold text-lg text-secondary-dark">
                  {isWinner ? formatTimeWithMs(winnerHoldTime) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Next Round Button */}
      <div className="p-4 border-t border-neutral-light">
        <Button 
          className="w-full py-6" 
          onClick={handleContinue}
        >
          <span className="material-icons mr-2">play_arrow</span>
          Continue to Round {roundNumber + 1}
        </Button>
      </div>
    </div>
  );
}

export default Results;
