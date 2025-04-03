<template>
  <div :class="['bg-white rounded-lg shadow p-4 border-l-4', borderColorClass]">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-500">{{ label }}</p>
        <p class="text-2xl font-semibold text-gray-800">{{ count }}</p>
      </div>
      <div :class="['p-3 rounded-full', iconBgColorClass]">
        <font-awesome-icon :icon="['fas', icon]" :class="iconTextColorClass" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    required: true,
  },
  icon: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    default: 'gray', // e.g., 'blue', 'green', 'red', 'purple', 'gray'
  },
});

const colorMap = {
  blue: { border: 'border-blue-500', bg: 'bg-blue-100', text: 'text-blue-600' },
  gray: { border: 'border-gray-500', bg: 'bg-gray-100', text: 'text-gray-600' },
  red: { border: 'border-red-500', bg: 'bg-red-100', text: 'text-red-600' },
  green: { border: 'border-green-500', bg: 'bg-green-100', text: 'text-green-600' },
  purple: { border: 'border-purple-500', bg: 'bg-purple-100', text: 'text-purple-600' },
  yellow: { border: 'border-yellow-500', bg: 'bg-yellow-100', text: 'text-yellow-600' }, // Added yellow for processing if needed
  // Add other colors as needed
};

const selectedColor = computed(() => colorMap[props.color] || colorMap.gray);

const borderColorClass = computed(() => selectedColor.value.border);
const iconBgColorClass = computed(() => selectedColor.value.bg);
const iconTextColorClass = computed(() => selectedColor.value.text);
</script>