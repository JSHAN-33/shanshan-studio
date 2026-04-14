import { defineStore } from 'pinia';

export type AdminTab = 'booking' | 'member' | 'checkout' | 'finance' | 'inventory';

export const useAdminStore = defineStore('admin', {
  state: () => ({
    tab: 'booking' as AdminTab,
  }),
  actions: {
    setTab(tab: AdminTab) {
      this.tab = tab;
    },
  },
});
