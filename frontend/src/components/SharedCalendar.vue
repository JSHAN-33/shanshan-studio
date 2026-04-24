<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';

const props = defineProps<{
  modelValue: string | null;
  minDate?: string;
  markedDates?: string[];
  grayedDates?: string[];
  grayedDisabled?: boolean;
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

// Custom dropdowns
const showYearPicker = ref(false);
const showMonthPicker = ref(false);

const yearOptions = computed(() => {
  const current = today.getFullYear();
  const years: number[] = [];
  for (let y = current - 80; y <= current + 30; y++) years.push(y);
  return years;
});

function selectYear(y: number) {
  viewYear.value = y;
  showYearPicker.value = false;
}

function selectMonth(m: number) {
  viewMonth.value = m;
  showMonthPicker.value = false;
}

function toggleYearPicker() {
  showMonthPicker.value = false;
  showYearPicker.value = !showYearPicker.value;
  if (showYearPicker.value) {
    nextTick(() => {
      const el = document.querySelector('.year-picker .year-active');
      el?.scrollIntoView({ block: 'center' });
    });
  }
}

function toggleMonthPicker() {
  showYearPicker.value = false;
  showMonthPicker.value = !showMonthPicker.value;
}

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
  if (minDateStr.value && date < minDateStr.value) return true;
  if (props.grayedDisabled && (props.grayedDates?.includes(date) ?? false)) return true;
  return false;
}

function isToday(date: string) { return date === todayStr; }
function isMarked(date: string) { return props.markedDates?.includes(date) ?? false; }
function isGrayed(date: string) { return props.grayedDates?.includes(date) ?? false; }

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
        <!-- Year picker -->
        <div class="cal-picker-wrap">
          <button type="button" class="cal-picker-btn" @click="toggleYearPicker">
            {{ viewYear }} 年
            <svg class="cal-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div v-if="showYearPicker" class="cal-dropdown year-picker">
            <button
              v-for="y in yearOptions"
              :key="y"
              type="button"
              class="cal-dropdown-item"
              :class="{ 'cal-dropdown-active year-active': y === viewYear }"
              @click="selectYear(y)"
            >
              {{ y }} 年
            </button>
          </div>
        </div>

        <span class="cal-dot">·</span>

        <!-- Month picker -->
        <div class="cal-picker-wrap">
          <button type="button" class="cal-picker-btn" @click="toggleMonthPicker">
            {{ viewMonth + 1 }}月
            <svg class="cal-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div v-if="showMonthPicker" class="cal-dropdown">
            <button
              v-for="m in 12"
              :key="m"
              type="button"
              class="cal-dropdown-item"
              :class="{ 'cal-dropdown-active': m - 1 === viewMonth }"
              @click="selectMonth(m - 1)"
            >
              {{ m }}月
            </button>
          </div>
        </div>
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
            'cal-day--grayed': isGrayed(cell.date) && modelValue !== cell.date,
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
  position: relative;
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

/* Custom picker */
.cal-picker-wrap {
  position: relative;
}

.cal-picker-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  font-size: 15px;
  font-weight: 700;
  color: #4a423d;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 10px;
  transition: background 0.15s;
}
.cal-picker-btn:hover {
  background: #f5f3f1;
}

.cal-chevron {
  color: #b0aba7;
}

.cal-dropdown {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 6px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  border: 1px solid #f0efed;
  padding: 6px;
  z-index: 50;
  max-height: 240px;
  overflow-y: auto;
  min-width: 100px;
}
.cal-dropdown::-webkit-scrollbar { display: none; }
.cal-dropdown { -ms-overflow-style: none; scrollbar-width: none; }

.cal-dropdown-item {
  display: block;
  width: 100%;
  text-align: center;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #4a423d;
  border: none;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.cal-dropdown-item:hover {
  background: #f5f3f1;
}
.cal-dropdown-active {
  font-weight: 700;
  color: #655b55;
  background: #f5f3f1;
}

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

.cal-day--grayed {
  color: #d4d0cd;
}
.cal-day--grayed:hover { background: #f5f3f1; }

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
