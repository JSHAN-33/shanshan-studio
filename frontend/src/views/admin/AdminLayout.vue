<script setup lang="ts">
import { RouterView, useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const tabs = [
  { name: 'admin-bookings', label: '預約管理' },
  { name: 'admin-members', label: '會員管理' },
  { name: 'admin-checkout', label: '結帳記錄' },
  { name: 'admin-finance', label: '財務統計' },
  { name: 'admin-inventory', label: '庫存管理' },
];

function logout() {
  auth.clearAdmin();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen bg-brand-50" style="padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));">
    <!-- Header -->
    <div class="flex justify-between items-center px-4 pt-4 mb-4">
      <h1 class="text-base font-bold text-brand-800">後台管理</h1>
      <button
        class="text-[10px] bg-white px-3.5 py-1.5 rounded-full text-brand-400 font-bold shadow-sm active:scale-95 transition"
        @click="logout"
      >
        登出
      </button>
    </div>

    <!-- Admin pill tabs -->
    <div class="flex mx-4 mb-5 p-1 overflow-x-auto no-scrollbar" style="background: #eeebe8; border-radius: 18px;">
      <RouterLink
        v-for="t in tabs"
        :key="t.name"
        :to="{ name: t.name }"
        class="flex-1 text-center py-2 text-[11px] font-bold cursor-pointer whitespace-nowrap transition-all"
        :class="route.name === t.name
          ? 'bg-brand-600 text-white shadow-md'
          : 'text-brand-300'"
        :style="{ borderRadius: '14px', margin: '2px', minWidth: '70px' }"
      >
        {{ t.label }}
      </RouterLink>
    </div>

    <main class="px-4">
      <RouterView />
    </main>
  </div>
</template>
