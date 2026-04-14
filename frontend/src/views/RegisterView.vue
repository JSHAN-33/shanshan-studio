<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api/auth';

const auth = useAuthStore();
const router = useRouter();

// 如果沒有 LINE profile 或不需要註冊，導回登入頁
if (!auth.profile?.userId || !auth.profile?.needsRegister) {
  router.replace('/login');
}

const form = reactive({
  name: auth.profile?.displayName ?? '',
  phone: '',
  gender: '' as '' | '男' | '女',
  bday: '',
});

const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';

  if (!form.name.trim()) { error.value = '請填寫姓名'; return; }
  if (!form.phone.trim() || !/^\d{8,}$/.test(form.phone.trim())) { error.value = '請填寫正確的手機號碼'; return; }
  if (!form.gender) { error.value = '請選擇性別'; return; }

  loading.value = true;
  try {
    const result = await authApi.register({
      lineUserId: auth.profile!.userId!,
      displayName: auth.profile!.displayName,
      pictureUrl: auth.profile!.pictureUrl,
      name: form.name.trim(),
      phone: form.phone.trim(),
      gender: form.gender,
      bday: form.bday || null,
    });

    auth.setProfile({ ...auth.profile!, needsRegister: false });
    auth.setCustomer({
      name: result.member.name,
      phone: result.member.phone,
      bday: result.member.bday ?? null,
    });
    router.push('/services');
  } catch (err: any) {
    if (err?.response?.status === 409) {
      error.value = '此 LINE 帳號已綁定其他會員';
    } else {
      error.value = '註冊失敗，請稍後再試';
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

    <main class="flex-grow flex items-center justify-center p-6">
      <div class="bg-white text-center w-full" style="max-width: 300px; border-radius: 24px; box-shadow: 0 8px 25px -10px rgba(0,0,0,0.05); padding: 28px 22px;">
        <!-- LINE avatar -->
        <div class="flex flex-col items-center mb-5">
          <img
            v-if="auth.profile?.pictureUrl"
            :src="auth.profile.pictureUrl"
            class="w-16 h-16 rounded-full mb-3 object-cover"
            style="border: 3px solid #f0efed;"
          />
          <div v-else class="w-16 h-16 rounded-full mb-3 bg-brand-100 flex items-center justify-center text-brand-400 text-xl font-bold">
            {{ (auth.profile?.displayName ?? '?')[0] }}
          </div>
          <p class="text-xs text-brand-400">{{ auth.profile?.displayName }}</p>
        </div>

        <div class="mb-5">
          <p class="text-brand-300 text-[9px] tracking-[0.4em] mb-1 font-bold uppercase">Complete Profile</p>
          <h2 class="text-base font-extrabold tracking-tight text-brand-700">完善會員資料</h2>
        </div>

        <form class="space-y-3 text-left" @submit.prevent="submit">
          <div>
            <label class="label">真實姓名</label>
            <input v-model="form.name" class="input" placeholder="您的名字" />
          </div>

          <div>
            <label class="label">手機號碼</label>
            <input v-model="form.phone" class="input" placeholder="09xxxxxxxx" inputmode="tel" maxlength="10" />
          </div>

          <div>
            <label class="label">性別</label>
            <div class="flex gap-2">
              <button
                v-for="g in ['女', '男']"
                :key="g"
                type="button"
                class="flex-1 text-sm font-bold py-2.5 transition-all"
                :class="form.gender === g
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-50 text-brand-400 hover:bg-brand-100'"
                style="border-radius: 12px; border: none; cursor: pointer;"
                @click="form.gender = g as '男' | '女'"
              >
                {{ g }}
              </button>
            </div>
          </div>

          <div>
            <label class="label">生日（選填）</label>
            <input v-model="form.bday" type="date" class="input"
              :style="{ color: form.bday ? '#655b55' : '#b0aba7' }" />
          </div>

          <p v-if="error" class="text-xs text-red-500 font-bold text-center">{{ error }}</p>

          <button
            type="submit"
            class="w-full font-semibold text-sm text-white"
            style="background: #655b55; border-radius: 14px; padding: 12px; border: none; cursor: pointer;"
            :disabled="loading"
          >
            {{ loading ? '註冊中...' : '完成註冊，開始預約' }}
          </button>
        </form>
      </div>
    </main>
  </section>
</template>
