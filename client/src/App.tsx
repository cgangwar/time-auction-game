import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/Home";
import Game from "@/pages/Game";
import Results from "@/pages/Results";
import Lobby from "@/pages/Lobby";
import Games from "@/pages/Games";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "./contexts/AuthContext";
import { GameProvider } from "./contexts/GameContext";
import LoginForm from "./components/forms/LoginForm";
import RegisterForm from "./components/forms/RegisterForm";

function Router() {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-neutral-lighter">
      <div className="mx-auto max-w-md h-screen bg-white shadow-lg flex flex-col overflow-hidden relative">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={LoginForm} />
          <Route path="/register" component={RegisterForm} />
          <Route path="/game/:id" component={Game} />
          <Route path="/results/:id/:round" component={Results} />
          <Route path="/lobby/:id" component={Lobby} />
          <Route path="/games" component={Games} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/profile" component={Profile} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GameProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </GameProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
