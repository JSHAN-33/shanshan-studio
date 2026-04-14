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
const singles = computed(() => services.value.filter((s) => s.cat === tab.value && !s.isCombo));

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

      <p v-if="loading" class="text-center text-brand-400 py-10 text-xs">載入中…</p>
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

        <p v-if="!combos.length && !singles.length" class="text-center text-brand-400 py-10 text-xs">本分類尚無服務項目</p>
      </div>
    </main>

    <CheckoutBar :count="booking.count" :total="booking.total" @proceed="proceed" />
  </section>
</template>
