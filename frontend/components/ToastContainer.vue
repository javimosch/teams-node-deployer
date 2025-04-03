<template>
  <div aria-live="assertive" class="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-[60]">
    <div class="w-full flex flex-col items-center space-y-4 sm:items-end">
      <ToastNotification
        v-for="toast in toasts"
        :key="toast.id"
        :id="toast.id"
        :type="toast.type"
        :title="toast.title"
        :message="toast.message"
        :duration="toast.duration"
        @close="removeToast"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ToastNotification from './ToastNotification.vue';

const toasts = ref([]);
let toastIdCounter = 0;

function addToast({ type = 'info', title, message, duration = 3000 }) {
  const id = toastIdCounter++;
  toasts.value.push({ id, type, title, message, duration });
}

function removeToast(id) {
  toasts.value = toasts.value.filter(toast => toast.id !== id);
}

// Expose the addToast method to be used by the parent page
defineExpose({
  addToast,
});
</script>