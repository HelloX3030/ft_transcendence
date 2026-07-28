import { ApiError } from '@/api/api-error';
import { useUserStore } from '@/stores/user';
import { computed, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

export function useUserEdit() {
  const userStore = useUserStore();
  const router = useRouter();
  const selectedFile = ref<File | null>(null);
  const previewUrl = ref<string | null>(null);
  const fileInput = ref<HTMLInputElement | null>(null);

  const avatarSrc = computed(() => previewUrl.value ?? userStore.state?.image ?? null);
  const initials = computed(() =>
    userStore.state ? userStore.state.username.slice(0, 2).toUpperCase() : '??',
  );

  const isLoading = ref(false);
  const updateError = ref('');

  const languageOptions: { value: 'de' | 'en' | 'es'; label: string }[] = [
    { value: 'de', label: 'Deutsch' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
  ];

  function onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
  }

  onUnmounted(() => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  });

  async function update(newUser: {
    username: string;
    email: string;
    language: 'de' | 'en' | 'es';
  }) {
    updateError.value = '';
    isLoading.value = true;

    try {
      if (selectedFile.value) await userStore.uploadAvatar(selectedFile.value);

      const original = {
        username: userStore.state?.username ?? '',
        email: userStore.state?.email ?? '',
        language: userStore.state?.language ?? 'en',
      };

      const hasChanged =
        newUser.username !== original.username ||
        newUser.email !== original.email ||
        newUser.language !== original.language;

      if (hasChanged) await userStore.updateUser(newUser);

      await router.push('/profile');
    } catch (err: unknown) {
      updateError.value =
        err instanceof ApiError ? err.message : 'An error occurred while updating your profile';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    languageOptions,
    selectedFile,
    previewUrl,
    fileInput,
    avatarSrc,
    initials,
    isLoading,
    updateError,
    onFileChange,
    update,
  };
}
