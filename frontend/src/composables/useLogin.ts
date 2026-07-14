import { useAuthStore } from '@/stores/auth';
import { onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

export function useLogin() {
  const auth = useAuthStore();
  const router = useRouter();

  const mfaRequired = ref(false);
  const errorMessage = ref<string | null>(null);
  const otpVerifyLoading = ref(false);
  const pendingEmail = ref('');
  const pendingPassword = ref('');

  async function login(email: string, password: string) {
    errorMessage.value = null;
    try {
      const result = await auth.login({ email, password });
      if (result.mfaRequired) {
        pendingEmail.value = email;
        pendingPassword.value = password;
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
    errorMessage.value = null;
    otpVerifyLoading.value = true;
    try {
      await auth.login({ email: pendingEmail.value, password: pendingPassword.value, otp });
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
    pendingPassword.value = '';
    pendingEmail.value = '';
  }

  onUnmounted(resetOtp);
  return { mfaRequired, errorMessage, otpVerifyLoading, login, verifyOtp, resetOtp };
}
