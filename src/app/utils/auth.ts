export interface User {
  id: string;
  email: string;
  username: string;
  score: number;
}

function decodeJwtPayload(token: string): any | null {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export const authService = {
  login: (email: string, password: string): User | null => {
    if (email && password) {
      const user: User = {
        id: crypto.randomUUID(),
        email,
        username: email.split('@')[0],
        score: 1250,
      };

      localStorage.setItem('user', JSON.stringify(user));
      return user;
    }

    return null;
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  },

  getUserIdFromToken: (): string | null => {
    const token = localStorage.getItem('token');

    if (!token) return null;

    const payload = decodeJwtPayload(token);

    return payload?.userId ?? null;
  },

  getCurrentUser: (): User | null => {
    const tokenUserId = authService.getUserIdFromToken();

    const userStr = localStorage.getItem('user');

    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);

        return {
          ...parsed,
          id: tokenUserId || parsed.id,
        };
      } catch {
        return null;
      }
    }

    if (tokenUserId) {
      return {
        id: tokenUserId,
        email: '',
        username: 'user',
        score: 0,
      };
    }

    return null;
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },
};