<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import SharedCalendar from '@/components/SharedCalendar.vue';
import liff from '@line/liff';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api/auth';
import { buildNewMemberFlex, sendFlexToChat } from '@/composables/liffMessages';

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
const showBdayPicker = ref(false);
const bdayCalendarValue = ref<string | null>(null);

function formatBday(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
}

function openBdayPicker() {
  bdayCalendarValue.value = form.bday || null;
  showBdayPicker.value = true;
}

function selectBday(d: string) {
  form.bday = d;
  showBdayPicker.value = false;
}

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
      inLiff: liff.isInClient(),
    });

    // 透過 liff.sendMessages 把註冊通知發到 OA 聊天室（顯示在左邊，客人發的）
    sendFlexToChat(buildNewMemberFlex({
      name: form.name.trim(),
      phone: form.phone.trim(),
      gender: form.gender,
      bday: form.bday || null,
    }));

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
            <button type="button" class="bday-btn" @click="openBdayPicker">
              <span :class="form.bday ? 'text-brand-600 font-bold' : 'text-brand-300'">
                {{ form.bday ? formatBday(form.bday) : '選擇生日' }}
              </span>
              <svg class="w-4 h-4 text-brand-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </button>
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
    <!-- Birthday Calendar Modal -->
    <div v-if="showBdayPicker" class="fixed inset-0 z-40 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);" @click.self="showBdayPicker = false">
      <div class="bg-white w-full max-w-[360px]" style="border-radius:28px; overflow:hidden; box-shadow:0 16px 48px rgba(0,0,0,0.2); animation: bday-pop 0.2s ease-out;">
        <div class="flex justify-between items-center" style="padding: 22px 22px 10px;">
          <h3 class="font-bold text-base text-brand-700">選擇生日</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showBdayPicker = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style="padding: 0 16px 22px;">
          <SharedCalendar
            v-model="bdayCalendarValue"
            @update:model-value="selectBday"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bday-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: #f5f3f1;
  border: none;
  border-radius: 14px;
  padding: 12px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
  -webkit-appearance: none;
  appearance: none;
}
.bday-btn:active {
  background: #ebe8e5;
}
@keyframes bday-pop {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
