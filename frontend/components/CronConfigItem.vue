<template>
  <div class="grid grid-cols-12 items-center p-4 border-b gap-4">
    <!-- Channel Name -->
    <div class="col-span-4 flex items-center gap-2">
      <font-awesome-icon :icon="['fas', 'hashtag']" class="text-gray-400" />
      <span class="font-medium text-gray-800 truncate" :title="config.channelName">{{ config.channelName }}</span>
    </div>

    <!-- Schedule -->
    <div class="col-span-3">
      <input
        type="text"
        v-model="editableSchedule"
        @blur="updateSchedule"
        :disabled="isUpdating"
        class="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
        placeholder="e.g., */30 * * * * *"
      />
      <!-- Basic validation feedback (optional) -->
      <!-- <p v-if="!isScheduleValid" class="text-xs text-red-500 mt-1">Invalid cron syntax</p> -->
    </div>

    <!-- Enabled Toggle -->
    <div class="col-span-2 flex justify-center">
      <button
        @click="toggleEnabled"
        :disabled="isUpdating"
        :class="[
          'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50',
          config.enabled ? 'bg-indigo-600' : 'bg-gray-200'
        ]"
      >
        <span class="sr-only">Toggle Enabled</span>
        <span
          aria-hidden="true"
          :class="[
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200',
            config.enabled ? 'translate-x-5' : 'translate-x-0'
          ]"
        />
      </button>
    </div>

    <!-- Last Updated / Created -->
    <div class="col-span-2 text-sm text-gray-500">
      {{ formatDate(config.updatedAt || config.createdAt) }}
    </div>

    <!-- Actions -->
    <div class="col-span-1 flex justify-end">
      <button
        @click="deleteConfig"
        :disabled="isUpdating"
        class="text-red-500 hover:text-red-700 disabled:opacity-50"
        title="Delete Configuration"
      >
        <font-awesome-icon :icon="['fas', 'trash-alt']" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
// Basic cron validation (can be enhanced)
// import { validate } from 'node-cron'; // Can't use node-cron directly in browser

const props = defineProps({
  config: {
    type: Object,
    required: true,
  },
  apiBase: {
    type: String,
    required: true,
  }
});

const emit = defineEmits(['update', 'delete', 'error']);

const isUpdating = ref(false);
const editableSchedule = ref(props.config.schedule);
// const isScheduleValid = ref(true); // Basic validation flag

// Watch for external changes to the config prop
watch(() => props.config.schedule, (newSchedule) => {
  editableSchedule.value = newSchedule;
});

// --- Helper ---
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  try {
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch (e) { return 'Invalid Date'; }
}

// Basic client-side validation (very rudimentary)
// function validateSchedule(schedule) {
//   // Very basic check: expects 6 parts separated by spaces
//   return typeof schedule === 'string' && schedule.split(' ').length === 6;
// }

// --- API Calls ---
async function updateConfig(payload) {
  if (isUpdating.value) return;
  isUpdating.value = true;
  try {
    const updated = await $fetch(`${props.apiBase}/cron-configs/${props.config.id}`, {
      method: 'PUT',
      body: payload,
    });
    emit('update', updated); // Emit the updated config object
  } catch (err) {
    console.error('Error updating cron config:', err);
    emit('error', `Failed to update config: ${err.data?.message || err.message}`);
    // Revert local state if needed (e.g., toggle back)
    if ('enabled' in payload) props.config.enabled = !payload.enabled;
    if ('schedule' in payload) editableSchedule.value = props.config.schedule;
  } finally {
    isUpdating.value = false;
  }
}

async function deleteConfig() {
  if (!confirm(`Are you sure you want to delete the cron config for "${props.config.channelName}"?`)) {
    return;
  }
  if (isUpdating.value) return;
  isUpdating.value = true; // Use same flag to disable buttons during delete
  try {
    await $fetch(`${props.apiBase}/cron-configs/${props.config.id}`, {
      method: 'DELETE',
    });
    emit('delete', props.config.id); // Emit the ID of the deleted config
  } catch (err) {
    console.error('Error deleting cron config:', err);
    emit('error', `Failed to delete config: ${err.data?.message || err.message}`);
  } finally {
    isUpdating.value = false;
  }
}

// --- Actions ---
function toggleEnabled() {
  updateConfig({ enabled: !props.config.enabled });
}

function updateSchedule() {
  const newSchedule = editableSchedule.value.trim();
  // isScheduleValid.value = validateSchedule(newSchedule); // Basic validation
  // if (!isScheduleValid.value) {
  //   emit('error', 'Invalid cron schedule format. Please use 6 space-separated values (e.g., * * * * * *).');
  //   editableSchedule.value = props.config.schedule; // Revert
  //   return;
  // }

  if (newSchedule !== props.config.schedule) {
    updateConfig({ schedule: newSchedule });
  }
}
</script>

<style scoped>
/* Add any specific styles if needed */
</style>