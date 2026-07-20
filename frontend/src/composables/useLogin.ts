import { useAuthStore } from '@/stores/auth';
import { onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

export function useLogin() {
  const authStore = useAuthStore();
  const router = useRouter();

  const mfaRequired = ref(false);
  const errorMessage = ref<string | null>(null);
  const otpVerifyLoading = ref(false);
  const pendingCredentials = ref<{ email: string; password: string } | null>(null);

  async function login(email: string, password: string) {
    errorMessage.value = null;
    try {
      const result = await authStore.login({ email, password }); // ← Store, nicht API
      if (result?.mfaRequired) {
        pendingCredentials.value = { email, password };
        mfaRequired.value = true;
      } else {
        router.push('/');
      }
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      errorMessage.value =
        e?.status === 403 ? 'Invalid email or password.' : (e?.message ?? 'Something went wrong.');
    }
  }

  async function verifyOtp(otp: string) {
    if (!pendingCredentials.value) return;
    errorMessage.value = null;
    otpVerifyLoading.value = true;
    try {
      await authStore.login({ ...pendingCredentials.value, otp }); // ← Store
      router.push('/');
    } catch {
      errorMessage.value = 'Invalid code. Please try again.';
    } finally {
      otpVerifyLoading.value = false;
    }
  }

  function resetOtp() {
    mfaRequired.value = false;
    errorMessage.value = null;
    pendingCredentials.value = null;
  }

  onUnmounted(resetOtp); //TODO: do i need it really ??
  return { mfaRequired, errorMessage, otpVerifyLoading, login, verifyOtp, resetOtp };
}
