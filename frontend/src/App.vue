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
  <div class="min-h-full flex flex-col" :class="{ 'pb-20': needsPadding }">
    <RouterView />
    <BottomNav />
  </div>
</template>
