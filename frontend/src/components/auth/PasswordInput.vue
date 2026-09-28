<script setup lang="ts">
import { ref } from 'vue';
import { Eye, EyeOff } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';

/**
 * A password field with its own reveal control, inside the field.
 *
 * Required rather than defaulted: the browser's password manager treats
 * `current-password` and `new-password` differently, and every call site knows
 * which of the two it is.
 */
defineProps<{ autocomplete: 'current-password' | 'new-password' }>();

const model = defineModel<string>();

// vee-validate's `componentField` spreads `name` and `onBlur` alongside the
// model. Those belong on the input, not on the group's wrapping div, so the
// fallthrough is routed by hand.
defineOptions({ inheritAttrs: false });

const visible = ref(false);

/** Called by the form on submit: a failed submit must not leave plaintext up. */
function mask() {
  visible.value = false;
}

defineExpose({ mask });
</script>

<template>
  <InputGroup>
    <!-- Before $attrs, so a call site can still pass its own placeholder. -->
    <InputGroupInput
      placeholder="••••••••••••"
      v-bind="$attrs"
      v-model="model"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
    />
    <InputGroupAddon align="inline-end">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        :aria-label="visible ? 'Hide password' : 'Show password'"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        <EyeOff v-if="visible" />
        <Eye v-else />
      </Button>
    </InputGroupAddon>
  </InputGroup>
</template>
