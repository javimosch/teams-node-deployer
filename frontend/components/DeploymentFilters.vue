<template>
  <div class="bg-white rounded-lg shadow p-4 mb-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
      <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
        <font-awesome-icon :icon="['fas', 'filter']" class="text-indigo-500" />
        Deployment Filters
      </h3>
      <button @click="resetFilters" class="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
        <font-awesome-icon :icon="['fas', 'redo']" />
        Reset Filters
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Status Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <div class="flex flex-wrap gap-2">
          <button 
            v-for="status in statuses" 
            :key="status.value"
            @click="toggleStatus(status.value)"
            class="px-3 py-1 text-xs rounded-full flex items-center gap-1"
            :class="[
              selectedStatuses.includes(status.value) 
                ? status.activeClass 
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            ]"
          >
            <font-awesome-icon :icon="['fas', status.icon]" />
            {{ status.label }}
            <span v-if="selectedStatuses.includes(status.value)" class="ml-1">
              <font-awesome-icon :icon="['fas', 'check']" />
            </span>
          </button>
        </div>
      </div>

      <!-- Date Range Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
        <select 
          v-model="selectedDateRange" 
          class="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
      </div>

      <!-- Other Filters -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Display Options</label>
        <div class="flex flex-wrap gap-2">
          <button 
            @click="toggleOnlyActionable"
            class="px-3 py-1 text-xs rounded-full flex items-center gap-1"
            :class="onlyActionable ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
          >
            <font-awesome-icon :icon="['fas', 'tasks']" />
            Only Actionable
            <span v-if="onlyActionable" class="ml-1">
              <font-awesome-icon :icon="['fas', 'check']" />
            </span>
          </button>
          <button 
            @click="toggleMaxItems"
            class="px-3 py-1 text-xs rounded-full flex items-center gap-1"
            :class="limitedItems ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
          >
            <font-awesome-icon :icon="['fas', 'compress']" />
            Limited View ({{ maxItems }})
            <span v-if="limitedItems" class="ml-1">
              <font-awesome-icon :icon="['fas', 'check']" />
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, defineEmits } from 'vue';

const emit = defineEmits(['filter-change']);

// Status filter
const statuses = [
  { value: 'pending', label: 'Pending', icon: 'clock', activeClass: 'bg-blue-100 text-blue-700' },
  { value: 'processing', label: 'Processing', icon: 'spinner', activeClass: 'bg-yellow-100 text-yellow-700' },
  { value: 'ready', label: 'Ready', icon: 'check-circle', activeClass: 'bg-green-100 text-green-700' },
  { value: 'failed', label: 'Failed', icon: 'exclamation-circle', activeClass: 'bg-red-100 text-red-700' },
  { value: 'skipped', label: 'Skipped', icon: 'arrow-right', activeClass: 'bg-gray-100 text-gray-700' },
  { value: 'deployed', label: 'Deployed', icon: 'rocket', activeClass: 'bg-purple-100 text-purple-700' },
  { value: 'canceled', label: 'Canceled', icon: 'ban', activeClass: 'bg-gray-100 text-gray-700' },
];

const selectedStatuses = ref([]);
const selectedDateRange = ref('all');
const onlyActionable = ref(true);
const limitedItems = ref(true);
const maxItems = ref(10);

// Helper function to toggle status selection
function toggleStatus(status) {
  console.log('DeploymentFilters.vue toggleStatus', { status });
  
  if (selectedStatuses.value.includes(status)) {
    selectedStatuses.value = selectedStatuses.value.filter(s => s !== status);
  } else {
    selectedStatuses.value.push(status);
  }
}

function toggleOnlyActionable() {
  console.log('DeploymentFilters.vue toggleOnlyActionable', { current: onlyActionable.value });
  onlyActionable.value = !onlyActionable.value;
}

function toggleMaxItems() {
  console.log('DeploymentFilters.vue toggleMaxItems', { current: limitedItems.value });
  limitedItems.value = !limitedItems.value;
}

function resetFilters() {
  console.log('DeploymentFilters.vue resetFilters');
  selectedStatuses.value = [];
  selectedDateRange.value = 'all';
  onlyActionable.value = true;
  limitedItems.value = true;
}

// Watch for filter changes and emit events
watch([selectedStatuses, selectedDateRange, onlyActionable, limitedItems], () => {
  console.log('DeploymentFilters.vue filter change', { 
    statuses: selectedStatuses.value, 
    dateRange: selectedDateRange.value,
    onlyActionable: onlyActionable.value,
    limitedItems: limitedItems.value
  });
  
  emit('filter-change', {
    statuses: selectedStatuses.value,
    dateRange: selectedDateRange.value,
    onlyActionable: onlyActionable.value,
    limitedItems: limitedItems.value,
    maxItems: maxItems.value
  });
}, { deep: true });

// Initialize with default filters
resetFilters();
</script>
