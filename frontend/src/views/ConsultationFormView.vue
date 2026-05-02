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
    } else {
      form.value.name = auth.customer.name ?? '';
      form.value.mobile = auth.customer.phone ?? '';
      form.value.birthday = auth.customer.bday ?? '';
    }
  } catch { /* ignore */ }
  loading.value = false;

  // Init canvas
  setTimeout(initCanvas, 100);
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
  if (!form.value.consentAgreed) { toast.show('請勾選服務確認條款'); return; }

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
      consentAgreed: form.value.consentAgreed,
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
  <section class="h-dvh flex flex-col bg-white">
    <!-- Header -->
    <header class="cf-header">
      <button class="cf-back" @click="router.push('/history')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <h1 class="cf-header-title">顧客諮詢表</h1>
      <div style="width:32px"></div>
    </header>

    <main v-if="loading" class="flex-1 flex items-center justify-center">
      <p class="text-brand-400 text-sm">載入中…</p>
    </main>

    <main v-else class="flex-1 overflow-y-auto">
      <div class="cf-form">
        <!-- RICA Logo Area -->
        <div class="cf-logo-area">
          <div class="cf-logo-text">RICA</div>
          <div class="cf-logo-sub">MADE IN ITALY</div>
          <h2 class="cf-form-title">顧 客 諮 詢 表</h2>
        </div>

        <!-- 基本資料 -->
        <div class="cf-section">
          <div class="cf-section-label">基本資料</div>
          <div class="cf-field-row">
            <div class="cf-field flex-1">
              <label>姓名</label>
              <input v-model="form.name" type="text" placeholder="請輸入姓名" />
            </div>
            <div class="cf-field" style="width:120px">
              <label>性別</label>
              <div class="cf-radio-group">
                <label class="cf-radio"><input type="radio" v-model="form.gender" value="男" /><span>男</span></label>
                <label class="cf-radio"><input type="radio" v-model="form.gender" value="女" /><span>女</span></label>
              </div>
            </div>
          </div>
          <div class="cf-field-row">
            <div class="cf-field flex-1">
              <label>生日</label>
              <input v-model="form.birthday" type="date" />
            </div>
          </div>
          <div class="cf-field-row">
            <div class="cf-field flex-1">
              <label>手機</label>
              <input v-model="form.mobile" type="tel" placeholder="手機號碼" />
            </div>
          </div>
          <div class="cf-field-row">
            <div class="cf-field flex-1">
              <label>地址</label>
              <input v-model="form.address" type="text" placeholder="地址" />
            </div>
          </div>
        </div>

        <!-- 過往毛髮處理 -->
        <div class="cf-section">
          <div class="cf-section-label">過往毛髮處理</div>
          <div class="cf-checkbox-grid">
            <label v-for="opt in hairOptions" :key="opt" class="cf-checkbox">
              <input type="checkbox" :checked="form.hairRemoval.includes(opt)" @change="toggleHair(opt)" />
              <span>{{ opt }}</span>
            </label>
          </div>
          <p class="cf-hint">（以上可複選）</p>
        </div>

        <!-- 生理狀態確認 -->
        <div class="cf-section">
          <div class="cf-section-label">生理狀態確認</div>
          <div class="cf-questions">
            <div class="cf-question">
              <span class="cf-q-text">· 本次是否為首次進行熱蠟除毛服務？</span>
              <div class="cf-yn">
                <label class="cf-radio"><input type="radio" :value="true" v-model="form.isFirstWax" /><span>是</span></label>
                <label class="cf-radio"><input type="radio" :value="false" v-model="form.isFirstWax" /><span>否</span></label>
              </div>
            </div>
            <div class="cf-question">
              <span class="cf-q-text">· 是否為敏感體質？（熱敏感、食物敏感、保養品／彩妝品敏感、沙塵敏感…等）</span>
              <div class="cf-yn">
                <label class="cf-radio"><input type="radio" :value="true" v-model="form.isSensitive" /><span>是</span></label>
                <label class="cf-radio"><input type="radio" :value="false" v-model="form.isSensitive" /><span>否</span></label>
              </div>
            </div>
            <div class="cf-question">
              <span class="cf-q-text">· 是否對酒精敏感？</span>
              <div class="cf-yn">
                <label class="cf-radio"><input type="radio" :value="true" v-model="form.isAlcoholSensitive" /><span>是</span></label>
                <label class="cf-radio"><input type="radio" :value="false" v-model="form.isAlcoholSensitive" /><span>否</span></label>
              </div>
            </div>
            <div class="cf-question">
              <span class="cf-q-text">· 目前是否為生理期間？</span>
              <div class="cf-yn">
                <label class="cf-radio"><input type="radio" :value="true" v-model="form.isPeriod" /><span>是</span></label>
                <label class="cf-radio"><input type="radio" :value="false" v-model="form.isPeriod" /><span>否</span></label>
              </div>
            </div>
            <div class="cf-question">
              <span class="cf-q-text">· 目前是否為懷孕期間？</span>
              <div class="cf-yn">
                <label class="cf-radio"><input type="radio" :value="true" v-model="form.isPregnant" /><span>是</span></label>
                <label class="cf-radio"><input type="radio" :value="false" v-model="form.isPregnant" /><span>否</span></label>
              </div>
            </div>
            <div class="cf-question">
              <span class="cf-q-text">· 目前是否為生病期間或免疫力下降期間？</span>
              <div class="cf-yn">
                <label class="cf-radio"><input type="radio" :value="true" v-model="form.isSick" /><span>是</span></label>
                <label class="cf-radio"><input type="radio" :value="false" v-model="form.isSick" /><span>否</span></label>
              </div>
            </div>
            <div class="cf-question">
              <span class="cf-q-text">· 本次除毛區域是否經常出油／長痘痘部位？</span>
              <div class="cf-yn">
                <label class="cf-radio"><input type="radio" :value="true" v-model="form.hasAcne" /><span>是</span></label>
                <label class="cf-radio"><input type="radio" :value="false" v-model="form.hasAcne" /><span>否</span></label>
              </div>
            </div>
          </div>
        </div>

        <!-- 服務確認條款 -->
        <div class="cf-section">
          <div class="cf-section-label">服務確認條款</div>
          <p class="cf-consent-intro">（請貴客戶確認下述事項後，於下方勾選同意）</p>
          <div class="cf-consent-items">
            <p>1. 本人確認接受熱蠟除毛部位之皮膚並無下列異常狀況，如：尚未復原或期復原之傷口疤痕、瘀傷、靜脈炎（靜脈曲張）、傳染性皮膚疾病、其他皮膚病變（包含糖尿病引起之皮膚問題）。</p>
            <p>2. 本人確認接受熱蠟除毛部位之皮膚並無一週內接受下列醫療處置：皮下微整形注射（如：肉毒桿菌、玻尿酸、膠原蛋白…等）、醫美煥膚（果酸、杏仁酸、胜肽酸…等），以及使用皮膚科面部治療藥物（維他命A酸、維他命A、四環黴素、乙醯胺酚…等）。如有上述皮膚狀況但未於除毛前告知美容師，本人願自行負擔相關風險。</p>
            <p>3. 本人明白因為體質的不同，接受除毛後的皮膚，可能會出現暫時性的發紅、毛囊水腫、小紅疹、瘀青或是輕微脫皮的狀況，同時本人後續願意遵照除毛後叮嚀之護理程序，以避免皮膚發炎之狀況產生。</p>
            <p>4. 本人已詳細閱讀並同意遵照「肌膚照護指南」小卡之注意事項。</p>
          </div>
          <div class="cf-consent-privacy">
            <div class="cf-section-label" style="margin-top:16px">個人資料授權同意</div>
            <p>1. 為保障個人優惠權益，本人同意提供貴單位蒐集保存、電腦處理、利用本人之個人資料，並同意不定時接收優惠資訊。</p>
            <p>2. 後續如有需求，本人願意以書面方式提出申請，終止利用或刪除個人資料之授權。</p>
          </div>
          <label class="cf-agree-check">
            <input type="checkbox" v-model="form.consentAgreed" />
            <span>我已閱讀並同意以上所有條款</span>
          </label>
        </div>

        <!-- 簽名 -->
        <div class="cf-section">
          <div class="cf-section-label">簽名</div>
          <div class="cf-signature-area">
            <canvas
              ref="canvasRef"
              class="cf-signature-canvas"
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

        <!-- Submit -->
        <button
          type="button"
          class="cf-submit-btn"
          :disabled="submitting"
          @click="submit"
        >
          {{ submitting ? '送出中…' : (alreadyFilled ? '更新諮詢表' : '送出諮詢表') }}
        </button>
      </div>
    </main>
  </section>
</template>

<style scoped>
.cf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #f0efed;
}
.cf-back {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: none; color: #655b55; cursor: pointer;
}
.cf-header-title {
  font-size: 15px; font-weight: 800; color: #3b3530; letter-spacing: 0.05em;
}

.cf-form {
  max-width: 480px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}

.cf-logo-area {
  text-align: center;
  padding: 20px 0 16px;
  border-bottom: 2px solid #b0a89e;
  margin-bottom: 20px;
}
.cf-logo-text {
  font-size: 32px;
  font-weight: 300;
  letter-spacing: 0.35em;
  color: #3b3530;
  line-height: 1;
}
.cf-logo-sub {
  font-size: 7px;
  letter-spacing: 0.3em;
  color: #b0aba7;
  margin-top: 2px;
}
.cf-form-title {
  font-size: 18px;
  font-weight: 700;
  color: #3b3530;
  margin-top: 12px;
  letter-spacing: 0.5em;
}

.cf-section {
  margin-bottom: 24px;
}
.cf-section-label {
  display: inline-block;
  background: #b0a89e;
  color: white;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 14px;
  border-radius: 2px;
  margin-bottom: 12px;
  letter-spacing: 0.08em;
}
.cf-field-row {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}
.cf-field {
  display: flex;
  flex-direction: column;
}
.cf-field label {
  font-size: 12px;
  font-weight: 600;
  color: #655b55;
  margin-bottom: 4px;
}
.cf-field input[type="text"],
.cf-field input[type="tel"],
.cf-field input[type="date"] {
  border: none;
  border-bottom: 1.5px solid #d4d0cc;
  padding: 6px 2px;
  font-size: 14px;
  color: #3b3530;
  background: transparent;
  outline: none;
  transition: border-color 0.15s;
}
.cf-field input:focus {
  border-color: #655b55;
}

.cf-radio-group {
  display: flex;
  gap: 16px;
  padding-top: 6px;
}
.cf-radio {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.cf-radio input[type="radio"] {
  width: 16px; height: 16px;
  accent-color: #655b55;
  cursor: pointer;
}
.cf-radio span {
  font-size: 13px;
  color: #3b3530;
}

.cf-checkbox-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}
.cf-checkbox {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  min-width: 140px;
}
.cf-checkbox input[type="checkbox"] {
  width: 15px; height: 15px;
  accent-color: #655b55;
  cursor: pointer;
  flex-shrink: 0;
}
.cf-checkbox span {
  font-size: 12px;
  color: #3b3530;
  line-height: 1.3;
}
.cf-hint {
  font-size: 11px;
  color: #b0aba7;
  margin-top: 6px;
}

.cf-questions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cf-question {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.cf-q-text {
  font-size: 12px;
  color: #3b3530;
  line-height: 1.5;
  flex: 1;
}
.cf-yn {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
  padding-top: 1px;
}

.cf-consent-intro {
  font-size: 11px;
  color: #655b55;
  font-weight: 600;
  margin-bottom: 12px;
}
.cf-consent-items p,
.cf-consent-privacy p {
  font-size: 11px;
  color: #555;
  line-height: 1.7;
  margin-bottom: 8px;
}
.cf-agree-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  cursor: pointer;
  padding: 12px;
  background: #f8f7f5;
  border-radius: 10px;
}
.cf-agree-check input {
  width: 18px; height: 18px;
  accent-color: #655b55;
  cursor: pointer;
  flex-shrink: 0;
}
.cf-agree-check span {
  font-size: 13px;
  font-weight: 700;
  color: #3b3530;
}

.cf-signature-area {
  position: relative;
  border: 1.5px solid #d4d0cc;
  border-radius: 10px;
  overflow: hidden;
  background: #fafaf8;
}
.cf-signature-canvas {
  width: 100%;
  height: 120px;
  display: block;
  touch-action: none;
}
.cf-clear-sig {
  position: absolute;
  top: 8px; right: 8px;
  background: rgba(0,0,0,0.06);
  border: none;
  font-size: 11px;
  color: #655b55;
  padding: 4px 12px;
  border-radius: 12px;
  cursor: pointer;
}

.cf-submit-btn {
  display: block;
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 14px;
  background: #3b3530;
  color: white;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.06em;
  cursor: pointer;
  margin-top: 24px;
  transition: background 0.15s;
}
.cf-submit-btn:active {
  background: #4a423d;
}
.cf-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
