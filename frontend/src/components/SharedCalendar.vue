<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  modelValue: string | null;
  minDate?: string;
  markedDates?: string[];
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'month-change', month: string): void;
}>();

const today = new Date();
const todayStr = today.toISOString().slice(0, 10);
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth());

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

const yearOptions = computed(() => {
  const current = today.getFullYear();
  const years: number[] = [];
  for (let y = 1950; y <= current + 5; y++) years.push(y);
  return years;
});

const daysInMonth = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1);
  const startDay = first.getDay();
  const total = new Date(viewYear.value, viewMonth.value + 1, 0).getDate();
  const cells: Array<{ day: number; date: string } | null> = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= total; d++) {
    const date = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date });
  }
  return cells;
});

const minDateStr = computed(() => props.minDate ?? '');

function isDisabled(date: string) {
  if (!minDateStr.value) return false;
  return date < minDateStr.value;
}

function isToday(date: string) { return date === todayStr; }
function isMarked(date: string) { return props.markedDates?.includes(date) ?? false; }

function prev() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value -= 1; }
  else viewMonth.value -= 1;
}
function next() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value += 1; }
  else viewMonth.value += 1;
}

watch([viewYear, viewMonth], () => {
  const m = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}`;
  emit('month-change', m);
}, { immediate: true });

function select(date: string) {
  if (isDisabled(date)) return;
  emit('update:modelValue', date);
}
</script>

<template>
  <div class="cal-container">
    <!-- Nav -->
    <div class="cal-nav">
      <button type="button" class="cal-arrow" @click="prev">&lt;</button>
      <div class="cal-title">
        <select v-model="viewYear" class="cal-select cal-select-year">
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
        </select>
        <span class="cal-dot">·</span>
        <select v-model="viewMonth" class="cal-select cal-select-month">
          <option v-for="m in 12" :key="m" :value="m - 1">{{ m }}月</option>
        </select>
        <span class="cal-dot">·</span>
      </div>
      <button type="button" class="cal-arrow" @click="next">&gt;</button>
    </div>

    <!-- Weekday header -->
    <div class="cal-weekdays">
      <span v-for="w in weekdays" :key="w">{{ w }}</span>
    </div>

    <!-- Day grid -->
    <div class="cal-grid">
      <div v-for="(cell, i) in daysInMonth" :key="i" class="cal-cell">
        <button
          v-if="cell"
          type="button"
          :disabled="isDisabled(cell.date)"
          class="cal-day"
          :class="{
            'cal-day--selected': modelValue === cell.date,
            'cal-day--disabled': isDisabled(cell.date),
            'cal-day--today': isToday(cell.date),
          }"
          @click="select(cell.date)"
        >
          {{ cell.day }}
          <span v-if="isMarked(cell.date)" class="cal-dot-mark"
            :class="modelValue === cell.date ? 'bg-white' : 'bg-amber-500'" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal-container {
  background: #fff;
  border-radius: 20px;
  border: 1px solid #f0efed;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  padding: 22px 18px 18px;
}

.cal-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.cal-arrow {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 300;
  color: #b0aba7;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 50%;
  transition: color 0.15s;
}
.cal-arrow:hover { color: #655b55; }
.cal-arrow:active { color: #4a423d; }

.cal-title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cal-dot {
  color: #ccc;
  font-size: 14px;
  font-weight: 400;
  user-select: none;
}

.cal-select {
  background: none;
  border: none;
  font-size: 15px;
  font-weight: 700;
  color: #4a423d;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  padding: 0;
  text-align: center;
}
.cal-select-year { width: 62px; }
.cal-select-month { width: 38px; }

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 6px;
}
.cal-weekdays span {
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: #b0aba7;
  padding-bottom: 8px;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 4px;
}

.cal-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 42px;
}

.cal-day {
  position: relative;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 15px;
  font-weight: 400;
  color: #4a423d;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}
.cal-day:hover { background: #f5f3f1; }
.cal-day:active { background: #ebe8e5; }

.cal-day--selected {
  background: #655b55 !important;
  color: #fff !important;
  font-weight: 600;
}

.cal-day--disabled {
  color: #ddd;
  pointer-events: none;
}

.cal-day--today {
  font-weight: 800;
}

.cal-dot-mark {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
}
</style>
