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

const combos = computed(() => services.value.filter((s) => s.cat === tab.value && s.isCombo));

// 「熱蠟後必敷」等 note 拉出來當區塊標題
const sectionTitleNotes = new Set(['熱蠟後必敷']);
const singles = computed(() => services.value.filter((s) => s.cat === tab.value && !s.isCombo && !sectionTitleNotes.has(s.note ?? '')));
const sectionGroups = computed(() => {
  const map = new Map<string, Service[]>();
  for (const s of services.value.filter((s) => s.cat === tab.value && !s.isCombo && sectionTitleNotes.has(s.note ?? ''))) {
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
  <section class="min-h-screen pb-40">
    <!-- Header -->
    <header class="bg-white px-5 py-4 sticky top-0 z-50 flex justify-between items-center" style="border-bottom: 1px solid #f5f4f2;">
      <div>
        <h1 class="text-base font-bold tracking-tight text-brand-700">SHANSHAN.STUDIO</h1>
        <p class="text-[8px] tracking-[0.2em] text-brand-300 uppercase font-bold">HOTWAXING</p>
      </div>
    </header>

    <main class="px-4 pt-4">
      <!-- Category tabs -->
      <div class="flex gap-4 mb-6 px-1" style="border-bottom: 1px solid #f0f0f0;">
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
