// src/composables/useUserResolver.ts
import { ref } from 'vue';

export interface UserInfo {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

// TODO: Sobald der Users/Friends-Store vom Kollegen verfügbar ist,
// diesen Composable-Inhalt durch einen Aufruf von useUsersStore() ersetzen.
// Die Rückgabe-Signatur (userCache, userLoading, ensureUser) versuchen wir
// dann möglichst 1:1 beizubehalten, damit ChatView.vue sich kaum ändert.

const userCache = ref<Record<string, UserInfo>>({});
const userLoading = ref<Record<string, boolean>>({});

async function mockFetchUser(id: string): Promise<UserInfo> {
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
  const names: Record<string, string> = {
    'user-1': 'Lena',
    'user-2': 'Tom',
    'user-3': 'Sara',
    'user-4': 'Max',
    'user-5': 'Nina',
  };
  return { id, displayName: names[id] ?? `User ${id}` };
}

export function useUserResolver() {
  async function ensureUser(id: string) {
    if (userCache.value[id] || userLoading.value[id]) return;
    userLoading.value[id] = true;
    try {
      userCache.value[id] = await mockFetchUser(id);
    } finally {
      userLoading.value[id] = false;
    }
  }

  return { userCache, userLoading, ensureUser };
}
