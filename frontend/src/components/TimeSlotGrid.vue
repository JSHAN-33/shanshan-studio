<script setup lang="ts">
import type { AvailableSlot } from '@/api/types';

defineProps<{
  slots: AvailableSlot[];
  selected: string | null;
}>();

defineEmits<{
  (e: 'select', time: string): void;
}>();
</script>

<template>
  <div v-if="slots.length" class="grid grid-cols-4 gap-2">
    <button
      v-for="s in slots"
      :key="s.time"
      type="button"
      :disabled="!s.available"
      class="font-bold text-xs text-center transition-all font-sans"
      :class="{
        'bg-brand-600 text-white border-brand-600': selected === s.time,
        'bg-white text-brand-600 border-brand-200 hover:border-brand-400':
          s.available && selected !== s.time,
        'bg-brand-50 text-brand-300 border-brand-100 cursor-not-allowed line-through':
          !s.available,
      }"
      style="padding: 9px 0; border-radius: 12px; border-width: 1.5px;"
      @click="s.available && $emit('select', s.time)"
    >
      {{ s.time }}
    </button>
  </div>
  <p v-else class="text-[11px] text-brand-400 text-center py-3">請先選擇日期</p>
</template>
