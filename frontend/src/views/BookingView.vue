<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import SharedCalendar from '@/components/SharedCalendar.vue';
import TimeSlotGrid from '@/components/TimeSlotGrid.vue';
import { bookingsApi } from '@/api/bookings';
import { useBookingStore } from '@/stores/booking';
import { useAuthStore } from '@/stores/auth';
import type { AvailableSlot } from '@/api/types';

const booking = useBookingStore();
const auth = useAuthStore();
const router = useRouter();

const selectedDate = ref<string | null>(booking.date);
const selectedTime = ref<string | null>(booking.time);
const slots = ref<AvailableSlot[]>([]);
const loadingSlots = ref(false);
const submitting = ref(false);
const error = ref('');
const submitted = ref(false);

const today = new Date().toISOString().slice(0, 10);

watch(selectedDate, async (d) => {
  selectedTime.value = null;
  if (!d) return;
  loadingSlots.value = true;
  try {
    slots.value = await bookingsApi.availableSlots(d, booking.totalDuration || undefined);
  } catch (err) { console.error(err); }
  finally { loadingSlots.value = false; }
});

const canSubmit = computed(() => !!selectedDate.value && !!selectedTime.value && booking.count > 0);

async function submit() {
  if (!canSubmit.value || !auth.customer) return;
  error.value = '';
  submitting.value = true;
  try {
    await bookingsApi.create({
      name: auth.customer.name,
      phone: auth.customer.phone,
      bday: auth.customer.bday ?? null,
      lineUserId: auth.profile?.userId ?? null,
      date: selectedDate.value!,
      time: selectedTime.value!,
      items: booking.itemsLabel,
      total: booking.total,
      remarks: booking.remarks || null,
    });
    submitted.value = true;
  } catch (err) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
    error.value = msg ?? '送出失敗，請稍後再試';
  } finally { submitting.value = false; }
}

function goHome() {
  booking.reset();
  router.push('/services');
}

function goHistory() {
  booking.reset();
  router.push('/history');
}
</script>

<template>
  <section class="min-h-screen bg-white p-6 pb-32">
    <!-- 預約成功確認頁 -->
    <div v-if="submitted" class="max-w-[300px] mx-auto text-center pt-10">
      <div class="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#655b55" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <h2 class="text-lg font-extrabold text-brand-700 mb-2">預約成功！</h2>
      <p class="text-xs text-brand-400 mb-6">我們已收到您的預約，將盡快為您確認</p>

      <!-- 確認單 -->
      <div class="text-left p-5 mb-4" style="background: #f8f7f5; border-radius: 16px;">
        <p class="text-[10px] font-bold text-brand-400 tracking-wider uppercase mb-3">Booking Confirmation</p>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-brand-400">姓名</span>
            <span class="font-bold text-brand-700">{{ auth.customer?.name }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-brand-400">電話</span>
            <span class="font-bold text-brand-700">{{ auth.customer?.phone }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-brand-400">日期</span>
            <span class="font-bold text-brand-700">{{ selectedDate }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-brand-400">時段</span>
            <span class="font-bold text-brand-700">{{ selectedTime }}</span>
          </div>
          <div class="flex justify-between items-start">
            <span class="text-brand-400 shrink-0">項目</span>
            <span class="font-bold text-brand-700 text-right ml-3">{{ booking.itemsLabel }}</span>
          </div>
          <div v-if="booking.totalDuration" class="flex justify-between">
            <span class="text-brand-400">預估時長</span>
            <span class="font-bold text-brand-700">約 {{ booking.totalDuration }} 分鐘</span>
          </div>
          <div v-if="booking.discount > 0" class="flex justify-between text-amber-600">
            <span>新客折價</span>
            <span class="font-bold">-NT$ {{ booking.discount }}</span>
          </div>
          <div class="border-t border-brand-100 pt-2 mt-2 flex justify-between">
            <span class="font-bold text-brand-600">合計</span>
            <span class="font-extrabold text-brand-700 text-base">NT$ {{ booking.total }}</span>
          </div>
        </div>
      </div>

      <p v-if="booking.hasCombo" class="text-[10px] text-amber-600 font-bold mb-2 text-center">
        ※ 套餐活動皆不適用任何優惠活動
      </p>
      <p class="text-[11px] text-brand-400 mb-6 leading-relaxed">
        如需異動預約，請透過 LINE 私訊小編人工處理
      </p>

      <div class="flex gap-3">
        <button type="button" class="btn-outline flex-1 text-xs" @click="goHistory">查看紀錄</button>
        <button type="button" class="flex-1 text-white font-semibold text-xs"
          style="background: #655b55; border-radius: 14px; padding: 12px; border: none; cursor: pointer;"
          @click="goHome">返回首頁</button>
      </div>
    </div>

    <!-- 預約表單 -->
    <div v-else class="max-w-[280px] mx-auto text-center">
      <h2 class="text-base font-bold mb-6 text-brand-700">確認預約資訊</h2>

      <!-- Booking summary card -->
      <div class="text-left space-y-1.5 mb-6 p-5" style="background: #f8f7f5; border-radius: 16px;">
        <div class="text-xs text-brand-500">
          已選 <span class="font-bold">{{ booking.count }}</span> 項 ·
          預估 <span class="font-bold">{{ booking.totalDuration }}</span> 分鐘
        </div>
        <div class="text-[11px] text-brand-400">{{ booking.itemsLabel }}</div>
        <div class="flex items-baseline gap-2 mt-1">
          <span class="font-extrabold text-brand-600">NT$ {{ booking.total }}</span>
          <span v-if="booking.discount > 0" class="text-[10px] text-amber-600 font-bold">
            (新客折 -${{ booking.discount }})
          </span>
        </div>
        <p v-if="booking.hasCombo" class="text-[9px] text-amber-600 font-bold mt-1.5">
          ※ 套餐活動不適用任何優惠活動
        </p>
      </div>

      <div class="space-y-4 text-left">
        <!-- Date -->
        <div>
          <label class="label">選擇日期</label>
          <SharedCalendar v-model="selectedDate" :min-date="today" />
        </div>

        <!-- Time slots -->
        <div>
          <label class="label">選擇時段</label>
          <p v-if="loadingSlots" class="text-[11px] text-brand-400 text-center py-3">載入中…</p>
          <TimeSlotGrid v-else :slots="slots" :selected="selectedTime" @select="(t) => (selectedTime = t)" />
        </div>

        <!-- Remarks -->
        <div>
          <label class="label">備註說明</label>
          <textarea v-model="booking.remarks" class="input resize-none h-20 py-3 text-xs" placeholder="過敏成分、肌膚狀況、特別需求…" />
        </div>

        <p v-if="error" class="text-xs text-red-500 font-bold text-center">{{ error }}</p>

        <button
          type="button"
          class="w-full text-white font-semibold text-sm"
          style="background: #655b55; border-radius: 14px; padding: 12px; border: none; cursor: pointer;"
          :disabled="!canSubmit || submitting"
          :style="{ opacity: !canSubmit || submitting ? '0.5' : '1' }"
          @click="submit"
        >
          {{ submitting ? '送出中…' : '確定預約' }}
        </button>

        <button
          type="button"
          class="text-xs text-brand-400 font-bold underline block w-full text-center pt-2"
          @click="router.push('/services')"
        >
          返回修改項目
        </button>
      </div>
    </div>
  </section>
</template>
