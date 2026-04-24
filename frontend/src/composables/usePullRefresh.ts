import { ref, onMounted, onUnmounted } from 'vue';

export function usePullRefresh(onRefresh: () => Promise<void>, containerSelector = 'main') {
  const refreshing = ref(false);
  let startY = 0;
  let pulling = false;

  function onTouchStart(e: TouchEvent) {
    const el = document.querySelector(containerSelector);
    if (!el || el.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!pulling) return;
  }

  async function onTouchEnd(e: TouchEvent) {
    if (!pulling) return;
    pulling = false;
    const endY = e.changedTouches[0].clientY;
    const diff = endY - startY;
    if (diff > 80 && !refreshing.value) {
      refreshing.value = true;
      try {
        await onRefresh();
      } finally {
        refreshing.value = false;
      }
    }
  }

  onMounted(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
  });

  onUnmounted(() => {
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  });

  return { refreshing };
}
