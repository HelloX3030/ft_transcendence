import { ref } from 'vue';
import { userApi } from '@/api/endpoints/user';
import { useUserStore } from '@/stores/user';

export function useTotp() {
  const user = useUserStore();

  // Setup
  const isSetupDialogOpen = ref(false);
  const otpValue = ref('');
  const isVerifying = ref(false);
  const verifyError = ref(false);
  const isLoadingQrCode = ref(false);
  const qrCodeSvg = ref('');
  const qrLoadError = ref(false);

  async function openSetupDialog() {
    otpValue.value = '';
    verifyError.value = false;
    qrLoadError.value = false;
    qrCodeSvg.value = '';
    isSetupDialogOpen.value = true;
    isLoadingQrCode.value = true;
    try {
      qrCodeSvg.value = await userApi.setupTotp();
    } catch {
      qrLoadError.value = true;
    } finally {
      isLoadingQrCode.value = false;
    }
  }

  async function verifyOtp() {
    if (otpValue.value.length !== 6) return;
    isVerifying.value = true;
    verifyError.value = false;
    try {
      await user.activateTotp(otpValue.value);
      isSetupDialogOpen.value = false;
    } catch {
      verifyError.value = true;
    } finally {
      isVerifying.value = false;
    }
  }

  function downloadQrCode() {
    if (!qrCodeSvg.value) return;
    const blob = new Blob([qrCodeSvg.value], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cinemates-2fa-qrcode.svg';
    link.click();
    URL.revokeObjectURL(url);
  }

  // Disable
  const isDisableDialogOpen = ref(false);
  const isDisabling = ref(false);

  async function disableTotp() {
    isDisabling.value = true;
    try {
      await user.deleteTotp();
      isDisableDialogOpen.value = false;
    } finally {
      isDisabling.value = false;
    }
  }

  function handle2faButtonClick(is2faEnabled: boolean) {
    if (is2faEnabled) {
      isDisableDialogOpen.value = true;
    } else {
      void openSetupDialog();
    }
  }

  return {
    isSetupDialogOpen,
    otpValue,
    isVerifying,
    verifyError,
    isLoadingQrCode,
    qrCodeSvg,
    qrLoadError,
    isDisableDialogOpen,
    isDisabling,
    verifyOtp,
    downloadQrCode,
    disableTotp,
    handle2faButtonClick,
  };
}
