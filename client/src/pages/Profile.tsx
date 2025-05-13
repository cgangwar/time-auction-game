import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function Profile() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) {
    return null; // Will redirect to login
  }

  // Generate user initials for avatar
  const initials = user.displayName
    ? user.displayName.split(' ').map(part => part[0]).join('').toUpperCase()
    : 'U';

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigate("/login");
  };

  return (
    <>
      <AppHeader />
      
      <div className="flex-1 overflow-y-auto pb-16">
        {/* Header */}
        <div className="bg-gradient-to-r from-secondary to-primary p-5 text-white">
          <h2 className="font-display text-xl font-bold mb-1">Your Profile</h2>
          <p className="text-white/80 text-sm">Account settings and preferences</p>
        </div>
        
        {/* Profile Summary */}
        <div className="p-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <Avatar className="h-16 w-16 border-2 border-primary">
                  <AvatarFallback className="bg-primary text-white text-lg font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-4">
                  <h3 className="font-display text-lg font-bold text-neutral-dark">{user.displayName}</h3>
                  <p className="text-neutral text-sm">@{user.username}</p>
                  <p className="text-neutral text-sm mt-1">{user.email}</p>
                </div>
              </div>
              
              <div className="mt-4 flex">
                <Button variant="outline" className="flex-1 mr-2">
                  <span className="material-icons text-sm mr-1">edit</span>
                  Edit Profile
                </Button>
                <Button variant="outline" className="flex-1 ml-2" onClick={() => setShowLogoutConfirm(true)}>
                  <span className="material-icons text-sm mr-1">logout</span>
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Game Statistics */}
        <div className="px-4 pb-4">
          <h3 className="font-display font-bold text-neutral-dark text-lg mb-3">Game Statistics</h3>
          
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm text-neutral mb-1">Games Played</p>
                  <p className="font-display text-2xl font-bold text-primary">0</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-neutral mb-1">Win Rate</p>
                  <p className="font-display text-2xl font-bold text-primary">0%</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-neutral mb-1">Tokens Won</p>
                  <p className="font-display text-2xl font-bold text-secondary">0</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-neutral mb-1">Avg. Hold Time</p>
                  <p className="font-display text-2xl font-bold text-secondary">0s</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Settings */}
        <div className="px-4 pb-20">
          <h3 className="font-display font-bold text-neutral-dark text-lg mb-3">Settings</h3>
          
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications" className="font-medium text-neutral-dark">Notifications</Label>
                  <p className="text-xs text-neutral mt-0.5">Receive game updates and reminders</p>
                </div>
                <Switch id="notifications" defaultChecked />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sounds" className="font-medium text-neutral-dark">Game Sounds</Label>
                  <p className="text-xs text-neutral mt-0.5">Play sounds during gameplay</p>
                </div>
                <Switch id="sounds" defaultChecked />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="haptic" className="font-medium text-neutral-dark">Haptic Feedback</Label>
                  <p className="text-xs text-neutral mt-0.5">Vibrate on gameplay actions</p>
                </div>
                <Switch id="haptic" defaultChecked />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="privacy" className="font-medium text-neutral-dark">Privacy Mode</Label>
                  <p className="text-xs text-neutral mt-0.5">Hide your profile from other players</p>
                </div>
                <Switch id="privacy" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <BottomNavigation active="profile" />

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out of your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default Profile;