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
  // The backend's challenge token, held between the two login steps. It stands
  // in for the password, which is never kept and never sent twice.
  const pendingMfaToken = ref<string | null>(null);

  async function login(email: string, password: string) {
    errorMessage.value = null;
    try {
      const result = await authStore.login({ email, password });
      if (result?.mfaRequired) {
        pendingMfaToken.value = result.mfaToken ?? null;
        mfaRequired.value = true;
      } else {
        router.push('/');
      }
    } catch (err: unknown) {
      if (!(err instanceof ApiError)) {
        errorMessage.value = 'Could not reach the server.';
      } else {
        // The backend answers a wrong email and a wrong password identically,
        // on purpose, do not narrow this message down to one of the two.
        errorMessage.value =
          err.status === 403
            ? 'Invalid email or password.'
            : err.message || 'Something went wrong.';
      }
    }
  }

  async function verifyOtp(otp: string) {
    if (!pendingMfaToken.value) return;
    errorMessage.value = null;
    otpVerifyLoading.value = true;
    try {
      await authStore.verifyMfa({ mfaToken: pendingMfaToken.value, otp });
      router.push('/');
    } catch {
      // The challenge token expires after a few minutes, and the backend cannot
      // tell the user which of the two went stale without leaking whether the
      // token was valid, so the message has to cover both.
      errorMessage.value = 'Invalid or expired code. Please try again.';
    } finally {
      otpVerifyLoading.value = false;
    }
  }

  function resetOtp() {
    mfaRequired.value = false;
    errorMessage.value = null;
    pendingMfaToken.value = null;
  }

  // The challenge token is a live credential until it expires; drop it with the
  // form rather than leaving it in memory.
  onUnmounted(resetOtp);
  return { mfaRequired, errorMessage, otpVerifyLoading, login, verifyOtp, resetOtp };
}
