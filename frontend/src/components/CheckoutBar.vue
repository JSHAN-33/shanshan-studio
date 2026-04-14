<script setup lang="ts">
defineProps<{
  count: number;
  total: number;
  oldTotal?: number;
  ctaLabel?: string;
  disabled?: boolean;
}>();
defineEmits<{
  (e: 'proceed'): void;
}>();
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="count > 0"
      class="fixed left-1/2 -translate-x-1/2 z-50"
      style="bottom: 85px; width: 92%; max-width: 340px;"
    >
      <div
        class="flex justify-between items-center shadow-2xl"
        style="background: rgba(101,91,85,0.95); backdrop-filter: blur(12px); padding: 14px 20px; border-radius: 28px; color: white;"
      >
        <div class="flex flex-col">
          <p class="text-[8px] tracking-[0.15em] opacity-50 font-bold uppercase mb-0.5">Booking Selection</p>
          <div class="flex items-center gap-3">
            <div class="flex items-baseline gap-1">
              <span class="text-xl font-bold leading-none">{{ count }}</span>
              <span class="text-[10px] font-bold tracking-widest">項目</span>
            </div>
            <div class="w-[1px] h-6 bg-white/20 self-center" />
            <div class="flex flex-col">
              <span class="text-base font-bold leading-none tracking-tight">NT$ {{ total }}</span>
              <span v-if="oldTotal" class="text-[9px] opacity-40 line-through mt-0.5">NT$ {{ oldTotal }}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="bg-white text-brand-600 px-5 py-2.5 rounded-full font-bold flex items-center gap-2 shadow-xl active:scale-95 transition"
          :disabled="disabled"
          @click="$emit('proceed')"
        >
          <span class="text-[13px] leading-tight tracking-widest">{{ ctaLabel ?? '下一步' }}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
