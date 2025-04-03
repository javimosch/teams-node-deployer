<template>
  <transition
    enter-active-class="transform ease-out duration-300 transition"
    enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
    enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
    leave-active-class="transition ease-in duration-100"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="visible" :class="['max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden', containerClass]">
      <div class="p-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <font-awesome-icon :icon="['fas', icon]" :class="iconClass" aria-hidden="true" />
          </div>
          <div class="ml-3 w-0 flex-1 pt-0.5">
            <p class="text-sm font-medium text-gray-900">{{ title }}</p>
            <p class="mt-1 text-sm text-gray-500">{{ message }}</p>
          </div>
          <div class="ml-4 flex-shrink-0 flex">
            <button @click="close" class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              <span class="sr-only">Close</span>
              <font-awesome-icon :icon="['fas', 'times']" class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  id: { type: [String, Number], required: true },
  type: { type: String, default: 'success' }, // 'success', 'error', 'info', 'warning'
  title: { type: String, required: true },
  message: { type: String, required: true },
  duration: { type: Number, default: 3000 }, // Duration in ms, 0 for persistent
});

const emit = defineEmits(['close']);

const visible = ref(false);
let timeoutId = null;

const typeMap = {
  success: { icon: 'check-circle', iconClass: 'text-green-400', containerClass: '' },
  error: { icon: 'times-circle', iconClass: 'text-red-400', containerClass: '' },
  warning: { icon: 'exclamation-triangle', iconClass: 'text-yellow-400', containerClass: '' },
  info: { icon: 'info-circle', iconClass: 'text-blue-400', containerClass: '' },
};

const icon = computed(() => typeMap[props.type]?.icon || 'info-circle');
const iconClass = computed(() => typeMap[props.type]?.iconClass || 'text-gray-400');
const containerClass = computed(() => typeMap[props.type]?.containerClass || '');

function close() {
  if (timeoutId) clearTimeout(timeoutId);
  visible.value = false;
  // Allow time for fade-out animation before emitting close
  setTimeout(() => {
    emit('close', props.id);
  }, 150); // Slightly longer than leave duration
}

onMounted(() => {
  visible.value = true;
  if (props.duration > 0) {
    timeoutId = setTimeout(close, props.duration);
  }
});

// Clear timeout on unmount
import { onUnmounted } from 'vue';
onUnmounted(() => {
  if (timeoutId) clearTimeout(timeoutId);
});
</script>