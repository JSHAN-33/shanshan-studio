import { ref } from 'vue';
import liff from '@line/liff';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api/auth';

const ready = ref(false);
const isStub = ref(false);
const liffInited = ref(false);
const inLineClient = ref(false);
const liffError = ref('');

export function useLiff() {
  const auth = useAuthStore();

  async function initLiff() {
    if (ready.value) return;
    const liffId = import.meta.env.VITE_LIFF_ID;

    if (!liffId) {
      console.info('[useLiff] VITE_LIFF_ID 未設定，改用手動填單模式');
      auth.setProfile({
        userId: null,
        displayName: null,
        pictureUrl: null,
        isStub: true,
      });
      isStub.value = true;
      ready.value = true;
      return;
    }

    try {
      await liff.init({ liffId });
      liffInited.value = true;
      inLineClient.value = liff.isInClient();

      // 如果已經登入 LINE，直接處理
      if (liff.isLoggedIn()) {
        await handleLineProfile();
        return;
      }

      // 如果在 LIFF 瀏覽器內但未登入，自動登入
      if (liff.isInClient()) {
        liff.login({ redirectUri: window.location.origin + '/' });
        return;
      }

      // 外部瀏覽器：不自動跳轉，等使用者點按鈕
      ready.value = true;
    } catch (err: any) {
      liffError.value = `LIFF init error: ${err?.message || err}`;
      console.error('[useLiff] LIFF init failed，降級為手動模式', err);
      auth.setProfile({
        userId: null,
        displayName: null,
        pictureUrl: null,
        isStub: true,
      });
      isStub.value = true;
      ready.value = true;
    }
  }

  async function handleLineProfile() {
    const profile = await liff.getProfile();
    const result = await authApi.lineLogin(profile.userId, profile.pictureUrl ?? null);

    if (result.registered && result.member) {
      auth.setProfile({
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl ?? null,
        isStub: false,
        needsRegister: false,
      });
      auth.setCustomer({
        name: result.member.name,
        phone: result.member.phone,
        bday: result.member.bday ?? null,
      });
    } else {
      auth.setProfile({
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl ?? null,
        isStub: false,
        needsRegister: true,
      });
    }
    ready.value = true;
  }

  function loginWithLine() {
    if (liffInited.value) {
      liff.login({ redirectUri: window.location.origin + '/' });
    }
  }

  return { ready, isStub, liffInited, inLineClient, liffError, initLiff, loginWithLine };
}
