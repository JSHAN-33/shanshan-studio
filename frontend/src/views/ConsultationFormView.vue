<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { consultationFormsApi } from '@/api/consultationForms';
import { useToast } from '@/composables/useToast';

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();
const loading = ref(true);
const submitting = ref(false);
const alreadyFilled = ref(false);
const savedSignature = ref<string | null>(null);

const form = ref({
  name: '',
  gender: '' as '' | '男' | '女',
  birthday: '',
  mobile: '',
  address: '',
  hairRemoval: [] as string[],
  isFirstWax: null as boolean | null,
  isSensitive: null as boolean | null,
  isAlcoholSensitive: null as boolean | null,
  isPeriod: null as boolean | null,
  isPregnant: null as boolean | null,
  isSick: null as boolean | null,
  hasAcne: null as boolean | null,
  consent1: false,
  consent2: false,
  consent3: false,
  consent4: false,
  privacy1: false,
  privacy2: false,
  consentAgreed: false,
});

// Signature canvas
const canvasRef = ref<HTMLCanvasElement | null>(null);
let isDrawing = false;
let ctx: CanvasRenderingContext2D | null = null;

const hairOptions = [
  '刮片刮毛', '電動美體刀', '雷射除毛（醫師施作）', '光學除毛（美容師施作）',
  '拔毛夾', '除毛膏／慕絲', '蜜蠟／蜜蠟貼片',
];

onMounted(async () => {
  if (!auth.customer?.phone) { router.replace('/login'); return; }
  try {
    const existing = await consultationFormsApi.getMine(auth.customer.phone);
    if (existing) {
      alreadyFilled.value = true;
      form.value.name = existing.name;
      form.value.gender = (existing.gender ?? '') as '' | '男' | '女';
      form.value.birthday = existing.birthday ?? '';
      form.value.mobile = existing.mobile ?? '';
      form.value.address = existing.address ?? '';
      form.value.hairRemoval = existing.hairRemoval ?? [];
      form.value.isFirstWax = existing.isFirstWax;
      form.value.isSensitive = existing.isSensitive;
      form.value.isAlcoholSensitive = existing.isAlcoholSensitive;
      form.value.isPeriod = existing.isPeriod;
      form.value.isPregnant = existing.isPregnant;
      form.value.isSick = existing.isSick;
      form.value.hasAcne = existing.hasAcne;
      form.value.consentAgreed = existing.consentAgreed;
      form.value.consent1 = existing.consentAgreed;
      form.value.consent2 = existing.consentAgreed;
      form.value.consent3 = existing.consentAgreed;
      form.value.consent4 = existing.consentAgreed;
      savedSignature.value = existing.signatureData ?? null;
    } else {
      form.value.name = auth.customer.name ?? '';
      form.value.mobile = auth.customer.phone ?? '';
      form.value.birthday = auth.customer.bday ?? '';
    }
  } catch { /* ignore */ }
  loading.value = false;
  if (!alreadyFilled.value) setTimeout(initCanvas, 100);
});

function initCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);
  ctx.strokeStyle = '#3b3530';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function getPos(e: MouseEvent | TouchEvent) {
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  if ('touches' in e) {
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function startDraw(e: MouseEvent | TouchEvent) {
  e.preventDefault();
  isDrawing = true;
  const pos = getPos(e);
  ctx?.beginPath();
  ctx?.moveTo(pos.x, pos.y);
}

function draw(e: MouseEvent | TouchEvent) {
  if (!isDrawing) return;
  e.preventDefault();
  const pos = getPos(e);
  ctx?.lineTo(pos.x, pos.y);
  ctx?.stroke();
}

function endDraw() {
  isDrawing = false;
}

function clearSignature() {
  const canvas = canvasRef.value;
  if (!canvas || !ctx) return;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
}

function toggleHair(opt: string) {
  const idx = form.value.hairRemoval.indexOf(opt);
  if (idx >= 0) form.value.hairRemoval.splice(idx, 1);
  else form.value.hairRemoval.push(opt);
}

async function submit() {
  if (!auth.customer?.phone) return;
  if (!form.value.name.trim()) { toast.show('請填寫姓名'); return; }

  submitting.value = true;
  try {
    let signatureData: string | null = null;
    const canvas = canvasRef.value;
    if (canvas) {
      signatureData = canvas.toDataURL('image/png');
    }

    await consultationFormsApi.submit({
      phone: auth.customer.phone,
      name: form.value.name,
      gender: form.value.gender || null,
      birthday: form.value.birthday || null,
      mobile: form.value.mobile || null,
      address: form.value.address || null,
      hairRemoval: form.value.hairRemoval,
      isFirstWax: form.value.isFirstWax ?? false,
      isSensitive: form.value.isSensitive ?? false,
      isAlcoholSensitive: form.value.isAlcoholSensitive ?? false,
      isPeriod: form.value.isPeriod ?? false,
      isPregnant: form.value.isPregnant ?? false,
      isSick: form.value.isSick ?? false,
      hasAcne: form.value.hasAcne ?? false,
      consentAgreed: form.value.consent1 && form.value.consent2 && form.value.consent3 && form.value.consent4,
      signatureData,
    });
    toast.show('諮詢表已送出');
    router.push('/history');
  } catch {
    toast.show('送出失敗，請稍後再試');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="h-dvh flex flex-col" style="background:#f5f3f0;">
    <!-- Header -->
    <header class="cf-header">
      <button class="cf-back" @click="router.push('/history')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <h1 class="cf-header-title">顧客諮詢表</h1>
      <div style="width:32px"></div>
    </header>

    <main v-if="loading" class="flex-1 flex items-center justify-center">
      <p style="color:#b0aba7;font-size:14px;">載入中…</p>
    </main>

    <main v-else class="flex-1 overflow-y-auto">
      <!-- 已填寫提示 -->
      <div v-if="alreadyFilled" class="cf-filled-notice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        <span>諮詢表已填寫，無法再修改</span>
      </div>
      <div class="cf-paper" :class="{ 'cf-paper--readonly': alreadyFilled }">

        <!-- ===== 頂部 RICA + 標題 ===== -->
        <div class="cf-top">
          <div class="cf-top-left">
            <div class="cf-rica">RICA</div>
            <div class="cf-rica-sub">MADE IN ITALY</div>
          </div>
          <h2 class="cf-title">顧 客 諮 詢 表</h2>
        </div>

        <!-- ===== 基本資料 ===== -->
        <div class="cf-block">
          <div class="cf-tag">基本資料</div>
          <div class="cf-row">
            <span class="cf-label">姓名：</span>
            <input v-model="form.name" type="text" class="cf-input cf-input--center flex-1" placeholder="請填寫真名" :disabled="alreadyFilled" />
            <span class="cf-label" style="margin-left:20px;">性別：</span>
            <label class="cf-ck"><input type="radio" v-model="form.gender" value="男" :disabled="alreadyFilled" /><span class="cf-box"></span> 男</label>
            <label class="cf-ck"><input type="radio" v-model="form.gender" value="女" :disabled="alreadyFilled" /><span class="cf-box"></span> 女</label>
          </div>
          <div class="cf-row">
            <span class="cf-label">生日：</span>
            <input v-model="form.birthday" type="date" class="cf-input cf-input--center" style="width:160px;" :disabled="alreadyFilled" />
          </div>
          <div class="cf-row">
            <span class="cf-label">手機：</span>
            <input v-model="form.mobile" type="tel" class="cf-input cf-input--center" style="width:160px;" :disabled="alreadyFilled" />
            <span class="cf-label" style="margin-left:20px;">地址：</span>
            <input v-model="form.address" type="text" class="cf-input cf-input--center flex-1" :disabled="alreadyFilled" />
          </div>
        </div>

        <!-- ===== 過往毛髮處理 ===== -->
        <div class="cf-block cf-block--tinted">
          <div class="cf-tag">過往毛髮處理</div>
          <div class="cf-hair-grid">
            <label v-for="opt in hairOptions" :key="opt" class="cf-ck">
              <input type="checkbox" :checked="form.hairRemoval.includes(opt)" @change="toggleHair(opt)" :disabled="alreadyFilled" />
              <span class="cf-box cf-box--sq"></span>
              <span>{{ opt }}</span>
            </label>
          </div>
          <p class="cf-note-right">（以上可複選）</p>
        </div>

        <!-- ===== 生理狀態確認 ===== -->
        <div class="cf-block">
          <div class="cf-tag" style="background:#8c7e73;">生理狀態確認</div>
          <!-- 是/否 表頭 -->
          <div class="cf-yn-header">
            <span></span>
            <span class="cf-yn-h">是</span>
            <span class="cf-yn-h">否</span>
          </div>
          <div class="cf-q-list">
            <div class="cf-q-row">
              <span class="cf-q-text">· 本次是否為<strong>首次</strong>進行熱蠟除毛服務？</span>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="true" v-model="form.isFirstWax" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="false" v-model="form.isFirstWax" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
            </div>
            <div class="cf-q-row">
              <span class="cf-q-text">· 是否為<strong>敏感體質</strong>？（熱敏感、食物敏感、保養品／彩妝品敏感、沙塵敏感…等）</span>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="true" v-model="form.isSensitive" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="false" v-model="form.isSensitive" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
            </div>
            <div class="cf-q-row">
              <span class="cf-q-text">· 是否對<strong>酒精敏感</strong>？</span>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="true" v-model="form.isAlcoholSensitive" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="false" v-model="form.isAlcoholSensitive" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
            </div>
            <div class="cf-q-row">
              <span class="cf-q-text">· 目前是否為<strong>生理期間</strong>？</span>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="true" v-model="form.isPeriod" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="false" v-model="form.isPeriod" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
            </div>
            <div class="cf-q-row">
              <span class="cf-q-text">· 目前是否為<strong>懷孕期間</strong>？</span>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="true" v-model="form.isPregnant" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="false" v-model="form.isPregnant" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
            </div>
            <div class="cf-q-row">
              <span class="cf-q-text">· 目前是否為<strong>生病期間</strong>或<strong>免疫力下降</strong>期間？</span>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="true" v-model="form.isSick" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="false" v-model="form.isSick" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
            </div>
            <div class="cf-q-row">
              <span class="cf-q-text">· 本次除毛區域是否經常<strong>出油／長痘痘</strong>部位？</span>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="true" v-model="form.hasAcne" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
              <label class="cf-ck cf-ck--yn"><input type="radio" :value="false" v-model="form.hasAcne" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span></label>
            </div>
          </div>
        </div>

        <!-- ===== 服務確認條款 ===== -->
        <div class="cf-block cf-block--tinted">
          <div class="cf-tag" style="background:#8c7e73;">服務確認條款</div>
          <p class="cf-consent-note">（請貴客戶確認下述事項後，於<span style="color:#8c4a2f;font-weight:700;">☑處打✓</span>）</p>
          <div class="cf-consent-list">
            <label class="cf-consent-item">
              <input type="checkbox" v-model="form.consent1" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span>
              <p><span class="cf-num">1.</span> 本人確認接受熱蠟除毛部位之皮膚並無下列異常狀況，如：尚未復原或期復原之<span class="cf-hl">傷口疤痕</span>、<span class="cf-hl">瘀傷</span>、<span class="cf-hl">靜脈炎（靜脈曲張）</span>、<span class="cf-hl">傳染性皮膚疾病</span>、其他皮膚病變（包含糖尿病引起之皮膚問題）。</p>
            </label>
            <label class="cf-consent-item">
              <input type="checkbox" v-model="form.consent2" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span>
              <p><span class="cf-num">2.</span> 本人確認接受熱蠟除毛部位之皮膚並無一週內接受下列醫療處置：<span class="cf-hl">皮下微整形注射</span>（如：肉毒桿菌、玻尿酸、膠原蛋白…等）、<span class="cf-hl">醫美煥膚</span>（果酸、杏仁酸、胜肽酸…等），以及使用皮膚科面部治療藥物（維他命A酸、維他命A、四環黴素、乙醯胺酚…等）。如有上述皮膚狀況但未於除毛前告知美容師，<span class="cf-warn">本人願自行負擔相關風險</span>。</p>
            </label>
            <label class="cf-consent-item">
              <input type="checkbox" v-model="form.consent3" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span>
              <p><span class="cf-num">3.</span> 本人明白因為體質的不同，接受除毛後的皮膚，可能會出現暫時性的<span class="cf-hl">發紅</span>、<span class="cf-hl">毛囊水腫</span>、<span class="cf-hl">小紅疹</span>、<span class="cf-hl">瘀青</span>或是<span class="cf-hl">輕微脫皮</span>的狀況，同時本人後續願意遵照除毛後叮嚀之護理程序，以避免皮膚發炎之狀況產生。</p>
            </label>
            <label class="cf-consent-item">
              <input type="checkbox" v-model="form.consent4" :disabled="alreadyFilled" /><span class="cf-box cf-box--sq"></span>
              <p><span class="cf-num">4.</span> 本人已詳細閱讀並同意遵照「<span class="cf-hl">肌膚照護指南</span>」小卡之注意事項。</p>
            </label>
          </div>
        </div>

        <!-- ===== 個人資料授權同意 ===== -->
        <div class="cf-block">
          <div class="cf-tag">個人資料授權同意</div>
          <div class="cf-consent-list">
            <p><span class="cf-num">1.</span> 為保障個人優惠權益，本人同意提供貴單位蒐集保存、電腦處理、利用本人之個人資料，並同意不定時接收優惠資訊。</p>
            <p><span class="cf-num">2.</span> 後續如有需求，本人願意以<span class="cf-hl">書面</span>方式提出申請，終止利用或刪除個人資料之授權。</p>
          </div>
        </div>

        <!-- ===== 簽名 + 日期 ===== -->
        <div class="cf-block cf-sign-block">
          <div class="cf-sign-row">
            <div class="cf-sign-field">
              <span class="cf-label">簽名：</span>
              <!-- 已填寫：顯示已存簽名圖 -->
              <div v-if="alreadyFilled && savedSignature" class="cf-sign-canvas-wrap">
                <img :src="savedSignature" class="cf-sign-img" alt="簽名" />
              </div>
              <!-- 未填寫：畫布 -->
              <div v-else-if="!alreadyFilled" class="cf-sign-canvas-wrap">
                <canvas
                  ref="canvasRef"
                  class="cf-sign-canvas"
                  @mousedown="startDraw"
                  @mousemove="draw"
                  @mouseup="endDraw"
                  @mouseleave="endDraw"
                  @touchstart="startDraw"
                  @touchmove="draw"
                  @touchend="endDraw"
                ></canvas>
                <button type="button" class="cf-clear-sig" @click="clearSignature">清除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Submit (只在未填寫時顯示) -->
        <button
          v-if="!alreadyFilled"
          type="button"
          class="cf-submit"
          :disabled="submitting"
          @click="submit"
        >
          {{ submitting ? '送出中…' : '送出諮詢表' }}
        </button>

      </div>
    </main>
  </section>
</template>

<style scoped>
/* ---- Header ---- */
.cf-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: white;
  border-bottom: 1px solid #e8e4df;
}
.cf-back {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: none; color: #655b55; cursor: pointer;
}
.cf-header-title {
  font-size: 15px; font-weight: 800; color: #3b3530; letter-spacing: 0.08em;
}

/* ---- Paper ---- */
.cf-paper {
  max-width: 520px;
  margin: 12px auto;
  background: #fff;
  border: 1px solid #ddd8d2;
  padding: 0;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

/* ---- Top / RICA ---- */
.cf-top {
  display: flex; align-items: flex-end; gap: 16px;
  padding: 24px 24px 14px;
  border-bottom: 2.5px solid #a09388;
}
.cf-top-left { flex-shrink: 0; }
.cf-rica {
  font-family: 'Times New Roman', 'Georgia', serif;
  font-size: 36px; font-weight: 400; letter-spacing: 0.12em;
  color: #3b3530; line-height: 1;
}
.cf-rica-sub {
  font-size: 7px; letter-spacing: 0.22em;
  color: #b0aba7; margin-top: 1px;
}
.cf-title {
  font-size: 20px; font-weight: 700; color: #3b3530;
  letter-spacing: 0.45em; margin: 0 0 2px;
}

/* ---- Block ---- */
.cf-block {
  padding: 16px 24px 18px;
  border-bottom: 1px solid #e8e4df;
}
.cf-block--tinted {
  background: #f6f4f1;
}

/* ---- Tag (section label) ---- */
.cf-tag {
  display: inline-block;
  background: #a09388;
  color: #fff;
  font-size: 12px; font-weight: 700;
  padding: 3px 14px;
  border-radius: 1px;
  margin-bottom: 14px;
  letter-spacing: 0.1em;
}

/* ---- Row / Label / Input ---- */
.cf-row {
  display: flex; align-items: center; flex-wrap: wrap;
  gap: 4px; margin-bottom: 10px;
}
.cf-label {
  font-size: 13px; font-weight: 700; color: #4a423d;
  white-space: nowrap;
}
.cf-input {
  border: none; border-bottom: 1.5px solid #c4bfb8;
  padding: 4px 4px 3px; font-size: 14px; color: #3b3530;
  background: transparent; outline: none;
  min-width: 60px;
  transition: border-color 0.15s;
}
.cf-input--center { text-align: center; }
.cf-input:focus { border-color: #8c7e73; }

/* ---- Checkbox / Radio (paper style) ---- */
.cf-ck {
  display: inline-flex; align-items: center; gap: 4px;
  cursor: pointer; font-size: 12px; color: #3b3530;
  user-select: none; white-space: nowrap;
}
.cf-ck input { display: none; }
.cf-box {
  display: inline-block;
  width: 16px; height: 16px;
  border: 1.5px solid #a09388;
  border-radius: 50%;
  background: #fff;
  position: relative;
  flex-shrink: 0;
  transition: all 0.12s;
}
.cf-box--sq {
  border-radius: 2px;
}
.cf-box--lg {
  width: 20px; height: 20px;
}
.cf-ck input:checked + .cf-box {
  background: #8c7e73;
  border-color: #8c7e73;
}
.cf-ck input:checked + .cf-box::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 6px; height: 10px;
  border: solid #fff; border-width: 0 2px 2px 0;
  transform: translate(-50%, -55%) rotate(45deg);
}
.cf-ck input:checked + .cf-box--lg::after {
  width: 7px; height: 12px;
}

/* ---- Hair grid ---- */
.cf-hair-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
}
.cf-note-right {
  font-size: 11px; color: #b0aba7; text-align: right; margin-top: 8px;
}

/* ---- 生理狀態 Questions ---- */
.cf-yn-header {
  display: flex; align-items: center;
  padding-bottom: 6px; margin-bottom: 4px;
  border-bottom: 1px solid #d8d3cc;
}
.cf-yn-header span:first-child { flex: 1; }
.cf-yn-h {
  width: 40px; text-align: center;
  font-size: 13px; font-weight: 800; color: #6b5f57;
}
.cf-q-list {
  display: flex; flex-direction: column;
}
.cf-q-row {
  display: flex; align-items: flex-start;
  padding: 9px 0;
  border-bottom: 1px solid #eee9e4;
}
.cf-q-row:last-child { border-bottom: none; }
.cf-q-text {
  flex: 1; font-size: 12.5px; color: #3b3530; line-height: 1.6;
}
.cf-q-text strong {
  color: #8c4a2f; font-weight: 700;
}
.cf-ck--yn {
  width: 40px; display: flex; justify-content: center;
  align-items: flex-start; padding-top: 2px;
}

/* ---- Consent ---- */
.cf-consent-note {
  font-size: 12px; color: #6b5f57; font-weight: 600;
  margin-bottom: 12px; line-height: 1.6;
}
.cf-consent-item {
  display: flex; align-items: flex-start; gap: 8px;
  cursor: pointer; margin-bottom: 12px;
}
.cf-consent-item input { display: none; }
.cf-consent-item > .cf-box {
  margin-top: 3px; flex-shrink: 0;
}
.cf-consent-item input:checked + .cf-box {
  background: #8c7e73; border-color: #8c7e73;
}
.cf-consent-item input:checked + .cf-box::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 6px; height: 10px;
  border: solid #fff; border-width: 0 2px 2px 0;
  transform: translate(-50%, -55%) rotate(45deg);
}
.cf-consent-item p,
.cf-consent-list p {
  font-size: 11.5px; color: #4a423d; line-height: 1.8;
  margin: 0; text-align: justify; flex: 1;
}
.cf-num {
  font-weight: 800; color: #6b5f57; margin-right: 2px;
}
.cf-hl {
  color: #8c4a2f; font-weight: 600;
}
.cf-warn {
  color: #c0392b; font-weight: 700;
}

/* ---- Signature ---- */
.cf-sign-block {
  border-bottom: none;
}
.cf-sign-row {
  display: flex; gap: 20px;
}
.cf-sign-field {
  flex: 1;
}
.cf-sign-canvas-wrap {
  position: relative;
  border-bottom: 1.5px solid #c4bfb8;
  margin-top: 4px;
}
.cf-sign-canvas {
  width: 100%; height: 100px;
  display: block; touch-action: none;
  background: transparent;
}
.cf-clear-sig {
  position: absolute; top: 4px; right: 4px;
  background: rgba(0,0,0,0.05);
  border: 1px solid #d8d3cc;
  font-size: 10px; color: #8c7e73;
  padding: 2px 10px; border-radius: 3px;
  cursor: pointer; font-weight: 600;
}
.cf-clear-sig:active { background: rgba(0,0,0,0.1); }

/* ---- Submit ---- */
.cf-submit {
  display: block; width: calc(100% - 48px);
  margin: 20px auto 28px;
  padding: 14px;
  border: none; border-radius: 6px;
  background: #3b3530; color: white;
  font-size: 15px; font-weight: 800;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 0.15s;
}
.cf-submit:active { background: #4a423d; }
.cf-submit:disabled { opacity: 0.5; cursor: not-allowed; }

/* ---- Filled notice ---- */
.cf-filled-notice {
  display: flex; align-items: center; gap: 8px;
  max-width: 520px; margin: 12px auto 0;
  padding: 10px 16px;
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
  border-radius: 8px;
  font-size: 13px; font-weight: 700;
  color: #2e7d32;
}

/* ---- Readonly state ---- */
.cf-paper--readonly {
  pointer-events: none;
}
.cf-paper--readonly .cf-input {
  color: #3b3530;
  opacity: 1;
  -webkit-text-fill-color: #3b3530;
}
.cf-sign-img {
  width: 100%; height: 100px;
  object-fit: contain;
  display: block;
}
</style>
