<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { bookingsApi } from '@/api/bookings';
import { useAuthStore } from '@/stores/auth';
import type { Booking, BookingStatus } from '@/api/types';

const auth = useAuthStore();
const router = useRouter();
const bookings = ref<Booking[]>([]);
const loading = ref(true);

const badgeClass: Record<BookingStatus, string> = {
  待確認: 'badge-pending',
  已確認: 'badge-confirmed',
  已完成: 'badge-done',
  已取消: 'badge-cancelled',
};

async function load() {
  if (!auth.customer?.phone) { router.replace('/login'); return; }
  loading.value = true;
  bookings.value = await bookingsApi.listByPhone(auth.customer.phone);
  loading.value = false;
}

onMounted(load);
</script>

<template>
  <section class="min-h-screen pb-32">
    <!-- Header -->
    <header class="bg-white px-5 py-4 sticky top-0 z-50 flex justify-between items-center" style="border-bottom: 1px solid #f5f4f2;">
      <div>
        <h1 class="text-base font-bold tracking-tight text-brand-700">SHANSHAN.STUDIO</h1>
        <p class="text-[8px] tracking-[0.2em] text-brand-300 uppercase font-bold">MEMBER CENTER</p>
      </div>
      <button
        type="button"
        class="text-[10px] font-bold text-brand-400 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-full transition"
        @click="auth.clearCustomer(); router.push('/login')"
      >
        登出
      </button>
    </header>

    <main class="px-4 pt-6 space-y-4">
      <!-- Member card (dark style) -->
      <div style="border-radius: 28px; overflow: hidden; box-shadow: 0 8px 32px rgba(59,53,48,0.28);">
        <div style="background: #3b3530; padding: 24px 24px 26px; position: relative; overflow: hidden;">
          <div style="position:absolute;top:-50px;right:-50px;width:190px;height:190px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.13);pointer-events:none;"></div>
          <p style="font-size:9px;font-weight:800;letter-spacing:0.28em;color:rgba(255,255,255,0.28);margin:0 0 20px;text-transform:uppercase;">SHANSHAN.STUDIO</p>
          <div class="flex items-center gap-3.5 mb-5">
            <div class="w-[52px] h-[52px] shrink-0 rounded-full flex items-center justify-center" style="background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.18);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.8"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <p style="font-size:9px;font-weight:700;letter-spacing:0.16em;color:rgba(255,255,255,0.28);margin:0 0 4px;text-transform:uppercase;">Member</p>
              <h2 style="font-size:22px;font-weight:900;color:white;margin:0;line-height:1.1;">{{ auth.customer?.name ?? '--' }}</h2>
            </div>
          </div>
          <div class="flex gap-7">
            <div>
              <p style="font-size:8px;font-weight:700;letter-spacing:0.18em;color:rgba(255,255,255,0.28);margin:0 0 3px;text-transform:uppercase;">Phone</p>
              <p style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.78);margin:0;">{{ auth.customer?.phone ?? '--' }}</p>
            </div>
            <div v-if="auth.customer?.bday">
              <p style="font-size:8px;font-weight:700;letter-spacing:0.18em;color:rgba(255,255,255,0.28);margin:0 0 3px;text-transform:uppercase;">Birthday</p>
              <p style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.78);margin:0;">{{ auth.customer.bday }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Booking history -->
      <div class="pt-4">
        <div class="section-label mb-3 ml-2">BOOKING HISTORY / 預約紀錄</div>
        <p v-if="loading" class="text-center text-brand-400 py-6 text-xs">載入中…</p>
        <p v-else-if="!bookings.length" class="text-center text-brand-400 py-6 text-xs">尚無預約紀錄</p>
        <ul v-else class="space-y-3">
          <li v-for="b in bookings" :key="b.id" class="card">
            <div class="flex justify-between items-start">
              <div>
                <div class="text-xs text-brand-400">{{ b.date }} {{ b.time }}</div>
                <div class="font-bold text-sm mt-1 text-brand-700">{{ b.items }}</div>
                <div class="text-brand-600 font-extrabold mt-1">NT$ {{ b.total }}</div>
              </div>
              <span class="badge" :class="badgeClass[b.status]">{{ b.status }}</span>
            </div>
            <div v-if="b.remarks" class="text-[10px] text-brand-400 mt-2">備註：{{ b.remarks }}</div>
          </li>
        </ul>
        <p class="text-[11px] text-brand-400 text-center mt-4 leading-relaxed">
          如需取消或異動預約，請透過 LINE 私訊小編人工處理
        </p>
      </div>
    </main>
  </section>
</template>
