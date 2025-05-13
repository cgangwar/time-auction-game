import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

function AppHeader() {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleProfileClick = () => {
    // For future implementation
    // navigate('/profile');
  };

  // Generate user initials for avatar
  const initials = user?.displayName
    ? user.displayName.split(' ').map(part => part[0]).join('').toUpperCase()
    : 'U';

  return (
    <header className="bg-white border-b border-neutral-light px-4 py-3 flex justify-between items-center z-10">
      <div className="flex items-center cursor-pointer" onClick={handleLogoClick}>
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <span className="material-icons text-white text-sm">timer</span>
        </div>
        <h1 className="ml-2 font-display font-bold text-lg text-neutral-dark">Time Auction</h1>
      </div>
      
      {user && (
        <div className="flex items-center space-x-2">
          <button className="rounded-full p-2 text-neutral hover:bg-neutral-light transition">
            <span className="material-icons">notifications_none</span>
          </button>
          <div 
            className="h-8 w-8 rounded-full bg-secondary text-white flex items-center justify-center font-medium text-sm cursor-pointer"
            onClick={handleProfileClick}
          >
            {initials}
          </div>
        </div>
      )}
    </header>
  );
}

export default AppHeader;
