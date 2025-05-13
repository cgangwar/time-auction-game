import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ClientGame } from "@shared/schema";
import AppHeader from "@/components/AppHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

function Home() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const { toast } = useToast();

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

  // Fetch public lobbies
  const { data: publicLobbies, isLoading: loadingLobbies, error: lobbiesError, refetch: refetchLobbies } = 
    useQuery<any[]>({
      queryKey: ['/api/games/public'],
      enabled: !!user
    });

  // Create new game mutation
  const createGameMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/games', data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Game created!",
        description: `Game code: ${data.code}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/games`] });
      navigate(`/lobby/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error creating game",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Join game mutation
  const joinGameMutation = useMutation({
    mutationFn: async (data: { code: string, userId: number }) => {
      const response = await apiRequest('POST', '/api/games/join', data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Joined game!",
        description: `Game code: ${data.code}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/games`] });
      navigate(`/lobby/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error joining game",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Create game form
  const createGameSchema = z.object({
    totalRounds: z.coerce.number().int().min(1).max(30).default(18),
    startingTimeBank: z.coerce.number().int().min(60).max(1200).default(600),
    isPublic: z.boolean().default(true),
  });

  const createGameForm = useForm<z.infer<typeof createGameSchema>>({
    resolver: zodResolver(createGameSchema),
    defaultValues: {
      totalRounds: 18,
      startingTimeBank: 600,
      isPublic: true,
    },
  });

  // Join game form
  const joinGameSchema = z.object({
    code: z.string().length(6).toUpperCase(),
  });

  const joinGameForm = useForm<z.infer<typeof joinGameSchema>>({
    resolver: zodResolver(joinGameSchema),
    defaultValues: {
      code: "",
    },
  });

  // Handle create game submission
  const onCreateGame = (data: z.infer<typeof createGameSchema>) => {
    createGameMutation.mutate({
      ...data,
      createdById: user.id,
    });
    setShowCreateDialog(false);
  };

  // Handle join game submission
  const onJoinGame = (data: z.infer<typeof joinGameSchema>) => {
    joinGameMutation.mutate({
      code: data.code,
      userId: user.id,
    });
    setShowJoinDialog(false);
  };

  // Handle game join from lobby list
  const handleJoinLobby = (gameId: number, code: string) => {
    joinGameMutation.mutate({
      code,
      userId: user.id,
    });
  };

  return (
    <>
      <AppHeader />
      
      <div className="flex-1 overflow-y-auto pb-16">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-secondary p-5 text-white">
          <h2 className="font-display text-xl font-bold mb-1">Welcome, {user.displayName}!</h2>
          <p className="text-white/80 text-sm">Ready to test your strategy and timing?</p>
        </div>
        
        {/* Quick Start */}
        <div className="p-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-display font-bold text-neutral-dark text-lg mb-3">Quick Start</h3>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="default" 
                  className="bg-primary text-white py-6"
                  onClick={() => setShowJoinDialog(true)}
                >
                  <span className="material-icons mr-2">group_add</span>
                  Join Game
                </Button>
                <Button 
                  variant="default" 
                  className="bg-secondary text-white py-6"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <span className="material-icons mr-2">casino</span>
                  Create Game
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Active Games */}
        <div className="px-4 pb-4">
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
                    onClick={() => setShowCreateDialog(true)}
                  >
                    Create Your First Game
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        {/* Public Lobbies */}
        <div className="px-4 pb-20">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-display font-bold text-neutral-dark text-lg">Public Lobbies</h3>
            <button onClick={() => refetchLobbies()} className="text-primary text-sm font-medium">
              Refresh
            </button>
          </div>
          
          <div className="space-y-3">
            {loadingLobbies ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <Skeleton className="h-6 w-36" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-9 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : publicLobbies && publicLobbies.length > 0 ? (
              publicLobbies.map((lobby) => (
                <Card key={lobby.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium text-neutral-dark">{lobby.code}</div>
                      <div className="flex items-center">
                        <span className="material-icons text-sm text-green-500">circle</span>
                        <span className="ml-1 text-xs text-neutral">{lobby.playerCount}/{lobby.maxPlayers} players</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-neutral">Created by <span className="font-medium text-neutral-dark">{lobby.hostName}</span></div>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => handleJoinLobby(lobby.id, lobby.code)}
                      >
                        Join
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-neutral">No public lobbies available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      
      <BottomNavigation active="home" />
      
      {/* Create Game Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Game</DialogTitle>
            <DialogDescription>Set up your Time Auction game</DialogDescription>
          </DialogHeader>
          
          <Form {...createGameForm}>
            <form onSubmit={createGameForm.handleSubmit(onCreateGame)} className="space-y-4">
              <FormField
                control={createGameForm.control}
                name="totalRounds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Rounds</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} min={1} max={30} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={createGameForm.control}
                name="startingTimeBank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting Time Bank (seconds)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} min={60} max={1200} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={createGameForm.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4"
                      />
                    </FormControl>
                    <FormLabel className="mt-0">Public Game (visible in lobbies)</FormLabel>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={createGameMutation.isPending}>
                  {createGameMutation.isPending ? "Creating..." : "Create Game"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Join Game Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Game</DialogTitle>
            <DialogDescription>Enter the 6-character game code</DialogDescription>
          </DialogHeader>
          
          <Form {...joinGameForm}>
            <form onSubmit={joinGameForm.handleSubmit(onJoinGame)} className="space-y-4">
              <FormField
                control={joinGameForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Game Code</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        maxLength={6}
                        placeholder="ABCD12"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={joinGameMutation.isPending}>
                  {joinGameMutation.isPending ? "Joining..." : "Join Game"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default Home;
