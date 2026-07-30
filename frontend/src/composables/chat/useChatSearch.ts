import { computed, ref } from 'vue';
import { useFilter } from 'reka-ui';
import { storeToRefs } from 'pinia';
import { useChatStore } from '@/stores/chat';
import { useFriendsStore } from '@/stores/friends';

export function useChatSearch() {
  const chatStore = useChatStore();
  const { orderedChats } = storeToRefs(chatStore);
  const friendsStore = useFriendsStore();
  const { friendsDetails } = storeToRefs(friendsStore);

  const searchTerm = ref('');
  const { contains } = useFilter({ sensitivity: 'base' });

  const filteredChats = computed(() => {
    const term = searchTerm.value.trim();
    if (!term) return orderedChats.value;
    return orderedChats.value.filter((chat) => contains(chat.friend.username, term));
  });

  const filteredFriendsWithoutChat = computed(() => {
    const term = searchTerm.value.trim();
    if (!term) return [];
    return friendsDetails.value.filter(
      (f) => contains(f.username, term) && !chatStore.getChat(f.id),
    );
  });

  function clearSearch() {
    searchTerm.value = '';
  }

  return { searchTerm, filteredChats, filteredFriendsWithoutChat, clearSearch };
}
