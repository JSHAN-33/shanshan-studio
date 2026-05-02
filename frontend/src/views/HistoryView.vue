<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { bookingsApi } from '@/api/bookings';
import { membersApi } from '@/api/members';
import { serviceHistoryApi } from '@/api/serviceHistory';
import { consultationFormsApi } from '@/api/consultationForms';
import { useAuthStore } from '@/stores/auth';
import type { Booking, BookingStatus, Member, ServiceHistory } from '@/api/types';

const auth = useAuthStore();
const router = useRouter();
const bookings = ref<Booking[]>([]);
const serviceHistory = ref<ServiceHistory[]>([]);
const member = ref<Member | null>(null);
const loading = ref(true);
const showTopup = ref(false);
const hasConsultation = ref(false);

const badgeClass: Record<BookingStatus, string> = {
  待付訂金: 'badge-deposit',
  待確認: 'badge-pending',
  已確認: 'badge-confirmed',
  已完成: 'badge-done',
  已取消: 'badge-cancelled',
};

async function load() {
  if (!auth.customer?.phone) { router.replace('/login'); return; }
  loading.value = true;
  const [bList, mem, hList, cfForm] = await Promise.all([
    bookingsApi.listByPhone(auth.customer.phone),
    membersApi.getByPhone(auth.customer.phone),
    serviceHistoryApi.listByPhone(auth.customer.phone).catch(() => []),
    consultationFormsApi.getMine(auth.customer.phone).catch(() => null),
  ]);
  bookings.value = bList;
  member.value = mem;
  serviceHistory.value = hList;
  hasConsultation.value = !!cfForm;
  loading.value = false;
}

onMounted(load);
</script>

<template>
  <section class="h-dvh flex flex-col">
    <!-- Header (精簡固定頂部) -->
    <header class="bg-white px-5 py-2.5 shrink-0 flex justify-between items-center" style="border-bottom: 1px solid #f5f4f2;">
      <div>
        <h1 class="text-sm font-bold tracking-tight text-brand-700">SHANSHAN.STUDIO</h1>
        <p class="text-[7px] tracking-[0.2em] text-brand-300 uppercase font-bold">MEMBER CENTER</p>
      </div>
      <button
        type="button"
        class="text-[10px] font-bold text-brand-400 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-full transition"
        @click="auth.clearCustomer(); router.push('/login')"
      >
        登出
      </button>
    </header>

    <!-- 可滾動的內容區域 -->
    <main class="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
      <!-- Member card (dark style) -->
      <div style="border-radius: 28px; overflow: hidden; box-shadow: 0 8px 32px rgba(59,53,48,0.28);">
        <div style="background: #3b3530; padding: 24px 24px 26px; position: relative; overflow: hidden;">
          <div style="position:absolute;top:-50px;right:-50px;width:190px;height:190px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.13);pointer-events:none;"></div>
          <p style="font-size:9px;font-weight:800;letter-spacing:0.28em;color:rgba(255,255,255,0.28);margin:0 0 20px;text-transform:uppercase;">SHANSHAN.STUDIO</p>
          <div class="flex items-center gap-3.5 mb-5">
            <img
              v-if="member?.pictureUrl"
              :src="member.pictureUrl"
              class="w-[52px] h-[52px] shrink-0 rounded-full object-cover"
              style="border:1.5px solid rgba(255,255,255,0.22);"
              alt="avatar"
            />
            <div v-else class="w-[52px] h-[52px] shrink-0 rounded-full flex items-center justify-center" style="background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.18);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.8"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <p style="font-size:9px;font-weight:700;letter-spacing:0.16em;color:rgba(255,255,255,0.28);margin:0 0 4px;text-transform:uppercase;">Member</p>
              <h2 style="font-size:22px;font-weight:900;color:white;margin:0;line-height:1.1;">{{ auth.customer?.name ?? '--' }}</h2>
            </div>
          </div>
          <div class="flex gap-7">
            <div>
              <p style="font-size:8px;font-weight:700;letter-spacing:0.18em;color:rgba(255,255,255,0.28);margin:0 0 3px;text-transform:uppercase;">Phone</p>
              <p style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.78);margin:0;">{{ auth.customer?.phone ?? '--' }}</p>
            </div>
            <div v-if="auth.customer?.bday">
              <p style="font-size:8px;font-weight:700;letter-spacing:0.18em;color:rgba(255,255,255,0.28);margin:0 0 3px;text-transform:uppercase;">Birthday</p>
              <p style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.78);margin:0;">{{ auth.customer.bday }}</p>
            </div>
          </div>
          <!-- 儲值金 -->
          <div v-if="member && member.wallet > 0" style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);">
            <div class="flex items-center justify-between">
              <p style="font-size:8px;font-weight:700;letter-spacing:0.18em;color:rgba(255,255,255,0.28);margin:0;text-transform:uppercase;">Wallet / 儲值金</p>
              <p style="font-size:18px;font-weight:900;color:rgba(255,255,255,0.88);margin:0;">NT$ {{ member.wallet.toLocaleString() }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 儲值優惠按鈕 -->
      <button type="button" class="topup-btn" @click="showTopup = true">
        <span class="topup-btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v20M2 12h20"/></svg>
        </span>
        <span class="topup-btn-text">儲值優惠方案</span>
        <svg class="topup-btn-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <!-- 顧客諮詢表按鈕 -->
      <button type="button" class="topup-btn" @click="router.push('/consultation-form')">
        <span class="topup-btn-icon" style="background:rgba(255,255,255,0.08);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </span>
        <span class="topup-btn-text">{{ hasConsultation ? '查看／更新諮詢表' : '填寫顧客諮詢表' }}</span>
        <span v-if="hasConsultation" style="font-size:9px;font-weight:700;color:#c8a96e;background:rgba(200,169,110,0.15);padding:2px 8px;border-radius:8px;margin-right:4px;">已填寫</span>
        <svg class="topup-btn-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <!-- 儲值優惠 Modal -->
      <div v-if="showTopup" class="fixed inset-0 z-40 flex items-center justify-center p-5" style="background:rgba(0,0,0,0.5);" @click.self="showTopup = false">
        <div class="topup-modal">
          <!-- Close -->
          <button class="topup-modal-close" @click="showTopup = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>

          <!-- Decorative circles -->
          <div class="topup-deco-circle topup-deco-1"></div>
          <div class="topup-deco-circle topup-deco-2"></div>

          <p class="topup-label">SHANSHAN.STUDIO</p>
          <h3 class="topup-title">儲值優惠</h3>
          <p class="topup-subtitle">Top-up Promotion</p>

          <div class="topup-plans">
            <div class="topup-card">
              <div class="flex justify-between items-center">
                <div>
                  <p class="topup-plan-name">方案一 <span class="topup-plan-eng">PLAN A</span></p>
                  <p class="topup-amount">儲值 <strong>NT$ 5,000</strong></p>
                </div>
                <div class="text-right">
                  <p class="topup-bonus">贈 <span>NT$ 500</span></p>
                  <div class="topup-total">實得 5,500</div>
                </div>
              </div>
            </div>

            <div class="topup-card topup-card--highlight">
              <div class="flex justify-between items-center">
                <div>
                  <p class="topup-plan-name">方案二 <span class="topup-plan-eng">PLAN B</span></p>
                  <p class="topup-amount">儲值 <strong>NT$ 10,000</strong></p>
                </div>
                <div class="text-right">
                  <p class="topup-bonus">贈 <span>NT$ 2,000</span></p>
                  <div class="topup-total">實得 12,000</div>
                </div>
              </div>
            </div>

            <div class="topup-card">
              <div class="flex justify-between items-center">
                <div>
                  <p class="topup-plan-name">方案三 <span class="topup-plan-eng">PLAN C</span></p>
                  <p class="topup-amount">儲值 <strong>NT$ 15,000</strong></p>
                </div>
                <div class="text-right">
                  <p class="topup-bonus">贈 <span>NT$ 3,500</span></p>
                  <div class="topup-total">實得 18,500</div>
                </div>
              </div>
            </div>
          </div>

          <div class="topup-notes">
            <p>· 儲值金無使用期限</p>
            <p>· 限本人使用，不可轉讓</p>
            <p>· 不可與其他優惠併用</p>
            <p>· 如需儲值請透過 LINE 聯繫小編</p>
          </div>
        </div>
      </div>

      <!-- Service history（歷史消費：由店家手動輸入） -->
      <div v-if="serviceHistory.length" class="pt-4">
        <div class="section-label mb-3 ml-2">SERVICE HISTORY / 消費紀錄</div>
        <ul class="space-y-3">
          <li v-for="h in serviceHistory" :key="h.id" class="card">
            <div class="flex justify-between items-start">
              <div class="min-w-0 flex-1">
                <div class="text-xs text-brand-400">{{ h.date }}</div>
                <div class="font-bold text-sm mt-1 text-brand-700">{{ h.items }}</div>
                <div class="text-brand-600 font-extrabold mt-1">NT$ {{ h.total.toLocaleString() }}</div>
                <div v-if="h.remarks" class="text-[10px] text-brand-400 mt-2">備註：{{ h.remarks }}</div>
              </div>
            </div>
          </li>
        </ul>
        <p class="text-[10px] text-brand-400 text-right mt-2 mr-1">
          累計 {{ serviceHistory.length }} 次 · NT$ {{ serviceHistory.reduce((s, h) => s + h.total, 0).toLocaleString() }}
        </p>
      </div>

      <!-- Booking history -->
      <div class="pt-4">
        <div class="section-label mb-3 ml-2">BOOKING HISTORY / 預約紀錄</div>
        <p v-if="loading" class="text-center text-brand-400 py-6 text-xs">載入中…</p>
        <p v-else-if="!bookings.length" class="text-center text-brand-400 py-6 text-xs">尚無預約紀錄</p>
        <ul v-else class="space-y-3">
          <li v-for="b in bookings" :key="b.id" class="card">
            <div class="flex justify-between items-start">
              <div>
                <div class="text-xs text-brand-400">{{ b.date }} {{ b.time }}</div>
                <div class="font-bold text-sm mt-1 text-brand-700">{{ b.items }}</div>
                <div class="text-brand-600 font-extrabold mt-1">NT$ {{ b.total }}</div>
              </div>
              <span class="badge" :class="badgeClass[b.status]">{{ b.status }}</span>
            </div>
            <div v-if="b.remarks" class="text-[10px] text-brand-400 mt-2">備註：{{ b.remarks }}</div>
          </li>
        </ul>
        <p class="text-[11px] text-brand-400 text-center mt-4 leading-relaxed">
          如需取消或異動預約，請透過 LINE 私訊小編人工處理
        </p>
      </div>
    </main>
  </section>
</template>

<style scoped>
.topup-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: #3b3530;
  border: none;
  border-radius: 18px;
  padding: 14px 18px;
  cursor: pointer;
  transition: background 0.15s;
  box-shadow: 0 4px 16px rgba(59,53,48,0.18);
}
.topup-btn:active {
  background: #4a423d;
}
.topup-btn-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c8a96e;
  flex-shrink: 0;
}
.topup-btn-text {
  flex: 1;
  text-align: left;
  font-size: 14px;
  font-weight: 700;
  color: rgba(255,255,255,0.85);
  letter-spacing: 0.03em;
}
.topup-btn-arrow {
  color: rgba(255,255,255,0.3);
  flex-shrink: 0;
}
.topup-modal {
  background: #3b3530;
  border-radius: 28px;
  width: 100%;
  max-width: 340px;
  padding: 24px 20px 20px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0,0,0,0.35);
  animation: topup-pop 0.2s ease-out;
}
@keyframes topup-pop {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.topup-modal-close {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 10;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  transition: background 0.15s;
}
.topup-modal-close:hover {
  background: rgba(255,255,255,0.18);
}
.topup-deco-circle {
  position: absolute;
  border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,0.08);
  pointer-events: none;
}
.topup-deco-1 {
  width: 200px; height: 200px;
  top: -80px; right: -60px;
}
.topup-deco-2 {
  width: 120px; height: 120px;
  bottom: -40px; left: -30px;
}
.topup-label {
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.28em;
  color: rgba(255,255,255,0.22);
  text-transform: uppercase;
  margin: 0 0 14px;
}
.topup-title {
  font-size: 20px;
  font-weight: 900;
  color: white;
  margin: 0 0 2px;
  line-height: 1.2;
}
.topup-subtitle {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  margin: 0 0 20px;
}
.topup-plans {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.topup-card {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  padding: 12px 14px;
}
.topup-card--highlight {
  border-color: rgba(255,255,255,0.22);
  background: rgba(255,255,255,0.1);
}
.topup-plan-name {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255,255,255,0.65);
  margin: 0 0 3px;
}
.topup-plan-eng {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.22);
  text-transform: uppercase;
  margin-left: 4px;
}
.topup-amount {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin: 0;
}
.topup-amount strong {
  color: rgba(255,255,255,0.9);
  font-weight: 800;
  font-size: 14px;
}
.topup-bonus {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin: 0 0 4px;
}
.topup-bonus span {
  color: #c8a96e;
  font-weight: 700;
}
.topup-total {
  display: inline-block;
  background: rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 800;
  color: white;
}
.topup-card--highlight .topup-total {
  background: rgba(200,169,110,0.18);
  color: #c8a96e;
}
.topup-notes {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.topup-notes p {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  margin: 0 0 4px;
  line-height: 1.6;
}
</style>
