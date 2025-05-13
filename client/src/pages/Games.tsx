import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ClientGame } from "@shared/schema";
import AppHeader from "@/components/AppHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Games() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) {
    return null; // Will redirect to login
  }

  // Fetch user's active games
  const { data: activeGames, isLoading: loadingGames, error: gamesError, refetch: refetchGames } = 
    useQuery<ClientGame[]>({
      queryKey: [`/api/users/${user.id}/games`],
      enabled: !!user
    });

  return (
    <>
      <AppHeader />
      
      <div className="flex-1 overflow-y-auto pb-16">
        {/* Header */}
        <div className="bg-gradient-to-r from-secondary to-primary p-5 text-white">
          <h2 className="font-display text-xl font-bold mb-1">Your Games</h2>
          <p className="text-white/80 text-sm">All your active and completed games</p>
        </div>
        
        {/* Active Games */}
        <div className="px-4 py-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-display font-bold text-neutral-dark text-lg">Active Games</h3>
            <button onClick={() => refetchGames()} className="text-primary text-sm font-medium">
              Refresh
            </button>
          </div>
          
          <div className="space-y-3">
            {loadingGames ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex">
                        {Array.from({ length: 4 }).map((_, j) => (
                          <Skeleton key={j} className="w-8 h-8 rounded-full -ml-1 first:ml-0" />
                        ))}
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : activeGames && activeGames.length > 0 ? (
              activeGames.map((game) => (
                <Card key={game.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <div className={`bg-${game.status === 'in_progress' ? 'accent-light' : 'neutral-light'} text-${game.status === 'in_progress' ? 'accent-dark' : 'neutral'} text-xs font-medium px-2 py-1 rounded-full`}>
                          {game.status === 'waiting' ? 'Waiting' : game.status === 'in_progress' ? 'In Progress' : 'Completed'}
                        </div>
                        {game.status === 'in_progress' && (
                          <div className="ml-2 text-xs text-neutral">Round <span className="font-semibold">{game.currentRound}</span>/{game.totalRounds}</div>
                        )}
                        {game.status === 'waiting' && (
                          <div className="ml-2 text-xs text-neutral">{game.players.length}/4 players</div>
                        )}
                      </div>
                      <div className="text-xs text-neutral">
                        {game.startedAt ? `Started ${new Date(game.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Created ${new Date(game.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex">
                        {game.players.map((player, index) => (
                          <div 
                            key={player.id} 
                            className={`w-8 h-8 rounded-full bg-${index === 0 ? 'primary' : index === 1 ? 'secondary' : index === 2 ? 'accent' : '[#10B981]'} flex items-center justify-center text-white text-xs font-medium -ml-1 first:ml-0 border-2 border-white`}
                            style={{ zIndex: 4 - index }}
                          >
                            {player.initials}
                          </div>
                        ))}
                        {/* Add placeholder spots for empty player slots */}
                        {Array.from({ length: Math.max(0, 4 - game.players.length) }).map((_, i) => (
                          <div 
                            key={`empty-${i}`} 
                            className="w-8 h-8 rounded-full bg-neutral-light flex items-center justify-center text-neutral-dark text-xs font-medium -ml-1 border-2 border-white"
                            style={{ zIndex: 4 - (game.players.length + i) }}
                          >
                            ?
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        className={game.status === 'in_progress' ? "bg-primary-dark" : "bg-primary"}
                        onClick={() => game.status === 'waiting' ? navigate(`/lobby/${game.id}`) : navigate(`/game/${game.id}`)}
                      >
                        <span className="material-icons text-sm mr-1">{game.status === 'waiting' ? 'visibility' : 'play_arrow'}</span>
                        {game.status === 'waiting' ? 'View' : game.status === 'in_progress' ? 'Resume' : 'Results'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-neutral mb-3">You don't have any active games</p>
                  <Button 
                    variant="default" 
                    className="bg-primary"
                    onClick={() => navigate("/")}
                  >
                    Create a New Game
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        {/* Completed Games */}
        <div className="px-4 pb-20">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-display font-bold text-neutral-dark text-lg">Game History</h3>
          </div>
          
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-neutral mb-3">Your completed games will appear here</p>
              <p className="text-sm text-neutral-light">Complete a game to see your results and performance</p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <BottomNavigation active="games" />
    </>
  );
}

export default Games;