<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SharedCalendar from '@/components/SharedCalendar.vue';
import { financeApi } from '@/api/finance';
import { bookingsApi } from '@/api/bookings';
import { costsApi } from '@/api/costs';
import type {
  Booking,
  Cost,
  FinanceSummary,
  MonthSummary,
  PayMethodBreakdown,
  PayMethodLabel,
  YearSummary,
} from '@/api/types';

const summary = ref<FinanceSummary | null>(null);
const costs = ref<Cost[]>([]);
const loading = ref(false);

const form = ref({
  cat: '耗材' as Cost['cat'],
  desc: '',
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
});

const catIcons: Record<Cost['cat'], string> = {
  '耗材': '🧴',
  '店租': '🏠',
  '水電': '💡',
  '行銷': '📣',
  '薪資': '💰',
  '其他': '📦',
};

const cats: Cost['cat'][] = ['耗材', '店租', '水電', '行銷', '薪資', '其他'];
const filterCat = ref<Cost['cat'] | 'all'>('all');
const showCatPicker = ref(false);

function selectCat(c: Cost['cat']) {
  form.value.cat = c;
  showCatPicker.value = false;
}

// 日期選擇彈窗
const showDatePicker = ref(false);
const datePickerValue = ref<string | null>(null);

function openDatePicker() {
  datePickerValue.value = form.value.date;
  showDatePicker.value = true;
}

function selectDate(d: string) {
  form.value.date = d;
  showDatePicker.value = false;
}

// 篩選
const filtered = computed(() => {
  if (filterCat.value === 'all') return costs.value;
  return costs.value.filter((c) => c.cat === filterCat.value);
});

// 按月份分組
const groupedByMonth = computed(() => {
  const map = new Map<string, Cost[]>();
  for (const c of filtered.value) {
    const m = c.date.slice(0, 7);
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(c);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
});

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return `${y} 年 ${parseInt(mo)} 月`;
}

function sumOfMonth(list: Cost[]) {
  return list.reduce((s, c) => s + c.amount, 0);
}

function formatDateShort(date: string) {
  if (!date) return '';
  const d = new Date(date + 'T00:00:00');
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

async function load() {
  loading.value = true;
  try {
    const [sum, list] = await Promise.all([financeApi.summary(), costsApi.list()]);
    summary.value = sum;
    costs.value = list;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function save() {
  if (!form.value.amount) return;
  await costsApi.create({
    cat: form.value.cat,
    desc: form.value.desc || undefined,
    amount: Number(form.value.amount),
    date: form.value.date,
  });
  form.value = {
    cat: '耗材',
    desc: '',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
  };
  await load();
}

async function remove(c: Cost) {
  if (!window.confirm('刪除這筆成本？')) return;
  await costsApi.remove(c.id);
  await load();
}

// 營收收款明細 Modal（支援「今日」與指定月份的瀏覽）
const showRevenueModal = ref(false);
const revenueScope = ref<'today' | 'month'>('today');
const revenueSelectedMonth = ref<string>(''); // YYYY-MM
const revenueMonthData = ref<MonthSummary | null>(null);
const revenueMonthLoading = ref(false);

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function loadRevenueMonth(month: string) {
  revenueMonthLoading.value = true;
  try {
    revenueMonthData.value = await financeApi.month(month);
  } finally {
    revenueMonthLoading.value = false;
  }
}

async function openRevenue(scope: 'today' | 'month') {
  revenueScope.value = scope;
  expandedMethod.value = null;
  showRevenueModal.value = true;
  if (scope === 'month') {
    revenueSelectedMonth.value = todayStr();
    await loadRevenueMonth(revenueSelectedMonth.value);
  }
}

async function shiftRevenueMonth(delta: number) {
  const [y, m] = revenueSelectedMonth.value.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  revenueSelectedMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  expandedMethod.value = null;
  await loadRevenueMonth(revenueSelectedMonth.value);
}

const revenueBreakdown = computed<PayMethodBreakdown | null>(() => {
  if (revenueScope.value === 'today') return summary.value?.today.byPayMethod ?? null;
  return revenueMonthData.value?.byPayMethod ?? null;
});

const revenueTotalAmount = computed(() => {
  if (revenueScope.value === 'today') return summary.value?.today.revenue ?? 0;
  return revenueMonthData.value?.revenue ?? 0;
});
const revenueTotalCount = computed(() => {
  if (revenueScope.value === 'today') return summary.value?.today.bookings ?? 0;
  return revenueMonthData.value?.bookings ?? 0;
});

function formatMonthLabel(ym: string) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${y} 年 ${parseInt(m)} 月`;
}

const payMethodOrder: PayMethodLabel[] = ['現金', '轉帳', '儲值金', '空檔費'];
const payMethodIcons: Record<PayMethodLabel, string> = {
  '現金': '💵',
  '轉帳': '🏦',
  '儲值金': '💳',
  '空檔費': '🕳️',
};

// 單一付款方式的會員明細（點付款方式卡片展開）
const expandedMethod = ref<PayMethodLabel | null>(null);
function toggleMethod(m: PayMethodLabel) {
  expandedMethod.value = expandedMethod.value === m ? null : m;
}

// 年營收 Modal（支援切換年份）
const showYearModal = ref(false);
const yearData = ref<YearSummary | null>(null);
const yearLoading = ref(false);

async function loadYear(year: number) {
  yearLoading.value = true;
  try {
    yearData.value = await financeApi.year(year);
  } finally {
    yearLoading.value = false;
  }
}

async function openYear() {
  showYearModal.value = true;
  const current = summary.value?.year.year ?? new Date().getFullYear();
  if (!yearData.value || yearData.value.year !== current) {
    await loadYear(current);
  }
}

async function shiftYear(delta: number) {
  if (!yearData.value) return;
  await loadYear(yearData.value.year + delta);
}

function monthNumLabel(m: string) {
  const [, mo] = m.split('-');
  return `${parseInt(mo)} 月`;
}

const yearMaxRevenue = computed(() => {
  if (!yearData.value) return 0;
  return Math.max(0, ...yearData.value.byMonth.map((e) => e.revenue));
});

// 年營收 Modal：展開的月份（預設全部收起）
const expandedYearMonths = ref<Set<string>>(new Set());
const yearMonthBookings = ref<Record<string, Booking[]>>({});
const yearMonthLoading = ref<Set<string>>(new Set());

async function toggleYearMonth(m: string) {
  const s = new Set(expandedYearMonths.value);
  if (s.has(m)) {
    s.delete(m);
  } else {
    s.add(m);
    // 尚未載入過 → 撈取該月已結帳的預約明細
    if (!yearMonthBookings.value[m]) {
      yearMonthLoading.value = new Set([...yearMonthLoading.value, m]);
      try {
        const list = await bookingsApi.listAll({ paidMonth: m });
        yearMonthBookings.value = { ...yearMonthBookings.value, [m]: list };
      } finally {
        const nl = new Set(yearMonthLoading.value);
        nl.delete(m);
        yearMonthLoading.value = nl;
      }
    }
  }
  expandedYearMonths.value = s;
}

// 成本記帳本：展開的月份（預設全部收起）
const expandedCostMonths = ref<Set<string>>(new Set());
function toggleCostMonth(m: string) {
  const s = new Set(expandedCostMonths.value);
  if (s.has(m)) s.delete(m);
  else s.add(m);
  expandedCostMonths.value = s;
}
</script>

<template>
  <div class="space-y-4">
    <!-- KPI -->
    <div class="grid grid-cols-2 gap-3">
      <button type="button" class="card !py-2 text-left hover:bg-brand-50 transition" @click="openRevenue('today')">
        <div class="flex items-center justify-between">
          <p class="section-label">今日營收</p>
          <svg class="w-3 h-3 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </div>
        <p class="text-sm font-extrabold text-brand-600 leading-none tracking-tight mt-1">NT$ {{ summary?.today.revenue ?? 0 }}</p>
      </button>
      <div class="card !py-2">
        <p class="section-label mb-1">今日淨利</p>
        <p class="text-sm font-extrabold leading-none tracking-tight" :class="(summary?.today.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'">
          NT$ {{ summary?.today.net ?? 0 }}
        </p>
      </div>
      <button type="button" class="card !py-2 text-left hover:bg-brand-50 transition" @click="openRevenue('month')">
        <div class="flex items-center justify-between">
          <p class="section-label">本月營收</p>
          <svg class="w-3 h-3 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </div>
        <p class="text-sm font-extrabold text-brand-600 leading-none tracking-tight mt-1">NT$ {{ summary?.month.revenue ?? 0 }}</p>
      </button>
      <div class="card !py-2">
        <p class="section-label mb-1">本月淨利</p>
        <p class="text-sm font-extrabold leading-none tracking-tight" :class="(summary?.month.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'">
          NT$ {{ summary?.month.net ?? 0 }}
        </p>
      </div>
    </div>

    <!-- 年營收卡片 -->
    <button type="button" class="card !py-2 w-full text-left hover:bg-brand-50 transition" @click="openYear">
      <div class="flex items-center justify-between">
        <div>
          <p class="section-label">年營收 · {{ summary?.year.year ?? new Date().getFullYear() }}</p>
          <p class="text-sm font-extrabold text-brand-600 leading-none tracking-tight mt-1">NT$ {{ (summary?.year.revenue ?? 0).toLocaleString() }}</p>
          <p class="text-[10px] text-brand-400 mt-0.5">共 {{ summary?.year.bookings ?? 0 }} 筆</p>
        </div>
        <svg class="w-3.5 h-3.5 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </button>

    <!-- 成本記帳本 -->
    <section>
      <p class="section-label mb-3">成本記帳本 · COST TRACKER</p>

      <!-- 表單卡片 -->
      <div class="card space-y-3">
        <!-- Row 1: 分類 + 說明 -->
        <div class="flex gap-2">
          <div class="relative">
            <button type="button" class="cost-field flex items-center gap-2" style="min-width: 100px;" @click="showCatPicker = !showCatPicker">
              <span class="font-bold">{{ form.cat }}</span>
              <svg class="w-3 h-3 text-brand-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div v-if="showCatPicker" class="cat-dropdown">
              <button
                v-for="c in cats"
                :key="c"
                type="button"
                class="cat-dropdown-item"
                :class="{ 'cat-dropdown-active': form.cat === c }"
                @click="selectCat(c)"
              >
                <span>{{ catIcons[c] }}</span>
                <span>{{ c }}</span>
              </button>
            </div>
          </div>
          <input v-model="form.desc" class="cost-field flex-1" placeholder="說明（例：購入蜜蠟）" />
        </div>

        <!-- Row 2: 金額 + 日期 + 記帳 -->
        <div class="flex gap-2 items-stretch">
          <input v-model.number="form.amount" type="number" class="cost-field flex-1 min-w-0" placeholder="金額 NT$" style="padding: 12px 14px;" />
          <button type="button" class="cost-field flex items-center gap-1 shrink-0" style="padding: 12px 10px;" @click="openDatePicker">
            <span class="text-[12px]" :class="form.date ? 'text-brand-600 font-bold' : 'text-brand-400'">{{ form.date ? formatDateShort(form.date) : '選擇日期' }}</span>
            <svg class="w-3.5 h-3.5 text-brand-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </button>
          <button type="button" class="shrink-0 font-bold text-sm text-white rounded-2xl" style="background:#655b55; padding: 12px 16px;" @click="save">記帳</button>
        </div>
      </div>

      <!-- 分類篩選 tabs -->
      <div class="flex gap-2 mt-4 flex-wrap">
        <button
          v-for="c in cats"
          :key="c"
          type="button"
          class="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold transition-all"
          :class="filterCat === c
            ? 'bg-brand-600 text-white'
            : 'bg-white text-brand-500 border border-brand-100'"
          @click="filterCat = filterCat === c ? 'all' : c"
        >
          <span>{{ catIcons[c] }}</span>
          <span>{{ c }}</span>
        </button>
      </div>

      <!-- 成本列表（按月份分組） -->
      <div class="mt-4">
        <p v-if="loading" class="text-center text-brand-400 py-6">載入中…</p>
        <p v-else-if="!groupedByMonth.length" class="text-center text-brand-400 py-6">尚無成本記錄</p>
        <div v-else class="space-y-4">
          <div v-for="[m, list] in groupedByMonth" :key="m">
            <!-- 月份標題（可點擊展開/收合） -->
            <button
              type="button"
              class="w-full flex justify-between items-center mb-2 py-1"
              @click="toggleCostMonth(m)"
            >
              <span class="flex items-center gap-1.5">
                <svg
                  class="w-3 h-3 text-brand-300 transition-transform"
                  :class="{ 'rotate-90': expandedCostMonths.has(m) }"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                >
                  <path d="M9 18l6-6-6-6"/>
                </svg>
                <span class="text-xs font-bold text-brand-500">{{ monthLabel(m) }}</span>
                <span class="text-[10px] text-brand-300">· {{ list.length }} 筆</span>
              </span>
              <span class="text-xs font-extrabold text-brand-600">NT$ {{ sumOfMonth(list).toLocaleString() }}</span>
            </button>
            <!-- 該月記錄（點擊月份才展開） -->
            <ul v-if="expandedCostMonths.has(m)" class="space-y-2">
              <li v-for="c in list" :key="c.id" class="card flex justify-between items-center">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="text-lg shrink-0">{{ catIcons[c.cat] }}</span>
                  <div class="min-w-0">
                    <div class="text-sm font-bold text-brand-600 truncate">{{ c.desc || c.cat }}</div>
                    <div class="text-[10px] text-brand-400 mt-0.5">{{ c.date }} · {{ c.cat }}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="font-extrabold text-brand-700">NT$ {{ c.amount.toLocaleString() }}</span>
                  <button class="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition shrink-0" @click="remove(c)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Revenue Breakdown Modal -->
    <div v-if="showRevenueModal" class="fixed inset-0 z-40 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);" @click.self="showRevenueModal = false">
      <div class="bg-white w-full max-w-[360px] flex flex-col" style="border-radius:24px; max-height: 88dvh; overflow: hidden;">
        <div class="flex justify-between items-start shrink-0" style="padding: 24px 24px 12px;">
          <div>
            <h3 class="font-bold text-lg">{{ revenueScope === 'today' ? '今日' : '月份' }}收款明細</h3>
            <p class="text-[10px] text-brand-400 font-bold mt-0.5">REVENUE BY PAYMENT METHOD</p>
          </div>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showRevenueModal = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <!-- 月份切換（僅 scope='month' 顯示） -->
        <div v-if="revenueScope === 'month'" class="flex items-center justify-between shrink-0" style="padding: 0 24px 8px;">
          <button class="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-brand-500 hover:bg-brand-100 transition" :disabled="revenueMonthLoading" @click="shiftRevenueMonth(-1)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <p class="text-sm font-extrabold text-brand-700">{{ formatMonthLabel(revenueSelectedMonth) }}</p>
          <button class="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-brand-500 hover:bg-brand-100 transition" :disabled="revenueMonthLoading" @click="shiftRevenueMonth(1)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto no-scrollbar" style="padding: 0 20px 24px;">
          <!-- 總計 -->
          <div class="flex justify-between items-center p-4 mb-3" style="background:#f5f3f1;border-radius:16px;">
            <div>
              <p class="text-[10px] font-bold text-brand-400">共 {{ revenueTotalCount }} 筆</p>
              <p class="text-[10px] text-brand-400 mt-0.5">總計</p>
            </div>
            <p class="text-base font-extrabold text-brand-700">NT$ {{ revenueTotalAmount.toLocaleString() }}</p>
          </div>

          <!-- 各種付款方式 -->
          <ul v-if="revenueBreakdown" class="space-y-2">
            <li
              v-for="m in payMethodOrder"
              :key="m"
              :class="revenueBreakdown[m].count > 0 ? 'bg-white border border-brand-100' : 'bg-brand-50/50 border border-brand-100 opacity-60'"
              class="rounded-2xl overflow-hidden"
            >
              <button
                type="button"
                class="w-full flex items-center justify-between px-4 py-3 text-left"
                :disabled="revenueBreakdown[m].count === 0"
                @click="toggleMethod(m)"
              >
                <div class="flex items-center gap-3">
                  <span class="text-lg">{{ payMethodIcons[m] }}</span>
                  <div>
                    <p class="text-sm font-bold text-brand-700">{{ m }}</p>
                    <p class="text-[10px] text-brand-400 mt-0.5">{{ revenueBreakdown[m].count }} 筆</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <p class="text-sm font-extrabold text-brand-600">NT$ {{ revenueBreakdown[m].total.toLocaleString() }}</p>
                  <svg
                    v-if="revenueBreakdown[m].count > 0"
                    class="w-3 h-3 text-brand-400 transition-transform"
                    :class="{ 'rotate-90': expandedMethod === m }"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                  >
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </button>

              <!-- 會員明細 -->
              <ul
                v-if="expandedMethod === m && revenueBreakdown[m].bookings.length"
                class="px-4 pb-3 pt-1 space-y-1.5"
                style="border-top: 1px dashed #eee;"
              >
                <li
                  v-for="(bk, idx) in revenueBreakdown[m].bookings"
                  :key="bk.id"
                  class="flex items-start justify-between gap-2"
                  :class="{ 'pt-2': idx === 0 }"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="text-[11px] font-extrabold text-brand-700 truncate">{{ bk.name }}</span>
                      <span class="text-[9px] text-brand-400">{{ bk.phone }}</span>
                    </div>
                    <div class="text-[10px] text-brand-400 mt-0.5 truncate">{{ bk.items }}</div>
                    <div class="text-[9px] text-brand-300 mt-0.5">{{ bk.date }} {{ bk.time }}</div>
                  </div>
                  <p class="text-[11px] font-extrabold text-brand-600 shrink-0">NT$ {{ bk.total.toLocaleString() }}</p>
                </li>
              </ul>
            </li>
          </ul>

          <p class="text-[10px] text-brand-400 mt-4 leading-relaxed">
            * 以已結帳（有 paidAt）的預約計算；「空檔費」為結帳時選擇空檔費的補貼收入（臨時取消或放鳥）
          </p>
        </div>
      </div>
    </div>

    <!-- Year Revenue Modal -->
    <div v-if="showYearModal" class="fixed inset-0 z-40 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);" @click.self="showYearModal = false">
      <div class="bg-white w-full max-w-[360px] flex flex-col" style="border-radius:24px; max-height: 88dvh; overflow: hidden;">
        <div class="flex justify-between items-start shrink-0" style="padding: 24px 24px 12px;">
          <div>
            <h3 class="font-bold text-lg">年營收</h3>
            <p class="text-[10px] text-brand-400 font-bold mt-0.5">ANNUAL REVENUE BY MONTH</p>
          </div>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showYearModal = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- 年份切換 -->
        <div class="flex items-center justify-between shrink-0" style="padding: 0 24px 8px;">
          <button class="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-brand-500 hover:bg-brand-100 transition" :disabled="yearLoading" @click="shiftYear(-1)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <p class="text-base font-extrabold text-brand-700">{{ yearData?.year ?? '—' }}</p>
          <button class="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-brand-500 hover:bg-brand-100 transition" :disabled="yearLoading" @click="shiftYear(1)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto no-scrollbar" style="padding: 0 20px 24px;">
          <!-- 年度總計 -->
          <div class="flex justify-between items-center p-4 mb-3" style="background:#f5f3f1;border-radius:16px;">
            <div>
              <p class="text-[10px] font-bold text-brand-400">共 {{ yearData?.bookings ?? 0 }} 筆</p>
              <p class="text-[10px] text-brand-400 mt-0.5">年度總營收</p>
            </div>
            <p class="text-base font-extrabold text-brand-700">NT$ {{ (yearData?.revenue ?? 0).toLocaleString() }}</p>
          </div>

          <p v-if="yearLoading" class="text-center text-brand-400 py-6 text-xs">載入中…</p>

          <!-- 各月份列表（可收合） -->
          <div v-else-if="yearData" class="space-y-2">
            <div v-for="entry in yearData.byMonth" :key="entry.month">
              <button
                type="button"
                class="w-full flex justify-between items-center py-1"
                @click="toggleYearMonth(entry.month)"
              >
                <span class="flex items-center gap-1.5">
                  <svg
                    class="w-3 h-3 text-brand-300 transition-transform"
                    :class="{ 'rotate-90': expandedYearMonths.has(entry.month) }"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                  >
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                  <span class="text-xs font-bold text-brand-500">{{ monthNumLabel(entry.month) }}</span>
                  <span class="text-[10px] text-brand-300">· {{ entry.bookings }} 筆</span>
                </span>
                <span class="text-xs font-extrabold text-brand-600">NT$ {{ entry.revenue.toLocaleString() }}</span>
              </button>
              <!-- 展開：預約明細 -->
              <div v-if="expandedYearMonths.has(entry.month)" class="pl-6 pr-1 pb-2 pt-1">
                <!-- 長條圖 -->
                <div class="flex items-center gap-2 mb-2">
                  <div class="flex-1 h-1.5 rounded-full" style="background:#f0edea;">
                    <div
                      class="h-full rounded-full"
                      style="background:#655b55;"
                      :style="{ width: yearMaxRevenue > 0 ? (entry.revenue / yearMaxRevenue * 100) + '%' : '0%' }"
                    ></div>
                  </div>
                  <p class="text-[10px] text-brand-400 shrink-0">{{ entry.bookings }} 筆</p>
                </div>
                <!-- 逐筆明細 -->
                <p v-if="yearMonthLoading.has(entry.month)" class="text-[10px] text-brand-400 py-2">載入中…</p>
                <ul v-else-if="yearMonthBookings[entry.month]?.length" class="space-y-1.5">
                  <li
                    v-for="bk in yearMonthBookings[entry.month]"
                    :key="bk.id"
                    class="flex items-start justify-between gap-2 py-1.5"
                    style="border-bottom: 1px dashed #f0edea;"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-[11px] font-extrabold text-brand-700 truncate">{{ bk.name }}</span>
                        <span class="text-[9px] text-brand-400">{{ bk.phone }}</span>
                      </div>
                      <div class="text-[10px] text-brand-400 mt-0.5 truncate">{{ bk.items }}</div>
                      <div class="text-[9px] text-brand-300 mt-0.5">{{ bk.date }} {{ bk.time }} · {{ bk.payMethod ?? '' }}</div>
                    </div>
                    <p class="text-[11px] font-extrabold text-brand-600 shrink-0">NT$ {{ bk.total.toLocaleString() }}</p>
                  </li>
                </ul>
                <p v-else class="text-[10px] text-brand-300 py-2">無結帳紀錄</p>
              </div>
            </div>
          </div>

          <p class="text-[10px] text-brand-400 mt-4 leading-relaxed">
            * 以已結帳（有 paidAt）的預約為準，按 paidAt 月份歸類
          </p>
        </div>
      </div>
    </div>

    <!-- Date Picker Modal -->
    <div v-if="showDatePicker" class="fixed inset-0 z-40 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px]" style="border-radius:24px; overflow: hidden;">
        <div class="flex justify-between items-start" style="padding: 24px 24px 12px;">
          <h3 class="font-bold text-lg">選擇日期</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showDatePicker = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style="padding: 0 18px 24px;">
          <SharedCalendar
            v-model="datePickerValue"
            @update:model-value="selectDate"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cost-field {
  background: #f5f3f1;
  border: none;
  border-radius: 16px;
  padding: 16px 18px;
  font-size: 14px;
  color: #4a423d;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}
.cost-field::placeholder {
  color: #b0aba7;
}

.cat-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 6px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  border: 1px solid #f0efed;
  padding: 6px;
  z-index: 50;
  min-width: 130px;
}

.cat-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 500;
  color: #4a423d;
  border: none;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.cat-dropdown-item:hover {
  background: #f5f3f1;
}
.cat-dropdown-active {
  font-weight: 700;
  color: #655b55;
  background: #f5f3f1;
}
</style>
