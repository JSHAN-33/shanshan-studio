<script setup lang="ts">
import { useToast } from '@/composables/useToast';

const { toasts } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none" style="max-width: 90vw;">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="px-4 py-2.5 rounded-2xl shadow-lg text-xs font-bold pointer-events-auto"
          :class="{
            'bg-brand-700 text-white': t.type === 'success',
            'bg-red-600 text-white': t.type === 'error',
            'bg-brand-100 text-brand-700': t.type === 'info',
          }"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active { animation: toast-in 0.25s ease-out; }
.toast-leave-active { animation: toast-out 0.2s ease-in forwards; }
@keyframes toast-in {
  from { opacity: 0; transform: translateY(-12px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes toast-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(-8px) scale(0.95); }
}
</style>
