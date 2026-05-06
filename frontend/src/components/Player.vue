<script setup lang="ts">
interface PropsType {
  url: string;
  key?: string;
}

defineProps<PropsType>();
</script>

<template>
  <AspectRatio :ratio="16 / 9">
    <iframe
      width="100%"
      height="100%"
      :src="url"
      title="YouTube video player"
      frameborder="0"
      allow="
        accelerometer;
        autoplay;
        clipboard-write;
        encrypted-media;
        gyroscope;
        picture-in-picture;
      "
      allowfullscreen
    >
    </iframe
  ></AspectRatio>
</template>
