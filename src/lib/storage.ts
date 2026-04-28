import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  deleteDoc, 
  doc, 
  setDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';

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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const HISTORY_COLLECTION = 'history';
const USER_KEY = 'wonderful_user';
const ACCOUNTS_KEY = 'wonderful_accounts';

export const storage = {
  // User Management
  getUser: (): User | null => {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },
  
  saveUser: (user: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    storage.saveAccount(user);
  },
  
  clearUser: () => {
    localStorage.removeItem(USER_KEY);
  },

  // Account Persistence (Google-like selector)
  getAccounts: (): User[] => {
    const data = localStorage.getItem(ACCOUNTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveAccount: (user: User) => {
    const accounts = storage.getAccounts();
    const existingIndex = accounts.findIndex(acc => acc.email === user.email);
    if (existingIndex > -1) {
      accounts[existingIndex] = user;
    } else {
      accounts.unshift(user);
    }
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 5))); // Keep last 5
  },
  
  // History Management (Firestore)
  syncHistory: async (uid: string): Promise<HistoryItem[]> => {
    const q = query(
      collection(db, HISTORY_COLLECTION),
      where("uid", "==", uid),
      orderBy("timestamp", "desc")
    );
    
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as HistoryItem));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, HISTORY_COLLECTION);
      return [];
    }
  },
  
  addHistoryItem: async (item: HistoryItem) => {
    try {
      await setDoc(doc(db, HISTORY_COLLECTION, item.id), item);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${HISTORY_COLLECTION}/${item.id}`);
    }
  },
  
  deleteHistoryItem: async (id: string) => {
    try {
      await deleteDoc(doc(db, HISTORY_COLLECTION, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${HISTORY_COLLECTION}/${id}`);
    }
  }
};
