<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import SharedCalendar from '@/components/SharedCalendar.vue';
import { bookingsApi } from '@/api/bookings';
import { financeApi } from '@/api/finance';
import { slotsApi } from '@/api/slots';
import type { Booking, BookingStatus, FinanceSummary, BlockedSlot } from '@/api/types';

const selectedDate = ref<string | null>(new Date().toISOString().slice(0, 10));
const month = ref<string>(new Date().toISOString().slice(0, 7));
const monthBookings = ref<Booking[]>([]);
const summary = ref<FinanceSummary | null>(null);
const loading = ref(false);

// --- 時段管理 ---
const showSlotModal = ref(false);
const slotDate = ref('');
const allSlots = ref<string[]>([]);
const blockedSlots = ref<BlockedSlot[]>([]);
const slotLoading = ref(false);

// 生成 30 分鐘間隔的時段 (11:00 ~ 19:30)
const defaultSlots = (() => {
  const slots: string[] = [];
  for (let h = 11; h <= 19; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  slots.push('20:00');
  return slots;
})();

const bookedTimesForDate = computed(() => {
  const set = new Set<string>();
  for (const b of monthBookings.value) {
    if (b.date === slotDate.value && b.status !== '已取消') set.add(b.time);
  }
  return set;
});

const blockedTimesForDate = computed(() => {
  const set = new Set<string>();
  for (const bs of blockedSlots.value) {
    if (bs.date === slotDate.value) set.add(bs.time);
  }
  return set;
});

function getSlotStatus(time: string): 'booked' | 'blocked' | 'available' {
  if (bookedTimesForDate.value.has(time)) return 'booked';
  if (blockedTimesForDate.value.has(time)) return 'blocked';
  return 'available';
}

async function openSlotModal(date: string) {
  slotDate.value = date;
  slotLoading.value = true;
  showSlotModal.value = true;
  try {
    const [config, blocked] = await Promise.all([
      slotsApi.getConfig(),
      slotsApi.listBlocked(month.value),
    ]);
    allSlots.value = config.length > 0 ? config : defaultSlots;
    blockedSlots.value = blocked;
  } finally {
    slotLoading.value = false;
  }
}

async function toggleSlot(time: string) {
  const status = getSlotStatus(time);
  if (status === 'booked') return; // 已預約的不能操作
  if (status === 'blocked') {
    await slotsApi.unblock(slotDate.value, time);
    blockedSlots.value = blockedSlots.value.filter(
      (bs) => !(bs.date === slotDate.value && bs.time === time)
    );
  } else {
    await slotsApi.block(slotDate.value, time);
    blockedSlots.value.push({ id: '', date: slotDate.value, time });
  }
}

// --- 預約 Modal ---
const showModal = ref(false);
const editing = ref<Booking | null>(null);
const form = ref({
  id: '',
  name: '',
  phone: '',
  date: '',
  time: '',
  items: '',
  total: 0,
  status: '待確認' as BookingStatus,
  remarks: '',
});

const statuses: BookingStatus[] = ['待確認', '已確認', '已完成', '已取消'];
const statusClass: Record<BookingStatus, string> = {
  待確認: 'badge-pending',
  已確認: 'badge-confirmed',
  已完成: 'badge-done',
  已取消: 'badge-cancelled',
};

const markedDates = computed(() => {
  const set = new Set<string>();
  for (const b of monthBookings.value) if (b.status !== '已取消') set.add(b.date);
  return Array.from(set);
});

const dayBookings = computed(() =>
  selectedDate.value
    ? monthBookings.value.filter((b) => b.date === selectedDate.value).sort((a, b) => a.time.localeCompare(b.time))
    : []
);

async function loadMonth(m: string) {
  month.value = m;
  loading.value = true;
  try {
    const [list, sum] = await Promise.all([
      bookingsApi.listAll({ month: m }),
      financeApi.summary(),
    ]);
    monthBookings.value = list;
    summary.value = sum;
  } finally {
    loading.value = false;
  }
}

watch(month, (m) => {
  loadMonth(m);
});

onMounted(() => loadMonth(month.value));

function onDateSelect(date: string) {
  selectedDate.value = date;
  openSlotModal(date);
}

async function changeStatus(b: Booking, next: BookingStatus) {
  await bookingsApi.update(b.id, { status: next });
  await loadMonth(month.value);
}

function openCreate() {
  editing.value = null;
  form.value = {
    id: '',
    name: '',
    phone: '',
    date: selectedDate.value ?? new Date().toISOString().slice(0, 10),
    time: '10:00',
    items: '',
    total: 0,
    status: '待確認',
    remarks: '',
  };
  showModal.value = true;
}

function openEdit(b: Booking) {
  editing.value = b;
  form.value = {
    id: b.id,
    name: b.name,
    phone: b.phone,
    date: b.date,
    time: b.time,
    items: b.items,
    total: b.total,
    status: b.status,
    remarks: b.remarks ?? '',
  };
  showModal.value = true;
}

async function save() {
  if (editing.value) {
    await bookingsApi.update(editing.value.id, {
      name: form.value.name,
      phone: form.value.phone,
      date: form.value.date,
      time: form.value.time,
      items: form.value.items,
      total: Number(form.value.total),
      status: form.value.status,
      remarks: form.value.remarks || null,
    });
  } else {
    await bookingsApi.create({
      name: form.value.name,
      phone: form.value.phone,
      date: form.value.date,
      time: form.value.time,
      items: form.value.items,
      total: Number(form.value.total),
      remarks: form.value.remarks || null,
    });
  }
  showModal.value = false;
  await loadMonth(month.value);
}

async function remove(b: Booking) {
  if (!window.confirm('確定要刪除這筆預約？')) return;
  await bookingsApi.remove(b.id);
  await loadMonth(month.value);
}

function formatDateLabel(date: string) {
  const d = new Date(date + 'T00:00:00');
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y} 年 ${m}月 ${day} 日`;
}
</script>

<template>
  <div class="space-y-4">
    <!-- KPI -->
    <div class="grid grid-cols-2 gap-3">
      <div class="card">
        <p class="section-label mb-1.5">今日預約</p>
        <p class="text-[28px] font-extrabold text-brand-600 leading-none">{{ summary?.today.bookings ?? 0 }}</p>
        <p class="section-label mt-1">筆</p>
      </div>
      <div class="card">
        <p class="section-label mb-1.5">今日營收</p>
        <p class="text-base font-extrabold text-brand-600 leading-none tracking-tight">NT$ {{ summary?.today.revenue ?? 0 }}</p>
        <p class="section-label mt-1">已結帳</p>
      </div>
    </div>

    <SharedCalendar
      v-model="selectedDate"
      :marked-dates="markedDates"
      @update:model-value="onDateSelect"
      @month-change="loadMonth"
    />

    <!-- 日清單 -->
    <section>
      <div class="flex items-center justify-between mb-2">
        <h2 class="font-bold">{{ selectedDate }} 預約</h2>
        <button class="btn-pill text-[10px]" @click="openCreate">+ 新增</button>
      </div>
      <p v-if="loading" class="text-center text-brand-400 py-6">載入中…</p>
      <p v-else-if="!dayBookings.length" class="text-center text-brand-400 py-6">本日無預約</p>
      <ul v-else class="space-y-2">
        <li v-for="b in dayBookings" :key="b.id" class="card">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-sm text-brand-500">{{ b.time }}</div>
              <div class="font-bold">{{ b.name }} · {{ b.phone }}</div>
              <div class="text-xs text-brand-500">{{ b.items }}</div>
              <div class="text-brand-600 mt-1">${{ b.total }}</div>
            </div>
            <span class="badge" :class="statusClass[b.status]">{{ b.status }}</span>
          </div>
          <div class="flex gap-2 mt-3 flex-wrap">
            <select
              class="input !py-1 text-xs max-w-[120px]"
              :value="b.status"
              @change="(e) => changeStatus(b, (e.target as HTMLSelectElement).value as BookingStatus)"
            >
              <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
            </select>
            <button class="btn-outline text-xs !py-1" @click="openEdit(b)">編輯</button>
            <button class="btn-outline text-xs !py-1 !text-red-600 !border-red-200" @click="remove(b)">刪除</button>
          </div>
        </li>
      </ul>
    </section>

    <!-- 下月預估 -->
    <div v-if="summary" class="card">
      <h3 class="font-bold mb-2">下月業績預估</h3>
      <div class="flex justify-between text-sm">
        <span class="text-brand-500">預約筆數</span>
        <span class="font-bold">{{ summary.nextMonthEstimate.bookings }}</span>
      </div>
      <div class="flex justify-between text-sm mt-1">
        <span class="text-brand-500">預估營收</span>
        <span class="font-bold text-brand-600">${{ summary.nextMonthEstimate.revenue }}</span>
      </div>
    </div>

    <!-- 時段管理 Modal -->
    <div v-if="showSlotModal" class="fixed inset-0 z-30 flex items-center justify-center p-5" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px] max-h-[90vh] overflow-y-auto no-scrollbar" style="border-radius:32px;padding:28px;">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h3 class="font-bold text-lg">{{ formatDateLabel(slotDate) }}</h3>
            <p class="text-xs text-brand-400 mt-0.5">點時段關閉或解鎖</p>
          </div>
          <button
            class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition"
            @click="showSlotModal = false"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- 圖例 -->
        <div class="flex gap-4 mb-4 text-[10px] font-bold text-brand-400">
          <span class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-brand-600"></span> 已預約
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-brand-200"></span> 關閉
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-white border border-brand-100"></span> 空檔
          </span>
        </div>

        <p v-if="slotLoading" class="text-center text-brand-400 py-6 text-xs">載入中…</p>
        <div v-else class="grid grid-cols-3 gap-2">
          <button
            v-for="time in allSlots"
            :key="time"
            type="button"
            class="flex flex-col items-center justify-center py-3 rounded-xl border transition-all active:scale-95"
            :class="{
              'bg-brand-600 text-white border-brand-600 cursor-default': getSlotStatus(time) === 'booked',
              'bg-brand-100 text-brand-400 border-brand-200': getSlotStatus(time) === 'blocked',
              'bg-white text-brand-600 border-brand-100 hover:border-brand-300': getSlotStatus(time) === 'available',
            }"
            @click="toggleSlot(time)"
          >
            <span class="text-sm font-bold">{{ time }}</span>
            <span class="text-[10px] mt-0.5" :class="{
              'text-white/70': getSlotStatus(time) === 'booked',
              'text-brand-300': getSlotStatus(time) === 'blocked',
              'text-brand-400': getSlotStatus(time) === 'available',
            }">
              {{ getSlotStatus(time) === 'booked' ? '已預約' : getSlotStatus(time) === 'blocked' ? '關閉' : '空檔' }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- 預約 Modal -->
    <div v-if="showModal" class="fixed inset-0 z-30 flex items-center justify-center p-5" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[320px] max-h-[90vh] overflow-y-auto space-y-3 no-scrollbar" style="border-radius:32px;padding:28px;">
        <h3 class="font-bold text-lg">{{ editing ? '編輯預約' : '新增預約' }}</h3>
        <div>
          <label class="label">姓名</label>
          <input v-model="form.name" class="input" />
        </div>
        <div>
          <label class="label">手機</label>
          <input v-model="form.phone" class="input" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="label">日期</label>
            <input v-model="form.date" type="date" class="input" />
          </div>
          <div>
            <label class="label">時段</label>
            <input v-model="form.time" class="input" placeholder="14:00" />
          </div>
        </div>
        <div>
          <label class="label">項目</label>
          <input v-model="form.items" class="input" placeholder="比基尼、腋下" />
        </div>
        <div>
          <label class="label">金額</label>
          <input v-model.number="form.total" type="number" class="input" />
        </div>
        <div v-if="editing">
          <label class="label">狀態</label>
          <select v-model="form.status" class="input">
            <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div>
          <label class="label">備註</label>
          <textarea v-model="form.remarks" class="input" rows="2" />
        </div>
        <div class="flex gap-2 pt-2">
          <button class="btn-outline flex-1" @click="showModal = false">取消</button>
          <button class="btn-primary flex-1" @click="save">儲存</button>
        </div>
      </div>
    </div>
  </div>
</template>
