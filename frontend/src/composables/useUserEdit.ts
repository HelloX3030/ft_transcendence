import { ApiError } from '@/api/api-error';
import { fileUrl, validateFile } from '@/lib/files';
import { useUserStore } from '@/stores/user';
import { computed, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

export function useUserEdit() {
  const userStore = useUserStore();
  const router = useRouter();
  const selectedFile = ref<File | null>(null);
  const previewUrl = ref<string | null>(null);
  const fileInput = ref<HTMLInputElement | null>(null);
  const fileError = ref('');

  const avatarSrc = computed(
    () => previewUrl.value ?? fileUrl(userStore.state?.avatarFileId) ?? null,
  );
  const initials = computed(() =>
    userStore.state ? userStore.state.username.slice(0, 2).toUpperCase() : '??',
  );
  const hasAvatar = computed(() => userStore.state?.avatarFileId != null);

  const isLoading = ref(false);
  const updateError = ref('');

  /** 0–100 while an upload is in flight, null otherwise. Drives the progress bar. */
  const uploadProgress = ref<number | null>(null);
  let uploadAbort: AbortController | null = null;
  const isUploading = computed(() => uploadProgress.value !== null);

  const languageOptions: { value: 'de' | 'en' | 'es'; label: string }[] = [
    { value: 'de', label: 'Deutsch' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
  ];

  function clearPreview() {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
    selectedFile.value = null;
  }

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    fileError.value = '';

    const problem = validateFile(file, 'avatar');
    if (problem !== null) {
      fileError.value = problem;
      clearPreview();
      // Reset the input too, or re-picking the same rejected file fires no change
      // event and the error looks stuck.
      input.value = '';
      return;
    }

    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
  }

  /** Aborts an in-flight upload; the request rejects and `update()` reports it. */
  function cancelUpload() {
    uploadAbort?.abort();
  }

  async function removeAvatar() {
    updateError.value = '';
    fileError.value = '';
    isLoading.value = true;
    try {
      clearPreview();
      await userStore.deleteAvatar();
    } catch (err: unknown) {
      updateError.value =
        err instanceof ApiError ? err.message : 'An error occurred while removing your photo';
    } finally {
      isLoading.value = false;
    }
  }

  async function update(newUser: {
    username: string;
    email: string;
    language: 'de' | 'en' | 'es';
  }) {
    updateError.value = '';
    isLoading.value = true;

    try {
      if (selectedFile.value) {
        uploadAbort = new AbortController();
        uploadProgress.value = 0;
        try {
          await userStore.uploadAvatar(selectedFile.value, {
            onProgress: (pct) => (uploadProgress.value = pct),
            signal: uploadAbort.signal,
          });
          clearPreview();
        } finally {
          uploadProgress.value = null;
          uploadAbort = null;
        }
      }

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
      // A cancelled upload is the user's own doing, not a failure to report.
      if (err instanceof DOMException && err.name === 'AbortError') {
        updateError.value = '';
        return;
      }
      updateError.value =
        err instanceof ApiError ? err.message : 'An error occurred while updating your profile';
    } finally {
      isLoading.value = false;
    }
  }

  onUnmounted(() => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  });

  return {
    languageOptions,
    selectedFile,
    previewUrl,
    fileInput,
    fileError,
    avatarSrc,
    initials,
    hasAvatar,
    isLoading,
    isUploading,
    uploadProgress,
    updateError,
    onFileChange,
    cancelUpload,
    removeAvatar,
    update,
  };
}
