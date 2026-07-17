import { ref } from 'vue';

export function useEditorSelection() {
  const selectedEditors = ref<number[]>([]);

  function addEditor(id: number) {
    if (selectedEditors.value.includes(id)) removeEditor(id);
    else selectedEditors.value.push(id);
  }

  function removeEditor(id: number) {
    const index = selectedEditors.value.indexOf(id);
    if (index < 0) return;
    selectedEditors.value.splice(index, 1);
  }

  function clear() {
    selectedEditors.value = [];
  }

  return { selectedEditors, addEditor, removeEditor, clear };
}
