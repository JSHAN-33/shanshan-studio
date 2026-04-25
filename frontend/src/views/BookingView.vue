<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import SharedCalendar from '@/components/SharedCalendar.vue';
import TimeSlotGrid from '@/components/TimeSlotGrid.vue';
import { bookingsApi } from '@/api/bookings';
import { settingsApi } from '@/api/settings';
import { useBookingStore } from '@/stores/booking';
import { useAuthStore } from '@/stores/auth';
import type { AvailableSlot, Booking } from '@/api/types';
import liff from '@line/liff';
import { buildNewBookingFlex, sendFlexToChat } from '@/composables/liffMessages';

const booking = useBookingStore();
const auth = useAuthStore();
const router = useRouter();

const selectedDate = ref<string | null>(booking.date);
const selectedTime = ref<string | null>(booking.time);
const slots = ref<AvailableSlot[]>([]);
const loadingSlots = ref(false);
const submitting = ref(false);
const error = ref('');
const submitted = ref(false);
const agreedNotice = ref(false);
const showNotice = ref(false);
const createdBooking = ref<Booking | null>(null);
const depositBankInfo = ref('');

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const today = todayStr();

// 整日無空檔（皆已被預約 / 被關閉 / 已過時）的日期 — 在日曆上反灰不可選
const fullyUnavailableDates = ref<string[]>([]);
const viewMonth = ref(today.slice(0, 7));

async function loadMonthAvailability(month: string) {
  viewMonth.value = month;
  const [yStr, mStr] = month.split('-');
  const y = Number(yStr);
  const mon = Number(mStr);
  const lastDay = new Date(y, mon, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const startDate = `${y}-${pad(mon)}-01`;
  const endDate = `${y}-${pad(mon)}-${pad(lastDay)}`;
  try {
    const slotsByDate = await bookingsApi.bulkAvailableSlots(
      startDate,
      endDate,
      booking.totalDuration || undefined
    );
    const result: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const date = `${y}-${pad(mon)}-${pad(d)}`;
      if (date < today) continue; // 過去日期已由 min-date 反灰
      if ((slotsByDate[date] ?? []).length === 0) result.push(date);
    }
    fullyUnavailableDates.value = result;
  } catch (err) {
    console.error(err);
  }
}

loadMonthAvailability(viewMonth.value);

watch(selectedDate, async (d) => {
  selectedTime.value = null;
  if (!d) return;
  loadingSlots.value = true;
  try {
    slots.value = await bookingsApi.availableSlots(d, booking.totalDuration || undefined);
  } catch (err) { console.error(err); }
  finally { loadingSlots.value = false; }
});

watch(selectedTime, (t) => {
  if (t && !agreedNotice.value) showNotice.value = true;
});

const canSubmit = computed(() => !!selectedDate.value && !!selectedTime.value && booking.count > 0 && agreedNotice.value);

async function submit() {
  if (!canSubmit.value || !auth.customer) return;
  error.value = '';
  submitting.value = true;
  try {
    const result = await bookingsApi.create({
      name: auth.customer.name,
      phone: auth.customer.phone,
      bday: auth.customer.bday ?? null,
      lineUserId: auth.profile?.userId ?? null,
      date: selectedDate.value!,
      time: selectedTime.value!,
      duration: booking.totalDuration || null,
      items: booking.itemsLabel,
      total: booking.total,
      remarks: booking.remarks || null,
      inLiff: liff.isInClient(),
    });
    createdBooking.value = result;
    // 透過 liff.sendMessages 把通知卡片發到 OA 聊天室（顯示在左邊，客人發的）
    sendFlexToChat(buildNewBookingFlex({
      name: auth.customer.name,
      phone: auth.customer.phone,
      date: selectedDate.value!,
      time: selectedTime.value!,
      items: booking.itemsLabel,
      total: booking.total,
    }));
    // 若需付預約金，取得銀行資訊
    if (result.depositStatus === '待付訂金') {
      try {
        const dep = await settingsApi.getDeposit();
        depositBankInfo.value = dep.bankInfo;
      } catch { /* ignore */ }
    }
    submitted.value = true;
  } catch (err) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
    error.value = msg ?? '送出失敗，請稍後再試';
  } finally { submitting.value = false; }
}

function goHome() {
  booking.reset();
  router.push('/services');
}

function goHistory() {
  booking.reset();
  router.push('/history');
}
</script>

<template>
  <section class="h-dvh flex flex-col bg-white">
    <!-- Header (固定頂部) -->
    <header class="px-5 py-4 shrink-0 flex justify-between items-center" style="border-bottom: 1px solid #f5f4f2;">
      <div>
        <h1 class="text-base font-bold tracking-tight text-brand-700">SHANSHAN.STUDIO</h1>
        <p class="text-[8px] tracking-[0.2em] text-brand-300 uppercase font-bold">HOTWAXING</p>
      </div>
    </header>

    <!-- 可滾動的內容區域 -->
    <div class="flex-1 overflow-y-auto p-6 pb-24">
    <!-- 預約成功確認頁 -->
    <div v-if="submitted" class="max-w-[300px] mx-auto text-center pt-4">
      <div class="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#655b55" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <h2 class="text-lg font-extrabold text-brand-700 mb-2">
        {{ createdBooking?.depositStatus === '待付訂金' ? '預約已送出' : '預約成功！' }}
      </h2>
      <p class="text-xs text-brand-400 mb-6">
        {{ createdBooking?.depositStatus === '待付訂金' ? '請先完成預約金轉帳，確認後即完成預約' : '我們已收到您的預約，將盡快為您確認' }}
      </p>

      <!-- 確認單 -->
      <div class="text-left p-5 mb-4" style="background: #f8f7f5; border-radius: 16px;">
        <p class="text-[10px] font-bold text-brand-400 tracking-wider uppercase mb-3">Booking Confirmation</p>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-brand-400">姓名</span>
            <span class="font-bold text-brand-700">{{ auth.customer?.name }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-brand-400">電話</span>
            <span class="font-bold text-brand-700">{{ auth.customer?.phone }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-brand-400">日期</span>
            <span class="font-bold text-brand-700">{{ selectedDate }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-brand-400">時段</span>
            <span class="font-bold text-brand-700">{{ selectedTime }}</span>
          </div>
          <div class="flex justify-between items-start">
            <span class="text-brand-400 shrink-0">項目</span>
            <span class="font-bold text-brand-700 text-right ml-3">{{ booking.itemsLabel }}</span>
          </div>
          <div v-if="booking.totalDuration" class="flex justify-between">
            <span class="text-brand-400">預估時長</span>
            <span class="font-bold text-brand-700">約 {{ booking.totalDuration }} 分鐘</span>
          </div>
          <div v-if="booking.discount > 0" class="flex justify-between text-amber-600">
            <span>新客折價</span>
            <span class="font-bold">-NT$ {{ booking.discount }}</span>
          </div>
          <div class="border-t border-brand-100 pt-2 mt-2 flex justify-between">
            <span class="font-bold text-brand-600">合計</span>
            <span class="font-extrabold text-brand-700 text-base">NT$ {{ booking.total }}</span>
          </div>
        </div>
      </div>

      <!-- 預約金付款提示 -->
      <div v-if="createdBooking?.depositStatus === '待付訂金'" class="text-left mb-4 overflow-hidden" style="border-radius: 20px; border: 1.5px solid #e8dfd4;">
        <!-- 醒目標頭 -->
        <div style="background: #3b3530; padding: 14px 18px;" class="flex items-center gap-3">
          <span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style="background: rgba(200,169,110,0.2);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a96e" stroke-width="2.2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </span>
          <div>
            <p style="font-size:10px;font-weight:800;letter-spacing:0.16em;color:rgba(255,255,255,0.4);margin:0;text-transform:uppercase;">Deposit Required</p>
            <p style="font-size:18px;font-weight:900;color:#c8a96e;margin:2px 0 0;">NT$ {{ createdBooking.depositAmount }}</p>
          </div>
        </div>
        <!-- 內容 -->
        <div style="background: #faf8f5; padding: 16px 18px;">
          <p class="text-sm font-bold text-brand-700 mb-3 leading-relaxed">
            請於 <span style="color:#8b6914;font-weight:900;">24 小時內</span> 完成預約金轉帳
          </p>
          <div v-if="depositBankInfo" class="p-3 mb-3" style="background: white; border-radius: 12px; border: 1px solid #ede9e5;">
            <p style="font-size:9px;font-weight:700;letter-spacing:0.14em;color:#b0aba7;margin:0 0 6px;text-transform:uppercase;">匯款資訊</p>
            <p class="text-xs text-brand-600 leading-relaxed whitespace-pre-line font-bold">{{ depositBankInfo }}</p>
          </div>
          <div class="space-y-1.5">
            <p class="text-[11px] text-brand-500 leading-relaxed flex items-start gap-2">
              <span class="shrink-0 mt-0.5" style="color:#c8a96e;">●</span>
              轉帳完成後請截圖傳至 LINE 告知小編
            </p>
            <p class="text-[11px] text-brand-500 leading-relaxed flex items-start gap-2">
              <span class="shrink-0 mt-0.5" style="color:#c8a96e;">●</span>
              確認收款後將為您正式登記預約
            </p>
            <p class="text-[11px] text-brand-400 leading-relaxed flex items-start gap-2">
              <span class="shrink-0 mt-0.5" style="color:#d5d0cc;">●</span>
              逾時未付款，預約將自動取消
            </p>
            <p class="text-[11px] text-brand-400 leading-relaxed flex items-start gap-2">
              <span class="shrink-0 mt-0.5" style="color:#d5d0cc;">●</span>
              臨時取消或未到場者，預約金恕不退還
            </p>
            <p class="text-[11px] text-brand-500 leading-relaxed flex items-start gap-2 mt-1">
              <span class="shrink-0 mt-0.5" style="color:#c8a96e;">★</span>
              <strong>預約金只需付一次</strong>，回訪客人免付預約金
            </p>
          </div>
        </div>
      </div>

      <p v-if="booking.hasCombo" class="text-[10px] text-amber-600 font-bold mb-2 text-center">
        ※ 套餐活動皆不適用任何優惠活動
      </p>
      <p class="text-[11px] text-brand-400 mb-4 leading-relaxed">
        如需異動預約，請透過 LINE 私訊小編人工處理
      </p>

      <!-- LINE 通知綁定提示 -->
      <div class="line-bind-card mb-3">
        <div class="flex items-center gap-2.5 mb-2.5">
          <span class="line-bind-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 5.81 2 10.5c0 2.65 1.33 5.02 3.42 6.58-.12.44-.64 2.32-.67 2.47 0 0-.01.08.04.11.05.03.11.01.11.01.15-.02 1.76-1.15 2.5-1.7.85.25 1.76.38 2.6.38 5.52 0 10-3.81 10-8.5S17.52 2 12 2z" fill="#06C755"/></svg>
          </span>
          <div>
            <p class="text-xs font-bold text-brand-700">開啟預約提醒通知</p>
            <p class="text-[10px] text-brand-400">只需設定一次，之後自動收到通知</p>
          </div>
        </div>
        <div class="line-bind-steps">
          <div class="line-bind-step">
            <span class="line-bind-num">1</span>
            <span class="text-[11px] text-brand-500">到官方 LINE 聊天室</span>
          </div>
          <div class="line-bind-step">
            <span class="line-bind-num">2</span>
            <span class="text-[11px] text-brand-500">輸入您的手機號碼</span>
          </div>
          <div class="line-bind-step">
            <span class="line-bind-num">3</span>
            <span class="text-[11px] text-brand-500">綁定完成，自動收到預約提醒</span>
          </div>
        </div>
        <a
          href="https://line.me/R/ti/p/@903zzutx"
          target="_blank"
          rel="noopener"
          class="line-bind-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 5.81 2 10.5c0 2.65 1.33 5.02 3.42 6.58-.12.44-.64 2.32-.67 2.47 0 0-.01.08.04.11.05.03.11.01.11.01.15-.02 1.76-1.15 2.5-1.7.85.25 1.76.38 2.6.38 5.52 0 10-3.81 10-8.5S17.52 2 12 2z" fill="white"/></svg>
          前往輸入手機號碼
        </a>
      </div>

      <!-- Google Map 店面位置 -->
      <a
        href="https://maps.app.goo.gl/itw3jVbvuNajf2kp8?g_st=ic"
        target="_blank"
        rel="noopener"
        class="map-link"
      >
        <span class="map-link-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </span>
        <span class="map-link-text">查看店面位置</span>
        <svg class="map-link-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
      </a>

      <div class="flex gap-3 mt-3">
        <button type="button" class="btn-outline flex-1 text-xs" @click="goHistory">查看紀錄</button>
        <button type="button" class="flex-1 text-white font-semibold text-xs"
          style="background: #655b55; border-radius: 14px; padding: 12px; border: none; cursor: pointer;"
          @click="goHome">返回首頁</button>
      </div>
    </div>

    <!-- 預約表單 -->
    <div v-else class="max-w-[280px] mx-auto text-center">
      <h2 class="text-base font-bold mb-6 text-brand-700">確認預約資訊</h2>

      <!-- Booking summary card -->
      <div class="text-left space-y-1.5 mb-6 p-5" style="background: #f8f7f5; border-radius: 16px;">
        <div class="text-xs text-brand-500">
          已選 <span class="font-bold">{{ booking.count }}</span> 項 ·
          預估 <span class="font-bold">{{ booking.totalDuration }}</span> 分鐘
        </div>
        <div class="text-[11px] text-brand-400">{{ booking.itemsLabel }}</div>
        <div class="flex items-baseline gap-2 mt-1">
          <span class="font-extrabold text-brand-600">NT$ {{ booking.total }}</span>
          <span v-if="booking.discount > 0" class="text-[10px] text-amber-600 font-bold">
            (新客折 -${{ booking.discount }})
          </span>
        </div>
        <p v-if="booking.hasCombo" class="text-[9px] text-amber-600 font-bold mt-1.5">
          ※ 套餐活動不適用任何優惠活動
        </p>
      </div>

      <div class="space-y-4 text-left">
        <!-- Date -->
        <div>
          <label class="label">選擇日期</label>
          <SharedCalendar
            v-model="selectedDate"
            :min-date="today"
            :grayed-dates="fullyUnavailableDates"
            grayed-disabled
            @month-change="loadMonthAvailability"
          />
        </div>

        <!-- Time slots -->
        <div>
          <label class="label">選擇時段</label>
          <p v-if="loadingSlots" class="text-[11px] text-brand-400 text-center py-3">載入中…</p>
          <TimeSlotGrid v-else :slots="slots" :selected="selectedTime" @select="(t) => (selectedTime = t)" />
        </div>

        <!-- Remarks -->
        <div>
          <label class="label">備註說明</label>
          <textarea v-model="booking.remarks" class="input resize-none h-20 py-3 text-xs" placeholder="過敏成分、肌膚狀況、特別需求…" />
        </div>

        <!-- 預約須知勾選 -->
        <div class="notice-check">
          <label class="notice-check-label" @click.prevent>
            <input type="checkbox" v-model="agreedNotice" class="notice-checkbox" />
            <span>我已閱讀並同意</span>
            <button type="button" class="notice-link" @click="showNotice = true">預約須知</button>
          </label>
        </div>

        <p v-if="error" class="text-xs text-red-500 font-bold text-center">{{ error }}</p>

        <button
          type="button"
          class="w-full text-white font-semibold text-sm"
          style="background: #655b55; border-radius: 14px; padding: 12px; border: none; cursor: pointer;"
          :disabled="!canSubmit || submitting"
          :style="{ opacity: !canSubmit || submitting ? '0.5' : '1' }"
          @click="submit"
        >
          {{ submitting ? '送出中…' : '確定預約' }}
        </button>

        <button
          type="button"
          class="text-xs text-brand-400 font-bold underline block w-full text-center pt-2"
          @click="router.push('/services')"
        >
          返回修改項目
        </button>
      </div>
    </div>
    <!-- 預約須知 Modal -->
    <div v-if="showNotice" class="fixed inset-0 z-[60] flex items-center justify-center p-3" style="background:rgba(0,0,0,0.5);" @click.self="showNotice = false">
      <div class="notice-modal">
        <div class="notice-modal-header">
          <h3 class="notice-modal-title">預約須知與注意事項</h3>
          <button class="notice-modal-close" @click="showNotice = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="notice-modal-body">
          <p class="notice-intro">為了確保施作品質與您的肌膚安全，請在預約前細讀以下內容：</p>

          <div class="notice-section">
            <h4 class="notice-section-title">關於您的肌膚準備</h4>
            <ul class="notice-list">
              <li><strong>肌膚檢測｜</strong>請確認施作部位目前無傷口、過敏或紅腫不適。</li>
              <li><strong>毛髮長度｜</strong>術前一週請勿自行修剪！須預留 1cm 以上毛髮，熱蠟才抓得住它們喔。</li>
              <li><strong>保養禁忌｜</strong>施作前一週請暫停使用美白、果酸或任何去角質類產品。</li>
              <li><strong>著裝建議｜</strong>建議穿著棉質、寬鬆衣物前來，減少術後肌膚的摩擦負擔。</li>
              <li><strong>健康叮嚀｜</strong>若有傳染性或皮膚相關疾病請暫勿預約。若現場經檢視發現此狀況，為維護衛生及安全將婉拒服務，敬請見諒。</li>
            </ul>
          </div>

          <div class="notice-section">
            <h4 class="notice-section-title">預約與改期規範</h4>
            <ul class="notice-list">
              <li><strong>改約取消｜</strong>珊珊的時間都是特別為您預留的。如需異動請於 <strong>2 天前</strong> 告知；若當日臨時取消或放鳥，需補貼 <strong>$500 空檔費</strong>。</li>
              <li><strong>準時赴約｜</strong>為維護下一位客人的權益，時間僅保留 10 分鐘，逾時將無法施作需另約時間。</li>
              <li><strong>項目增減｜</strong>現場無法臨時追加項目，若想增加部位請務必「提前私訊」我喔！</li>
            </ul>
          </div>
        </div>

        <div class="notice-modal-footer">
          <button
            type="button"
            class="notice-agree-btn"
            @click="agreedNotice = true; showNotice = false"
          >
            我已閱讀並同意
          </button>
        </div>
      </div>
    </div>
    </div>
  </section>
</template>

<style scoped>
/* 預約須知勾選 */
.notice-check {
  padding: 4px 0;
}
.notice-check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #7a726d;
  cursor: pointer;
}
.notice-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 2px solid #d5d0cc;
  accent-color: #655b55;
  cursor: pointer;
  flex-shrink: 0;
}
.notice-link {
  background: none;
  border: none;
  color: #655b55;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}

/* 須知 Modal */
.notice-modal {
  background: #fff;
  border-radius: 22px;
  width: 100%;
  max-width: 340px;
  max-height: calc(100vh - 24px);
  max-height: calc(100dvh - 24px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0,0,0,0.2);
  animation: notice-pop 0.2s ease-out;
}
@keyframes notice-pop {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.notice-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px 10px;
  flex-shrink: 0;
}
.notice-modal-title {
  font-size: 14px;
  font-weight: 800;
  color: #3b3530;
  margin: 0;
}
.notice-modal-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f5f3f1;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b0aba7;
  cursor: pointer;
  flex-shrink: 0;
}
.notice-modal-body {
  padding: 0 18px;
  overflow-y: auto;
  flex: 1;
}
.notice-modal-body::-webkit-scrollbar { display: none; }
.notice-modal-body { -ms-overflow-style: none; scrollbar-width: none; }
.notice-intro {
  font-size: 11px;
  color: #7a726d;
  line-height: 1.6;
  margin: 0 0 12px;
}
.notice-section {
  margin-bottom: 12px;
}
.notice-section-title {
  font-size: 12px;
  font-weight: 800;
  color: #4a423d;
  margin: 0 0 6px;
}
.notice-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.notice-list li {
  font-size: 11px;
  color: #6b635e;
  line-height: 1.6;
  padding: 2px 0 2px 12px;
  position: relative;
}
.notice-list li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #b0aba7;
  font-weight: bold;
}
.notice-list li strong {
  color: #4a423d;
  font-weight: 700;
}
.notice-modal-footer {
  padding: 12px 18px 18px;
  flex-shrink: 0;
}
.notice-agree-btn {
  width: 100%;
  background: #655b55;
  color: white;
  font-size: 13px;
  font-weight: 700;
  border: none;
  border-radius: 14px;
  padding: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.notice-agree-btn:active {
  background: #4a423d;
}

/* Google Map 連結 */
.map-link {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: #f8f7f5;
  border: 1.5px solid #ede9e5;
  border-radius: 14px;
  padding: 12px 16px;
  text-decoration: none;
  transition: background 0.15s;
}
.map-link:active {
  background: #f0efed;
}
.map-link-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #655b55;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}
.map-link-text {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: #4a423d;
}
.map-link-arrow {
  color: #b0aba7;
  flex-shrink: 0;
}

/* LINE 綁定通知卡片 */
.line-bind-card {
  background: #f8f7f5;
  border: 1.5px solid #ede9e5;
  border-radius: 16px;
  padding: 16px;
}
.line-bind-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e8f5e9;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.line-bind-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.line-bind-step {
  display: flex;
  align-items: center;
  gap: 8px;
}
.line-bind-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #655b55;
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.line-bind-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  background: #06C755;
  color: white;
  font-size: 13px;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  padding: 11px;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}
.line-bind-btn:active {
  background: #05a847;
}
</style>
