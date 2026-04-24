<script setup lang="ts">
import { RouterView, useRouter, useRoute } from 'vue-router';
import { computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useLiff } from '@/composables/useLiff';
import BottomNav from '@/components/BottomNav.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { ready, initLiff } = useLiff();

// 是否在 LIFF 環境中（有設定 LIFF ID 且非 admin）
const isLiffEnv = computed(() => !!import.meta.env.VITE_LIFF_ID);

// 顯示 splash：LIFF 環境中尚未 ready 且不是 admin 路由
const showSplash = computed(() => {
  if (route.path.startsWith('/admin')) return false;
  if (auth.adminToken) return false;
  return isLiffEnv.value && !ready.value;
});

// 只有 user 角色且不在登入/註冊頁才需要底部 padding
const needsPadding = computed(() => {
  const path = route.path;
  if (path === '/login' || path === '/register') return false;
  if (path.startsWith('/admin')) return false;
  if (auth.role !== 'user') return false;
  return true;
});

onMounted(async () => {
  auth.loadFromStorage();
  await initLiff();
});

// LIFF 初始化完成後，根據狀態自動導向
watch(ready, (isReady) => {
  if (!isReady) return;
  const profile = auth.profile;
  if (!profile || profile.isStub) return;

  if (profile.needsRegister) {
    router.replace('/register');
  } else if (auth.customer?.phone) {
    router.replace('/services');
  }
});
</script>

<template>
  <!-- LIFF 初始化中的品牌 splash screen -->
  <div v-if="showSplash" class="splash-screen">
    <div class="splash-content">
      <h1 class="splash-title">SHANSHAN.STUDIO</h1>
      <p class="splash-sub">PREMIUM HOTWAXING</p>
    </div>
  </div>

  <div v-else class="min-h-full flex flex-col" :class="{ 'pb-20': needsPadding }">
    <RouterView />
    <BottomNav />
  </div>
</template>

<style scoped>
.splash-screen {
  position: fixed;
  inset: 0;
  background: #faf8f6;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.splash-content {
  text-align: center;
  animation: splash-fade 0.6s ease-out;
}
.splash-title {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0.04em;
  color: #4a423d;
  margin: 0 0 6px;
}
.splash-sub {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: #b0aba7;
  text-transform: uppercase;
  margin: 0;
}
@keyframes splash-fade {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
