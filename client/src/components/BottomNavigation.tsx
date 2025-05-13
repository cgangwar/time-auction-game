import { useLocation } from 'wouter';

interface BottomNavigationProps {
  active: 'home' | 'games' | 'leaderboard' | 'profile';
}

function BottomNavigation({ active }: BottomNavigationProps) {
  const [location, navigate] = useLocation();

  const tabs = [
    { id: 'home', icon: 'home', label: 'Home', path: '/' },
    { id: 'games', icon: 'sports_esports', label: 'Games', path: '/games' },
    { id: 'leaderboard', icon: 'leaderboard', label: 'Ranks', path: '/leaderboard' },
    { id: 'profile', icon: 'person', label: 'Profile', path: '/profile' },
  ];

  const handleTabClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="bg-white border-t border-neutral-light flex justify-around items-center py-2 z-10 fixed bottom-0 w-full max-w-md">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`flex flex-col items-center p-2 ${active === tab.id ? 'text-primary' : 'text-neutral'}`}
          onClick={() => handleTabClick(tab.path)}
        >
          <span className="material-icons">{tab.icon}</span>
          <span className="text-xs mt-1 font-medium">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

export default BottomNavigation;
