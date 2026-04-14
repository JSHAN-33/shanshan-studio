<script setup lang="ts">
import type { Service } from '@/api/types';

defineProps<{
  service: Service;
  selected: boolean;
}>();

defineEmits<{
  (e: 'toggle', service: Service): void;
}>();
</script>

<template>
  <button
    type="button"
    class="w-full text-left transition-all duration-300"
    :class="selected
      ? 'bg-brand-600 border-brand-600 text-white shadow-lg'
      : 'bg-white border-brand-100 hover:border-brand-200'"
    style="border-radius: 20px; padding: 14px 16px; border-width: 1px; cursor: pointer;"
    @click="$emit('toggle', service)"
  >
    <div class="flex justify-between items-start gap-3">
      <div class="min-w-0">
        <h3 class="font-bold text-sm truncate" :class="selected ? 'text-white' : 'text-brand-700'">
          {{ service.name }}
        </h3>
        <p v-if="service.nameEn" class="text-[10px] truncate mt-0.5"
          :class="selected ? 'text-white/60' : 'text-brand-300'">
          {{ service.nameEn }}
        </p>
        <p v-if="service.duration" class="text-[10px] mt-1"
          :class="selected ? 'text-white/50' : 'text-brand-400'">
          約 {{ service.duration }} 分鐘
        </p>
        <p v-if="service.note" class="text-[10px] mt-0.5"
          :class="selected ? 'text-white/50' : 'text-brand-400'">
          {{ service.note }}
        </p>
      </div>
      <div class="text-right shrink-0">
        <div v-if="service.oldPrice" class="text-[10px] line-through"
          :class="selected ? 'text-white/40' : 'text-brand-300'">
          NT$ {{ service.oldPrice }}
        </div>
        <div class="font-extrabold text-base" :class="selected ? 'text-white' : 'text-brand-600'">
          NT$ {{ service.price }}
        </div>
        <div v-if="service.oldPrice || service.isCombo"
          class="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
          :class="selected ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'">
          OFFER
        </div>
      </div>
    </div>
  </button>
</template>
