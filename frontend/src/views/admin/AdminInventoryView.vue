<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { inventoryApi } from '@/api/inventory';
import type { InventoryItem, InventoryCat } from '@/api/types';

const items = ref<InventoryItem[]>([]);
const lowStock = ref<InventoryItem[]>([]);
const loading = ref(false);
const activeTab = ref<InventoryCat>('product');

const tabs: Array<{ value: InventoryCat; label: string }> = [
  { value: 'product', label: '產品' },
  { value: 'consumable', label: '耗材' },
];

const filteredItems = computed(() =>
  items.value.filter((i) => i.cat === activeTab.value)
);

const showModal = ref(false);
const editing = ref<InventoryItem | null>(null);
const form = ref({
  name: '',
  cat: 'product' as InventoryCat,
  qty: 0,
  unit: '個',
  minQty: 0,
});

async function load() {
  loading.value = true;
  try {
    const res = await inventoryApi.list();
    items.value = res.items;
    lowStock.value = res.lowStock;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
});

function openCreate() {
  editing.value = null;
  form.value = { name: '', cat: activeTab.value, qty: 0, unit: '個', minQty: 0 };
  showModal.value = true;
}

function openEdit(item: InventoryItem) {
  editing.value = item;
  form.value = { name: item.name, cat: item.cat, qty: item.qty, unit: item.unit, minQty: item.minQty };
  showModal.value = true;
}

async function save() {
  if (editing.value) {
    await inventoryApi.update(editing.value.id, {
      name: form.value.name,
      cat: form.value.cat,
      qty: Number(form.value.qty),
      unit: form.value.unit,
      minQty: Number(form.value.minQty),
    });
  } else {
    await inventoryApi.create({
      name: form.value.name,
      cat: form.value.cat,
      qty: Number(form.value.qty),
      unit: form.value.unit,
      minQty: Number(form.value.minQty),
    });
  }
  showModal.value = false;
  await load();
}

async function remove(item: InventoryItem) {
  if (!window.confirm(`刪除「${item.name}」？`)) return;
  await inventoryApi.remove(item.id);
  await load();
}

async function adjustQty(item: InventoryItem, delta: number) {
  await inventoryApi.update(item.id, { qty: item.qty + delta });
  await load();
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="lowStock.length" class="card bg-red-50 border-red-200">
      <div class="font-bold text-red-700 mb-1">⚠️ 不足警示</div>
      <div class="text-sm text-red-600">
        {{ lowStock.map((i) => i.name).join('、') }} 數量已達警戒線，請盡快補貨。
      </div>
    </div>

    <div class="flex justify-between items-center">
      <h2 class="font-bold">庫存管理</h2>
      <button class="btn-pill text-[10px]" @click="openCreate">+ 新增</button>
    </div>

    <!-- 產品 / 耗材 tabs -->
    <div class="flex gap-2">
      <button
        v-for="t in tabs"
        :key="t.value"
        type="button"
        class="flex-1 py-2.5 text-xs font-bold text-center rounded-xl border-[1.5px] transition-all"
        :class="activeTab === t.value
          ? 'bg-brand-600 text-white border-brand-600'
          : 'bg-white text-brand-500 border-brand-200'"
        @click="activeTab = t.value"
      >
        {{ t.label }}
      </button>
    </div>

    <p v-if="loading" class="text-center text-brand-400 py-6">載入中…</p>
    <ul v-else class="space-y-2">
      <li v-for="it in filteredItems" :key="it.id" class="card !py-2">
        <div class="flex justify-between items-center">
          <div>
            <div class="font-bold text-sm">{{ it.name }}</div>
            <div class="text-[10px] text-brand-500">警戒：{{ it.minQty }} {{ it.unit }}</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn-outline !px-2 !py-0.5 text-sm" @click="adjustQty(it, -1)">−</button>
            <div class="text-base font-bold w-8 text-center" :class="it.qty <= it.minQty ? 'text-red-600' : 'text-brand-700'">
              {{ it.qty }}
            </div>
            <button class="btn-outline !px-2 !py-0.5 text-sm" @click="adjustQty(it, 1)">+</button>
          </div>
        </div>
        <div class="flex gap-2 mt-1.5">
          <button class="btn-outline text-xs !py-0.5 flex-1" @click="openEdit(it)">編輯</button>
          <button class="btn-outline text-xs !py-0.5 flex-1 !text-red-600 !border-red-200" @click="remove(it)">刪除</button>
        </div>
      </li>
      <li v-if="!filteredItems.length" class="text-center text-brand-400 py-6">尚無{{ activeTab === 'product' ? '產品' : '耗材' }}品項</li>
    </ul>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-30 flex items-center justify-center p-5" style="background:rgba(0,0,0,0.5);">
      <div class="bg-white w-full max-w-[320px] max-h-[90dvh] overflow-y-auto space-y-3 no-scrollbar" style="border-radius:24px;padding:28px;">
        <h3 class="font-bold text-lg">{{ editing ? '編輯品項' : '新增品項' }}</h3>
        <!-- 分類 -->
        <div>
          <label class="label">分類</label>
          <div class="flex gap-2">
            <button
              v-for="t in tabs"
              :key="t.value"
              type="button"
              class="flex-1 py-2 text-xs font-bold text-center rounded-xl border-[1.5px] transition-all"
              :class="form.cat === t.value
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-brand-500 border-brand-200'"
              @click="form.cat = t.value"
            >
              {{ t.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="label">名稱</label>
          <input v-model="form.name" class="input" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="label">數量</label>
            <input v-model.number="form.qty" type="number" class="input" />
          </div>
          <div>
            <label class="label">單位</label>
            <input v-model="form.unit" class="input" />
          </div>
        </div>
        <div>
          <label class="label">警戒量</label>
          <input v-model.number="form.minQty" type="number" class="input" />
        </div>
        <div class="flex gap-2 pt-2">
          <button class="btn-outline flex-1" @click="showModal = false">取消</button>
          <button class="btn-primary flex-1" @click="save">儲存</button>
        </div>
      </div>
    </div>
  </div>
</template>
