import { ref } from 'vue';

export interface UserInfo {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

// Response-Shape as in UserProfileView.vue
interface PublicProfile {
  id: number;
  username: string;
  image: string | null;
}

const userCache = ref<Record<string, UserInfo>>({});
const userLoading = ref<Record<string, boolean>>({});

async function fetchUserById(id: string): Promise<UserInfo | null> {
  try {
    const res = await fetch(`/v1/users/${id}`, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data: PublicProfile = await res.json();
    return {
      id: String(data.id),
      displayName: data.username,
      avatarUrl: data.image ?? undefined,
    };
  } catch {
    return null;
  }
}

export function useUserResolver() {
  async function ensureUser(id: string) {
    if (userCache.value[id] || userLoading.value[id]) return;
    userLoading.value[id] = true;
    try {
      const user = await fetchUserById(id);
      if (user) {
        userCache.value[id] = user;
      }
    } finally {
      userLoading.value[id] = false;
    }
  }

  return { userCache, userLoading, ensureUser };
}
