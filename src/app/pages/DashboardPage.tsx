import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Trophy, Zap, Target, TrendingUp } from 'lucide-react';
import { authService } from '../utils/auth';

function normalizeLeaderboardUserId(id: string | undefined): string {
  if (!id) return '';
  return String(id).trim();
}
import { apiClient } from '../services/api';
import type { LeaderboardEntry } from '../services/contracts';
import { getProgress } from '../utils/progress';

const levels = [
  {
    id: 1,
    title: 'Level 1 – Prompt Input',
    description: 'Learn the basics by crafting effective prompts from scratch',
    icon: Zap,
    color: 'from-blue-500 to-cyan-500',
    path: '/level-1',
  },
  {
    id: 2,
    title: 'Level 2 – Prompt Optimization',
    description: 'Refine and improve existing prompts for better results',
    icon: Target,
    color: 'from-violet-500 to-purple-600',
    path: '/level-2',
  },
  {
    id: 3,
    title: 'Level 3 – Evaluation & Analytics',
    description: 'Analyze your performance and track improvement over time',
    icon: TrendingUp,
    color: 'from-orange-500 to-red-500',
    path: '/level-3',
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  const currentUserId = normalizeLeaderboardUserId(
    authService.getUserIdFromToken() ?? currentUser?.id
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardError, setLeaderboardError] = useState('');
  const [progress, setProgress] = useState(getProgress());

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setLeaderboardError('');
        const data = await apiClient.fetchLeaderboard();
        setLeaderboard(data);
      } catch (loadError) {
        setLeaderboard([]);
        setLeaderboardError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load leaderboard.'
        );
      }
    };
    void loadLeaderboard();
    setProgress(getProgress());

    const onFocus = () => {
      void loadLeaderboard();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const levelStatusText = (levelId: number) => {
    if (levelId === 1) return progress.level1Completed ? 'Completed' : 'Available';
    if (levelId === 2) return progress.level2Completed ? 'Completed' : 'Available';
    return progress.level3Completed ? 'Completed' : 'Available';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            Welcome back, {currentUser?.username}!
          </h1>
          <p className="text-muted-foreground text-lg">
            Continue your journey to mastering prompt engineering
          </p>
        </div>

        {/* Choose Level Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">Choose Your Level</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {levels.map((level) => {
              const Icon = level.icon;
              return (
                <button
                  key={level.id}
                  onClick={() => navigate(level.path)}
                  className="group relative bg-card border border-border rounded-2xl p-8 text-card-foreground hover:shadow-xl hover:shadow-violet-500/10 transition-all hover:-translate-y-1 text-left"
                >
                  <div className="absolute top-4 right-4 text-xs px-2 py-1 rounded bg-accent/70 text-foreground">
                    {levelStatusText(level.id)}
                  </div>
                  <div
                    className={`inline-flex items-center justify-center size-14 bg-gradient-to-br ${level.color} rounded-xl mb-5 shadow-lg group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="size-7 text-white" />
                  </div>

                  <h3 className="text-xl font-semibold mb-2">{level.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {level.description}
                  </p>

                  <div className="mt-6 flex items-center text-violet-500 font-medium text-sm">
                    Start Level
                    <svg
                      className="ml-2 size-4 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        {/* Analytics Button Section */}
<div className="mb-12 flex justify-center">
  <button
    onClick={() => navigate("/analytics")}
    className="px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-lg transition-all duration-200 shadow-lg"
  >
    View Analytics Dashboard →
  </button>
</div>

        {/* Leaderboard Section */}
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
              <Trophy className="size-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Leaderboard</h2>
              <p className="text-muted-foreground text-sm">
                Top prompt engineers this month
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Rank
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    Username
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((user, index) => {
                  const isTop3 = user.rank <= 3;
                  const isCurrentUser =
                    !!currentUserId &&
                    !!user.userId &&
                    currentUserId === normalizeLeaderboardUserId(user.userId);

                  return (
                    <tr
                      key={user.userId || `${user.rank}-${user.username}`}
                      className={`border-b border-border/50 transition-colors ${
                        isCurrentUser
                          ? 'bg-violet-500/10'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {isTop3 ? (
                            <div
                              className={`size-7 rounded-full flex items-center justify-center font-semibold text-sm ${
                                user.rank === 1
                                  ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white'
                                  : user.rank === 2
                                  ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white'
                                  : 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
                              }`}
                            >
                              {user.rank}
                            </div>
                          ) : (
                            <span className="text-muted-foreground w-7 text-center">
                              {user.rank}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-9 rounded-full flex items-center justify-center font-medium text-sm ${
                              isCurrentUser
                                ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                                : 'bg-accent text-foreground'
                            }`}
                          >
                            {(user.username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground">
  {user.username || 'Unknown User'}
</span>
                          {isCurrentUser && (
                            <span className="text-xs bg-violet-500/20 text-violet-500 px-2 py-1 rounded">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-foreground">
                        {(user.score || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {!leaderboard.length && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted-foreground">
                      {leaderboardError || 'No leaderboard data available yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
