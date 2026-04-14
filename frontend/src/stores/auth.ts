import { defineStore } from 'pinia';

export interface LiffProfile {
  userId: string | null;
  displayName: string | null;
  pictureUrl?: string | null;
  isStub: boolean;
  needsRegister?: boolean;
}

export type Role = 'admin' | 'user' | null;

interface AuthState {
  profile: LiffProfile | null;
  customer: {
    name: string;
    phone: string;
    bday?: string | null;
  } | null;
  adminToken: string | null;
  role: Role;
}

const STORAGE_KEY_CUSTOMER = 'shanshan.customer';
const STORAGE_KEY_ADMIN = 'shanshan.adminToken';
const STORAGE_KEY_ROLE = 'shanshan.role';

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    profile: null,
    customer: null,
    adminToken: null,
    role: null,
  }),
  getters: {
    isAdmin: (s) => s.role === 'admin',
    isUser: (s) => s.role === 'user',
    hasCustomer: (s) => !!s.customer?.phone,
  },
  actions: {
    loadFromStorage() {
      try {
        const c = localStorage.getItem(STORAGE_KEY_CUSTOMER);
        if (c) this.customer = JSON.parse(c);
      } catch {
        /* ignore */
      }
      try {
        const a = sessionStorage.getItem(STORAGE_KEY_ADMIN);
        if (a) this.adminToken = a;
      } catch {
        /* ignore */
      }
      try {
        const r = sessionStorage.getItem(STORAGE_KEY_ROLE);
        if (r) this.role = r as Role;
      } catch {
        /* ignore */
      }
    },
    setProfile(profile: LiffProfile) {
      this.profile = profile;
      if (profile.displayName && !this.customer?.name) {
        this.customer = { ...(this.customer ?? { phone: '' }), name: profile.displayName };
      }
    },
    setCustomer(customer: { name: string; phone: string; bday?: string | null }) {
      this.customer = customer;
      this.role = 'user';
      localStorage.setItem(STORAGE_KEY_CUSTOMER, JSON.stringify(customer));
      sessionStorage.setItem(STORAGE_KEY_ROLE, 'user');
    },
    clearCustomer() {
      this.customer = null;
      this.role = null;
      localStorage.removeItem(STORAGE_KEY_CUSTOMER);
      sessionStorage.removeItem(STORAGE_KEY_ROLE);
    },
    setAdminToken(token: string) {
      this.adminToken = token;
      this.role = 'admin';
      sessionStorage.setItem(STORAGE_KEY_ADMIN, token);
      sessionStorage.setItem(STORAGE_KEY_ROLE, 'admin');
    },
    clearAdmin() {
      this.adminToken = null;
      this.role = null;
      sessionStorage.removeItem(STORAGE_KEY_ADMIN);
      sessionStorage.removeItem(STORAGE_KEY_ROLE);
    },
    logout() {
      this.clearCustomer();
      this.clearAdmin();
      this.profile = null;
    },
  },
});
