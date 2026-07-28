import { ApiError } from '@/api/api-error';
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
      if (!(err instanceof ApiError)) {
        errorMessage.value = 'Could not reach the server.';
      } else {
        // The backend answers a wrong email and a wrong password identically,
        // on purpose — do not narrow this message down to one of the two.
        errorMessage.value =
          err.status === 403
            ? 'Invalid email or password.'
            : err.message || 'Something went wrong.';
      }
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
