<script setup lang="ts">
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'vue-sonner';

const name = ref('');
const email = ref('');
const message = ref('');

function handleSubmit() {
  toast.success('Message sent!', {
    description: "We'll get back to you soon.",
  });
  name.value = '';
  email.value = '';
  message.value = '';
}
</script>

<template>
  <div class="min-h-screen flex items-start justify-center p-6 pt-12">
    <div class="w-full max-w-2xl flex flex-col gap-8">

      <!-- Header -->
      <div>
        <h1 class="text-3xl font-bold">Help & Contact</h1>
        <p class="text-muted-foreground mt-2">Have a question or issue? Send us a message and we'll get back to you.</p>
      </div>

      <!-- Form -->
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <Label for="name">Name</Label>
          <Input id="name" v-model="name" type="text" placeholder="Your name" />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="email">Email</Label>
          <Input id="email" v-model="email" type="email" placeholder="your@email.com" />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="message">Message</Label>
          <Textarea
            id="message"
            v-model="message"
            placeholder="Describe your issue or question in detail..."
            rows="8"
          />
        </div>

        <Button
          class="w-full py-3 text-base"
          @click="handleSubmit"
          :disabled="!name || !email || !message"
        >
          Send Message
        </Button>
      </div>

    </div>
  </div>
</template>