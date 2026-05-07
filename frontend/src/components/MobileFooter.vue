<script lang="ts" setup>
import { Button } from "./ui/button";

import { ThumbsDown, ThumbsUp } from "lucide-vue-next";
</script>

<template>
  <footer class="h-16 flex items-center justify-evenly border-t-2">
    <Button variant="outline">
      <div class="flex flex-col items-center">
        <ThumbsDown />
      </div>
    </Button>

    <Button variant="outline">
      <div class="flex flex-col items-center">
        <ThumbsUp />
      </div>
    </Button>
  </footer>
</template>
