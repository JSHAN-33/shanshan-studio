<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { financeApi } from '@/api/finance';
import { costsApi } from '@/api/costs';
import type { Cost, FinanceSummary } from '@/api/types';

const summary = ref<FinanceSummary | null>(null);
const costs = ref<Cost[]>([]);
const loading = ref(false);

const showModal = ref(false);
const form = ref({
  cat: '耗材' as Cost['cat'],
  desc: '',
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
});

const cats: Cost['cat'][] = ['耗材', '店租', '水電', '行銷', '薪資', '其他'];

// 按月份分組
const grouped = computed(() => {
  const map = new Map<string, Cost[]>();
  for (const c of costs.value) {
    const m = c.date.slice(0, 7);
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(c);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
});

const expanded = ref<Set<string>>(new Set());
function toggle(month: string) {
  if (expanded.value.has(month)) expanded.value.delete(month);
  else expanded.value.add(month);
}

async function load() {
  loading.value = true;
  try {
    const [sum, list] = await Promise.all([financeApi.summary(), costsApi.list()]);
    summary.value = sum;
    costs.value = list;
    const curr = new Date().toISOString().slice(0, 7);
    expanded.value.add(curr);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function save() {
  await costsApi.create({
    cat: form.value.cat,
    desc: form.value.desc || undefined,
    amount: Number(form.value.amount),
    date: form.value.date,
  });
  showModal.value = false;
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

function sumOfMonth(list: Cost[]) {
  return list.reduce((s, c) => s + c.amount, 0);
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-3">
      <div class="card">
        <p class="section-label mb-1.5">今日營收</p>
        <p class="text-base font-extrabold text-brand-600 leading-none tracking-tight">NT$ {{ summary?.today.revenue ?? 0 }}</p>
      </div>
      <div class="card">
        <p class="section-label mb-1.5">今日淨利</p>
        <p class="text-base font-extrabold leading-none tracking-tight" :class="(summary?.today.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'">
          NT$ {{ summary?.today.net ?? 0 }}
        </p>
      </div>
      <div class="card">
        <p class="section-label mb-1.5">本月營收</p>
        <p class="text-base font-extrabold text-brand-600 leading-none tracking-tight">NT$ {{ summary?.month.revenue ?? 0 }}</p>
      </div>
      <div class="card">
        <p class="section-label mb-1.5">本月淨利</p>
        <p class="text-base font-extrabold leading-none tracking-tight" :class="(summary?.month.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'">
          NT$ {{ summary?.month.net ?? 0 }}
        </p>
      </div>
    </div>

    <section>
      <div class="flex items-center justify-between mb-2">
        <h2 class="font-bold">成本記帳本</h2>
        <button class="btn-pill text-[10px]" @click="showModal = true">+ 新增</button>
      </div>

      <p v-if="loading" class="text-center text-brand-400 py-6">載入中…</p>
      <div v-else class="space-y-3">
        <div v-for="[m, list] in grouped" :key="m" class="card">
          <button type="button" class="w-full flex justify-between items-center" @click="toggle(m)">
            <div class="font-bold">{{ m }}</div>
            <div class="text-brand-600 font-bold">${{ sumOfMonth(list) }}</div>
          </button>
          <ul v-if="expanded.has(m)" class="mt-3 space-y-2 border-t border-brand-100 pt-3">
            <li v-for="c in list" :key="c.id" class="flex justify-between items-start">
              <div>
                <div class="text-sm"><span class="badge bg-brand-100 text-brand-600 mr-1">{{ c.cat }}</span>{{ c.desc || '—' }}</div>
                <div class="text-xs text-brand-400">{{ c.date }}</div>
              </div>
              <div class="flex items-center gap-2">
                <div class="font-bold text-brand-700">${{ c.amount }}</div>
                <button class="text-xs text-red-500" @click="remove(c)">刪</button>
              </div>
            </li>
          </ul>
        </div>
        <p v-if="!grouped.length" class="text-center text-brand-400 py-6">尚無成本記錄</p>
      </div>
    </section>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-30 flex items-center justify-center p-5" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[320px] max-h-[90vh] overflow-y-auto space-y-3 no-scrollbar" style="border-radius:32px;padding:28px;">
        <h3 class="font-bold text-lg">新增成本</h3>
        <div>
          <label class="label">分類</label>
          <select v-model="form.cat" class="input">
            <option v-for="c in cats" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div>
          <label class="label">說明</label>
          <input v-model="form.desc" class="input" placeholder="例如：除毛膏 x2" />
        </div>
        <div>
          <label class="label">金額</label>
          <input v-model.number="form.amount" type="number" class="input" />
        </div>
        <div>
          <label class="label">日期</label>
          <input v-model="form.date" type="date" class="input" />
        </div>
        <div class="flex gap-2 pt-2">
          <button class="btn-outline flex-1" @click="showModal = false">取消</button>
          <button class="btn-primary flex-1" @click="save">儲存</button>
        </div>
      </div>
    </div>
  </div>
</template>
