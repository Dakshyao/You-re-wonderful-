
/**
 * Simple local storage alternative for Firebase
 */

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface HistoryItem {
  id: string;
  uid: string;
  image: string;
  prompt: string;
  timestamp: number;
  params: any;
}

const HISTORY_KEY = 'wonderful_history';
const USER_KEY = 'wonderful_user';

export const storage = {
  // User Management
  getUser: (): User | null => {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },
  
  saveUser: (user: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  
  clearUser: () => {
    localStorage.removeItem(USER_KEY);
  },
  
  // History Management
  getHistory: (uid: string): HistoryItem[] => {
    const data = localStorage.getItem(HISTORY_KEY);
    if (!data) return [];
    try {
      const allHistory: HistoryItem[] = JSON.parse(data);
      return allHistory.filter(item => item.uid === uid).sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
      return [];
    }
  },
  
  addHistoryItem: (item: HistoryItem) => {
    const data = localStorage.getItem(HISTORY_KEY);
    let allHistory: HistoryItem[] = [];
    if (data) {
      try {
        allHistory = JSON.parse(data);
      } catch (e) {}
    }
    allHistory.push(item);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(allHistory));
  },
  
  deleteHistoryItem: (id: string) => {
    const data = localStorage.getItem(HISTORY_KEY);
    if (!data) return;
    try {
      const allHistory: HistoryItem[] = JSON.parse(data);
      const filtered = allHistory.filter(item => item.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    } catch (e) {}
  }
};
