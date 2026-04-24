<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();

// 隱藏條件：登入頁、註冊頁、管理後台、未登入
const visible = computed(() => {
  const path = route.path;
  if (path === '/login' || path === '/register') return false;
  if (path.startsWith('/admin')) return false;
  if (auth.role !== 'user') return false;
  return true;
});

const items = [
  {
    name: 'services',
    label: '預約',
    svgPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
  },
  {
    name: 'history',
    label: '會員',
    svgPath: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  },
];
</script>

<template>
  <nav
    v-if="visible"
    class="fixed bottom-0 inset-x-0 bg-white z-50 bottom-nav"
    style="border-top: 1px solid #f0f0f0;"
  >
    <div class="flex justify-around items-center max-w-md mx-auto">
      <RouterLink
        v-for="it in items"
        :key="it.name"
        :to="{ name: it.name }"
        class="flex flex-col items-center gap-1 flex-1 transition-colors"
        :class="route.name === it.name ? 'text-brand-600' : 'text-brand-300'"
        style="font-size: 9px; font-weight: 700;"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path :d="it.svgPath"/>
        </svg>
        {{ it.label }}
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.bottom-nav {
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom, 0px));
}
</style>
