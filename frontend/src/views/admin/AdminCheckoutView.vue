<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { bookingsApi } from '@/api/bookings';
import { financeApi } from '@/api/finance';
import type { Booking, FinanceSummary, PayMethod } from '@/api/types';

const loading = ref(false);
const summary = ref<FinanceSummary | null>(null);
const bookings = ref<Booking[]>([]);

const showModal = ref(false);
const target = ref<Booking | null>(null);
const payMethod = ref<PayMethod>('現金');

const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);

const pending = computed(() =>
  bookings.value.filter((b) => b.status === '已完成' && !b.paidAt && b.date === today)
);
const paid = computed(() =>
  bookings.value.filter((b) => b.paidAt).sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
);

async function load() {
  loading.value = true;
  try {
    const [list, sum] = await Promise.all([
      bookingsApi.listAll({ month }),
      financeApi.summary(),
    ]);
    bookings.value = list;
    summary.value = sum;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function openCheckout(b: Booking) {
  target.value = b;
  payMethod.value = '現金';
  showModal.value = true;
}

async function confirmCheckout() {
  if (!target.value) return;
  await bookingsApi.update(target.value.id, {
    payMethod: payMethod.value,
    paidAt: new Date().toISOString(),
    status: '已完成',
  });
  showModal.value = false;
  await load();
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-3">
      <div class="card">
        <p class="section-label mb-1.5">本月結帳</p>
        <p class="text-[28px] font-extrabold text-brand-600 leading-none">{{ summary?.month.bookings ?? 0 }}</p>
        <p class="section-label mt-1">筆</p>
      </div>
      <div class="card">
        <p class="section-label mb-1.5">本月營收</p>
        <p class="text-base font-extrabold text-brand-600 leading-none tracking-tight">NT$ {{ summary?.month.revenue ?? 0 }}</p>
      </div>
    </div>

    <section>
      <h2 class="font-bold mb-2">待結帳（今日已完成未付）</h2>
      <p v-if="loading" class="text-center text-brand-400 py-4">載入中…</p>
      <p v-else-if="!pending.length" class="text-center text-brand-400 py-4">目前沒有待結帳項目</p>
      <ul v-else class="space-y-2">
        <li v-for="b in pending" :key="b.id" class="card flex justify-between items-center">
          <div>
            <div class="font-bold">{{ b.name }}</div>
            <div class="text-xs text-brand-500">{{ b.time }} · {{ b.items }}</div>
          </div>
          <div class="text-right">
            <div class="text-brand-600 font-bold">${{ b.total }}</div>
            <button class="btn-primary text-xs !py-1 mt-1" @click="openCheckout(b)">結帳</button>
          </div>
        </li>
      </ul>
    </section>

    <section>
      <h2 class="font-bold mb-2">已結帳（本月）</h2>
      <ul v-if="paid.length" class="space-y-2">
        <li v-for="b in paid" :key="b.id" class="card">
          <div class="flex justify-between">
            <div>
              <div class="font-bold">{{ b.name }}</div>
              <div class="text-xs text-brand-500">{{ b.date }} {{ b.time }} · {{ b.items }}</div>
            </div>
            <div class="text-right">
              <div class="text-brand-600 font-bold">${{ b.total }}</div>
              <div class="text-xs text-brand-500">{{ b.payMethod }}</div>
            </div>
          </div>
        </li>
      </ul>
      <p v-else class="text-center text-brand-400 py-4">尚無結帳紀錄</p>
    </section>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-30 flex items-center justify-center p-5" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[320px] max-h-[90vh] overflow-y-auto space-y-3 no-scrollbar" style="border-radius:32px;padding:28px;">
        <h3 class="font-bold text-lg">結帳 — {{ target?.name }}</h3>
        <p class="text-sm text-brand-500">{{ target?.items }}</p>
        <p class="text-2xl font-bold text-brand-600">${{ target?.total }}</p>
        <div>
          <label class="label">付款方式</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="m in (['現金', '轉帳', '儲值金'] as PayMethod[])"
              :key="m"
              type="button"
              class="py-2.5 text-xs font-bold text-center transition-all"
              :class="payMethod === m ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-brand-500 border-brand-200'"
              style="border-radius: 12px; border-width: 1.5px;"
              @click="payMethod = m"
            >
              {{ m }}
            </button>
          </div>
        </div>
        <div class="flex gap-2 pt-2">
          <button class="btn-outline flex-1" @click="showModal = false">取消</button>
          <button class="btn-primary flex-1" @click="confirmCheckout">確認結帳</button>
        </div>
      </div>
    </div>
  </div>
</template>
