import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { apiPath } from '../utils/apiBase';

export function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
  const response = await fetch(apiPath('/auth/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  // ✅ after register → go to login page
  navigate('/');

} catch (err: any) {
  setError(err.message);
}
    

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-violet-950/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-violet-500/20">
            <span className="text-white text-2xl font-bold">PA</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground bg-gradient-to-r from-violet-500 to-purple-600 supports-[(-webkit-background-clip:text)]:bg-clip-text supports-[(-webkit-background-clip:text)]:text-transparent">
            PromptArena AI
          </h1>
          <p className="text-muted-foreground mt-2">
            Create your account
          </p>
        </div>

        {/* Register Card */}
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold mb-6">Sign Up</h2>

          <form onSubmit={handleRegister} className="space-y-5">

            {/* Username */}
            <div>
              <label className="block text-sm mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-accent border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-accent border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-accent border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-destructive text-sm bg-destructive/10 px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white py-3 rounded-lg font-medium hover:shadow-lg hover:shadow-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                'Creating account...'
              ) : (
                <>
                  Create Account
                  <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Login */}
          <p className="text-sm text-center mt-6">
            Already have an account?{' '}
            <span
              className="text-violet-500 cursor-pointer"
              onClick={() => navigate('/login')}
            >
              Login
            </span>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          © 2026 PromptArena AI. All rights reserved.
        </p>
      </div>
    </div>
  );
}