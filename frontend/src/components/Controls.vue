<script setup lang="ts">
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";
import Button from "./ui/button/Button.vue";
import { Play, Volume2, VolumeOff } from "lucide-vue-next";
import { ref } from "vue";
import { useVideoPlayer } from "@/composables/useVideoPlayer";

const { toggleVolume, isMuted } = useVideoPlayer();
</script>

<template>
  <ButtonGroup
    orientation="vertical"
    class="absolute z-30 top-1/2 right-4 -translate-y-1/2"
  >
    <Button variant="outline"> <Play /></Button>
    <Button @click="toggleVolume" variant="outline">
      <VolumeOff v-if="isMuted" />
      <Volume2 v-else />
    </Button>
  </ButtonGroup>
</template>
