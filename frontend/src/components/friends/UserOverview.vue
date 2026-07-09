<script setup lang="ts">
import { Card, CardHeader } from '../ui/card';

interface Props {
  username: string;
  id: number;
  image?: string;
}
defineProps<Props>();
</script>

<template>
  <Card>
    <CardHeader>{{ username }} </CardHeader>
  </Card>
</template>
