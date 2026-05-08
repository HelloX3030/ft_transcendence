<script setup lang="ts">
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";
import Button from "./ui/button/Button.vue";
import { Play, Volume2, VolumeOff } from "lucide-vue-next";
import { ref } from "vue";

const volume = ref(false);
</script>

<template>
  <ButtonGroup orientation="vertical" class="absolute z-30 top-1/2 right-4">
    <Button variant="outline"> <Play /></Button>
    <Button
      @click="
        () => {
          volume = !volume;
          $emit('volume-event');
        }
      "
      variant="outline"
    >
      <Volume2 v-if="volume" />
      <VolumeOff v-else />
    </Button>
  </ButtonGroup>
</template>
