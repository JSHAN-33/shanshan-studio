<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { membersApi } from '@/api/members';
import { servicesApi } from '@/api/services';
import { bookingsApi } from '@/api/bookings';
import type { Member, Service, ServiceCat, AvailableSlot } from '@/api/types';

const members = ref<Member[]>([]);
const search = ref('');
const loading = ref(false);

const showModal = ref(false);
const editing = ref<Member | null>(null);
const form = ref({
  phone: '',
  name: '',
  bday: '',
  gender: '' as '' | '男' | '女',
  note: '',
  wallet: 0,
});

// --- 同步建立預約 ---
const withBooking = ref(false);
const bookingDate = ref('');
const bookingTime = ref('');
const services = ref<Service[]>([]);
const selectedServices = ref<Set<string>>(new Set());
const serviceTab = ref<ServiceCat>('women');
const slots = ref<AvailableSlot[]>([]);
const loadingSlots = ref(false);

const serviceTabs: Array<{ value: ServiceCat; label: string }> = [
  { value: 'women', label: '女生' },
  { value: 'men', label: '男士' },
  { value: 'eyelash', label: '睫毛' },
  { value: 'products', label: '產品' },
];

const filteredServices = computed(() =>
  services.value.filter((s) => s.cat === serviceTab.value)
);

const selectedTotal = computed(() => {
  let sum = 0;
  for (const s of services.value) {
    if (selectedServices.value.has(s.id)) sum += s.price;
  }
  return sum;
});

const selectedItemsLabel = computed(() => {
  return services.value
    .filter((s) => selectedServices.value.has(s.id))
    .map((s) => s.name)
    .join('、');
});

const totalDuration = computed(() => {
  let sum = 0;
  for (const s of services.value) {
    if (selectedServices.value.has(s.id)) sum += (s.duration ?? 0);
  }
  return sum;
});

function toggleService(id: string) {
  const set = new Set(selectedServices.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  selectedServices.value = set;
}

watch(bookingDate, async (d) => {
  bookingTime.value = '';
  if (!d) { slots.value = []; return; }
  loadingSlots.value = true;
  try {
    slots.value = await bookingsApi.availableSlots(d, totalDuration.value || undefined);
  } catch { slots.value = []; }
  finally { loadingSlots.value = false; }
});

// --- Wallet ---
const showWalletModal = ref(false);
const walletTarget = ref<Member | null>(null);
const walletDelta = ref(0);

const filtered = computed(() => {
  const q = search.value.trim();
  if (!q) return members.value;
  return members.value.filter((m) => m.name.includes(q) || m.phone.includes(q));
});

async function load() {
  loading.value = true;
  try {
    members.value = await membersApi.list();
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  services.value = await servicesApi.list();
});

function openCreate() {
  editing.value = null;
  form.value = { phone: '', name: '', bday: '', gender: '', note: '', wallet: 0 };
  withBooking.value = false;
  bookingDate.value = '';
  bookingTime.value = '';
  selectedServices.value = new Set();
  showModal.value = true;
}

function openEdit(m: Member) {
  editing.value = m;
  form.value = {
    phone: m.phone,
    name: m.name,
    bday: m.bday ?? '',
    gender: (m.gender ?? '') as '' | '男' | '女',
    note: m.note ?? '',
    wallet: m.wallet,
  };
  withBooking.value = false;
  bookingDate.value = '';
  bookingTime.value = '';
  selectedServices.value = new Set();
  showModal.value = true;
}

async function save() {
  // 儲存會員
  await membersApi.upsert({
    phone: form.value.phone,
    name: form.value.name,
    bday: form.value.bday || null,
    gender: form.value.gender || null,
    note: form.value.note || null,
  });

  // 同步建立預約
  if (withBooking.value && bookingDate.value && bookingTime.value && selectedServices.value.size > 0) {
    await bookingsApi.create({
      name: form.value.name,
      phone: form.value.phone,
      date: bookingDate.value,
      time: bookingTime.value,
      items: selectedItemsLabel.value,
      total: selectedTotal.value,
    });
  }

  showModal.value = false;
  await load();
}

function openWallet(m: Member) {
  walletTarget.value = m;
  walletDelta.value = 0;
  showWalletModal.value = true;
}

async function saveWallet() {
  if (!walletTarget.value || !walletDelta.value) {
    showWalletModal.value = false;
    return;
  }
  await membersApi.adjustWallet(walletTarget.value.phone, Number(walletDelta.value));
  showWalletModal.value = false;
  await load();
}

function formatDateLabel(date: string) {
  if (!date) return '';
  const d = new Date(date + 'T00:00:00');
  return `${d.getFullYear()} 年 ${d.getMonth() + 1}月 ${d.getDate()} 日`;
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-2">
      <input v-model="search" class="input flex-1" placeholder="搜尋姓名 / 手機" />
      <button class="btn-pill text-[10px]" @click="openCreate">+ 新增</button>
    </div>

    <p v-if="loading" class="text-center text-brand-400 py-6">載入中…</p>
    <ul v-else class="space-y-2">
      <li v-for="m in filtered" :key="m.id" class="card">
        <div class="flex justify-between items-start">
          <div>
            <div class="font-bold">{{ m.name }}</div>
            <div class="text-sm text-brand-500">{{ m.phone }}</div>
            <div v-if="m.bday" class="text-xs text-brand-400 mt-1">🎂 {{ m.bday }}</div>
            <div v-if="m.note" class="text-xs text-brand-400 mt-1">📝 {{ m.note }}</div>
          </div>
          <div class="text-right">
            <div class="text-xs text-brand-500">儲值金</div>
            <div class="text-lg font-bold text-brand-600">${{ m.wallet }}</div>
          </div>
        </div>
        <div class="flex gap-2 mt-3">
          <button class="btn-outline text-xs !py-1 flex-1" @click="openEdit(m)">編輯</button>
          <button class="btn-outline text-xs !py-1 flex-1" @click="openWallet(m)">儲值金</button>
        </div>
      </li>
      <li v-if="!filtered.length" class="text-center text-brand-400 py-6">尚無會員</li>
    </ul>

    <!-- Member Modal -->
    <div v-if="showModal" class="fixed inset-0 z-30 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[360px] flex flex-col" style="border-radius:32px; max-height: 88vh; overflow: hidden;">
        <!-- Header (固定) -->
        <div class="flex justify-between items-start shrink-0" style="padding: 24px 24px 12px;">
          <h3 class="font-bold text-lg">{{ editing ? '編輯會員' : '新增會員' }}</h3>
          <button class="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-400 hover:bg-brand-100 transition" @click="showModal = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- 可滾動內容 -->
        <div class="flex-1 overflow-y-auto no-scrollbar" style="padding: 0 24px 24px;">
          <!-- 基本資料 -->
          <div class="space-y-2.5">
            <input v-model="form.name" class="member-field w-full" placeholder="姓名" />
            <input v-model="form.phone" class="member-field w-full" placeholder="手機號碼" :disabled="!!editing" />

            <!-- 生日 + 性別 同一行 -->
            <div class="flex gap-2">
              <div class="flex-1 member-field flex items-center justify-between">
                <span class="text-brand-400 text-xs font-bold">生日</span>
                <input v-model="form.bday" type="date" class="bg-transparent outline-none text-xs text-right text-brand-700 font-bold" style="border:none; -webkit-appearance:none; max-width: 120px;" />
              </div>
              <div class="member-field flex items-center justify-between" style="min-width: 100px;">
                <span class="text-brand-400 text-xs font-bold">性別</span>
                <select v-model="form.gender" class="bg-transparent outline-none text-xs text-right text-brand-700 font-bold" style="border:none; -webkit-appearance:none; appearance:none;">
                  <option value="">不設定</option>
                  <option value="女">女</option>
                  <option value="男">男</option>
                </select>
              </div>
            </div>

            <div class="member-field flex items-center justify-between">
              <span class="text-brand-400 text-xs font-bold">儲值金餘額</span>
              <div class="flex items-center gap-1">
                <span class="text-xs text-brand-400">NT$</span>
                <span class="text-base font-extrabold text-brand-700">{{ form.wallet }}</span>
              </div>
            </div>

            <textarea v-model="form.note" class="member-field w-full resize-none text-xs" rows="2" placeholder="備註：VIP 等級、特殊膚質、偏好項目..." />
          </div>

          <!-- 同步建立預約 -->
          <div class="mt-4 pt-3" style="border-top: 1px dashed #e5e2df;">
            <p class="text-[10px] text-brand-400 font-bold text-center mb-3">同步建立預約（選填）</p>
            <div class="flex gap-2 mb-3">
              <div class="flex-1 member-field flex items-center justify-between">
                <span class="text-brand-400 text-[10px] font-bold shrink-0">日期</span>
                <input v-model="bookingDate" type="date" class="bg-transparent outline-none text-[11px] text-right text-brand-700 font-bold flex-1 ml-1" style="border:none;" />
              </div>
              <div class="member-field flex items-center gap-1.5" style="min-width: 95px;">
                <span class="text-brand-400 text-[10px] font-bold">時間</span>
                <select v-model="bookingTime" class="bg-transparent outline-none text-[11px] text-brand-600 font-bold flex-1" style="border:none; -webkit-appearance:none; appearance:none;">
                  <option value="" disabled>選擇</option>
                  <template v-for="s in slots" :key="s.time">
                    <option v-if="s.available" :value="s.time">{{ s.time }}</option>
                  </template>
                </select>
              </div>
            </div>

            <!-- 服務分類 tabs -->
            <div class="flex gap-1 mb-2">
              <button
                v-for="t in serviceTabs"
                :key="t.value"
                type="button"
                class="text-[10px] font-bold px-3 py-1.5 rounded-full transition-all"
                :class="serviceTab === t.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-50 text-brand-400'"
                @click="serviceTab = t.value"
              >
                {{ t.label }}
              </button>
            </div>

            <!-- 服務列表 -->
            <div class="space-y-1.5 max-h-[180px] overflow-y-auto no-scrollbar">
              <button
                v-for="s in filteredServices"
                :key="s.id"
                type="button"
                class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left"
                :class="selectedServices.has(s.id)
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-brand-700 border-brand-100'"
                @click="toggleService(s.id)"
              >
                <span class="font-bold text-xs">{{ s.name }}</span>
                <span class="font-extrabold text-xs">NT$ {{ s.price }}</span>
              </button>
              <p v-if="!filteredServices.length" class="text-center text-brand-400 text-[10px] py-2">無項目</p>
            </div>

            <!-- 已選摘要 -->
            <div v-if="selectedServices.size > 0" class="member-field mt-2">
              <div class="flex justify-between text-xs">
                <span class="text-brand-400">已選 {{ selectedServices.size }} 項</span>
                <span class="font-extrabold text-brand-600">NT$ {{ selectedTotal }}</span>
              </div>
            </div>
          </div>

          <!-- 按鈕 -->
          <div class="flex gap-2 mt-4">
            <button class="btn-outline flex-1" @click="showModal = false">取消</button>
            <button class="btn-primary flex-1" @click="save">儲存</button>
          </div>
        </div><!-- 滾動區域結束 -->
      </div>
    </div>

    <!-- Wallet Modal -->
    <div v-if="showWalletModal" class="fixed inset-0 z-30 flex items-center justify-center p-5" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[320px] max-h-[90vh] overflow-y-auto space-y-3 no-scrollbar" style="border-radius:32px;padding:28px;">
        <h3 class="font-bold text-lg">調整儲值金 — {{ walletTarget?.name }}</h3>
        <p class="text-sm text-brand-500">目前餘額：${{ walletTarget?.wallet ?? 0 }}</p>
        <div>
          <label class="label">變動金額（正：加值，負：扣款）</label>
          <input v-model.number="walletDelta" type="number" class="input" />
        </div>
        <div class="flex gap-2 pt-2">
          <button class="btn-outline flex-1" @click="showWalletModal = false">取消</button>
          <button class="btn-primary flex-1" @click="saveWallet">確認</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-field {
  background: #f5f3f1;
  border: none;
  border-radius: 14px;
  padding: 14px 16px;
  font-size: 14px;
  color: #4a423d;
  outline: none;
  position: relative;
}
.member-field::placeholder {
  color: #b0aba7;
}
.member-field:disabled {
  opacity: 0.5;
}
</style>
