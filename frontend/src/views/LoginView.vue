<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api/auth';
import { useLiff } from '@/composables/useLiff';

const auth = useAuthStore();
const router = useRouter();
const { loginWithLine, liffInited } = useLiff();

const form = reactive({
  account: '',
  password: '',
});

const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  if (!form.account.trim() || !form.password.trim()) {
    error.value = '請輸入帳號與密碼';
    return;
  }

  loading.value = true;
  try {
    const result = await authApi.credentialLogin(form.account.trim(), form.password);
    if (result.role === 'admin') {
      auth.setAdminToken(result.token);
      router.push('/admin/bookings');
    }
  } catch (err: any) {
    if (err?.response?.status === 401) {
      error.value = '帳號或密碼錯誤';
    } else {
      error.value = '登入失敗，請稍後再試';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="min-h-screen flex flex-col">
    <!-- Header -->
    <header class="bg-white px-5 py-4 flex justify-between items-center">
      <div>
        <h1 class="text-base font-bold tracking-tight text-brand-700">SHANSHAN.STUDIO</h1>
        <p class="text-[8px] tracking-[0.2em] text-brand-300 uppercase font-bold">HOTWAXING</p>
      </div>
    </header>

    <!-- Login card -->
    <main class="flex-grow flex items-center justify-center p-6">
      <div class="bg-white text-center w-full" style="max-width: 260px; border-radius: 24px; box-shadow: 0 8px 25px -10px rgba(0,0,0,0.05); padding: 28px 22px;">
        <div class="mb-7">
          <p class="text-brand-300 text-[9px] tracking-[0.4em] mb-1 font-bold uppercase">Welcome</p>
          <h2 class="text-lg font-extrabold tracking-tight text-brand-700">SHANSHAN.STUDIO</h2>
        </div>

        <!-- Stub hint -->
        <div v-if="auth.profile?.isStub"
          class="text-[10px] text-brand-400 bg-brand-50 border border-brand-100 rounded-xl p-3 mb-4 text-left">
          尚未設定 LINE LIFF ID，目前為手動填單模式。
        </div>

        <!-- LINE login button -->
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 text-white font-bold text-sm"
          style="background: #06C755; border-radius: 14px; padding: 13px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(6,199,85,0.3);"
          :disabled="!liffInited"
          @click="loginWithLine"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
          以 LINE 帳號登入
        </button>

        <!-- Divider -->
        <div class="flex items-center gap-2 my-3.5" style="color: #ccc; font-size: 11px; font-weight: 600;">
          <div class="flex-1 h-px bg-brand-100" />
          或帳號登入
          <div class="flex-1 h-px bg-brand-100" />
        </div>

        <!-- Account/Password form -->
        <form class="space-y-3" @submit.prevent="submit">
          <input v-model="form.account" class="input" placeholder="帳號" autocomplete="username" />
          <input v-model="form.password" type="password" class="input" placeholder="密碼" autocomplete="current-password" />
          <p v-if="error" class="text-xs text-red-500 font-bold">{{ error }}</p>
          <button
            type="submit"
            class="w-full font-semibold text-sm text-white"
            style="background: #655b55; border-radius: 14px; padding: 12px; border: none; cursor: pointer;"
            :disabled="loading"
          >
            {{ loading ? '登入中...' : '登入' }}
          </button>
        </form>
      </div>
    </main>
  </section>
</template>
