<script setup lang="ts">
import { ref } from 'vue'

const result = ref<string | null>(null)

async function ping() {
  const res = await fetch('/api/ping')
  const data = await res.json()
  result.value = JSON.stringify(data, null, 2)
}
</script>

<template>
  <main class="flex flex-col items-center gap-4 p-8">
    <button @click="ping">Ping backend</button>
    <pre v-if="result">{{ result }}</pre>
  </main>
</template>
