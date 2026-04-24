<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ServiceCard from '@/components/ServiceCard.vue';
import CheckoutBar from '@/components/CheckoutBar.vue';
import { servicesApi } from '@/api/services';
import { membersApi } from '@/api/members';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import type { Service, ServiceCat } from '@/api/types';

const auth = useAuthStore();
const booking = useBookingStore();
const router = useRouter();

const services = ref<Service[]>([]);
const loading = ref(true);
const isFirstTime = ref(false);
const tab = ref<ServiceCat>('women');

const tabs: Array<{ value: ServiceCat; label: string }> = [
  { value: 'women', label: '女生除毛' },
  { value: 'men', label: '男士除毛' },
  { value: 'eyelash', label: '睫毛管理' },
  { value: 'products', label: '產品購買' },
];

const searchQuery = ref('');

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  let list = services.value.filter((s) => s.cat === tab.value);
  if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || (s.nameEn ?? '').toLowerCase().includes(q));
  return list;
});

const combos = computed(() => filtered.value.filter((s) => s.isCombo));

// 「熱蠟後必敷」等 note 拉出來當區塊標題
const sectionTitleNotes = new Set(['熱蠟後必敷']);
const singles = computed(() => filtered.value.filter((s) => !s.isCombo && !sectionTitleNotes.has(s.note ?? '')));
const sectionGroups = computed(() => {
  const map = new Map<string, Service[]>();
  for (const s of filtered.value.filter((s) => !s.isCombo && sectionTitleNotes.has(s.note ?? ''))) {
    if (!map.has(s.note!)) map.set(s.note!, []);
    map.get(s.note!)!.push(s);
  }
  return Array.from(map.entries());
});

onMounted(async () => {
  if (!auth.customer?.phone) { router.replace('/login'); return; }
  const [list, member] = await Promise.all([
    servicesApi.list(),
    membersApi.getByPhone(auth.customer.phone),
  ]);
  services.value = list;
  isFirstTime.value = !member || (member.bookingCount ?? 0) === 0;
  booking.isFirstTime = isFirstTime.value;
  loading.value = false;
});

function proceed() {
  if (booking.count === 0) return;
  router.push('/booking');
}
</script>

<template>
  <section class="h-dvh flex flex-col">
    <!-- Header (固定頂部) -->
    <header class="bg-white px-5 py-4 shrink-0 flex justify-between items-center" style="border-bottom: 1px solid #f5f4f2;">
      <div>
        <h1 class="text-base font-bold tracking-tight text-brand-700">SHANSHAN.STUDIO</h1>
        <p class="text-[8px] tracking-[0.2em] text-brand-300 uppercase font-bold">HOTWAXING</p>
      </div>
    </header>

    <!-- Category tabs (固定在 header 下方) -->
    <div class="flex gap-4 px-5 pt-4 shrink-0" style="border-bottom: 1px solid #f0f0f0;">
      <button
        v-for="t in tabs"
        :key="t.value"
        type="button"
        class="text-xs font-bold pb-2 transition-colors"
        :class="tab === t.value ? 'text-brand-600 border-b-2 border-brand-600' : 'text-brand-300'"
        @click="tab = t.value"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- 搜尋框 -->
    <div class="px-4 pt-3 pb-1 shrink-0">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          v-model="searchQuery"
          type="text"
          class="w-full bg-brand-50 text-xs text-brand-600 placeholder:text-brand-300 rounded-full py-2.5 pl-9 pr-4 border-none outline-none focus:ring-2 focus:ring-brand-200 transition"
          placeholder="搜尋服務項目..."
        />
      </div>
    </div>

    <!-- 可滾動的內容區域 -->
    <main class="flex-1 overflow-y-auto px-4 pt-4 pb-48">
      <!-- Skeleton Loading -->
      <div v-if="loading" class="flex flex-col gap-3">
        <div v-for="i in 4" :key="i" class="card animate-pulse">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="h-3 bg-brand-100 rounded-full w-24 mb-2"></div>
              <div class="h-2.5 bg-brand-100 rounded-full w-16 mb-1"></div>
              <div class="h-2 bg-brand-50 rounded-full w-32 mt-2"></div>
            </div>
            <div class="h-4 bg-brand-100 rounded-full w-16"></div>
          </div>
        </div>
      </div>
      <div v-else class="flex flex-col gap-3">
        <!-- 優惠組合 -->
        <template v-if="combos.length">
          <p class="text-[10px] tracking-[0.15em] font-bold text-brand-400 uppercase mt-2">✨ Hot Combos / 優惠組合</p>
          <ServiceCard
            v-for="s in combos"
            :key="s.id"
            :service="s"
            :selected="booking.has(s.id)"
            @toggle="booking.toggle"
          />
        </template>

        <!-- 單次服務 -->
        <p v-if="singles.length" class="text-[10px] tracking-[0.15em] font-bold text-brand-400 uppercase mt-4">Single Services / 單次服務</p>
        <ServiceCard
          v-for="s in singles"
          :key="s.id"
          :service="s"
          :selected="booking.has(s.id)"
          @toggle="booking.toggle"
        />

        <!-- 區塊標題服務（如「熱蠟後必敷」） -->
        <template v-for="[title, svcs] in sectionGroups" :key="title">
          <p class="text-[10px] tracking-[0.15em] font-bold text-brand-400 uppercase mt-4">Post-Waxing Care / {{ title }}</p>
          <ServiceCard
            v-for="s in svcs"
            :key="s.id"
            :service="s"
            :selected="booking.has(s.id)"
            hide-note
            @toggle="booking.toggle"
          />
        </template>

        <p v-if="!combos.length && !singles.length && !sectionGroups.length" class="text-center text-brand-400 py-10 text-xs">本分類尚無服務項目</p>
      </div>
    </main>

    <CheckoutBar :count="booking.count" :total="booking.total" @proceed="proceed" />
  </section>
</template>
