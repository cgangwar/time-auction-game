import { ClientPlayer } from '@shared/schema';

interface PlayerTokensProps {
  players: ClientPlayer[];
}

function PlayerTokens({ players }: PlayerTokensProps) {
  // Only show non-eliminated players
  const activePlayers = players.filter(player => !player.isEliminated);

  // Sort players by tokens won (descending)
  const sortedPlayers = [...activePlayers].sort((a, b) => b.tokensWon - a.tokensWon);

  // Color palette for player avatars
  const colors = ['primary', 'secondary', 'accent', '[#10B981]'];

  return (
    <div className="flex justify-around mb-1 mt-3">
      {sortedPlayers.map((player, index) => (
        <div key={player.id} className="flex flex-col items-center">
          <div className="relative">
            <div className={`w-10 h-10 rounded-full bg-${colors[index % colors.length]} flex items-center justify-center text-white text-sm font-medium`}>
              {player.initials}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-neutral-light flex items-center justify-center text-xs font-bold text-neutral-dark">
              {player.tokensWon}
            </div>
          </div>
          <div className="mt-1 text-xs text-neutral-dark font-medium truncate max-w-[60px] text-center">
            {player.displayName.split(' ')[0]}
          </div>
        </div>
      ))}
      
      {/* Add placeholder spots if fewer than 4 players */}
      {Array.from({ length: Math.max(0, 4 - activePlayers.length) }).map((_, index) => (
        <div key={`empty-${index}`} className="flex flex-col items-center opacity-30">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-neutral flex items-center justify-center text-white text-sm font-medium">
              ?
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-neutral-light flex items-center justify-center text-xs font-bold text-neutral-dark">
              0
            </div>
          </div>
          <div className="mt-1 text-xs text-neutral-dark font-medium truncate max-w-[60px] text-center">
            Empty
          </div>
        </div>
      ))}
    </div>
  );
}

export default PlayerTokens;
