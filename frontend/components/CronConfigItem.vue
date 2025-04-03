<template>
  <div class="grid grid-cols-12 items-center p-4 border-b gap-2 md:gap-4">
    <!-- Channel Name -->
    <div class="col-span-12 md:col-span-3 flex items-center gap-2">
      <font-awesome-icon :icon="['fas', 'hashtag']" class="text-gray-400" />
      <span class="font-medium text-gray-800 truncate" :title="config.channelName">{{ config.channelName }}</span>
    </div>

    <!-- Schedule -->
    <div class="col-span-6 md:col-span-2">
      <input
        type="text"
        v-model="editableSchedule"
        @blur="updateSchedule"
        :disabled="isUpdating || isTesting"
        class="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
        placeholder="e.g., */30 * * * * *"
      />
    </div>

    <!-- Message Pattern -->
    <div class="col-span-6 md:col-span-2">
      <input
        type="text"
        v-model="editableMessagePattern"
        @blur="updateMessagePattern"
        :disabled="isUpdating || isTesting"
        class="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
        placeholder="Default (e.g., deploy, release)"
      />
    </div>

    <!-- Enabled Toggle -->
    <div class="col-span-2 md:col-span-1 flex justify-center">
      <button
        @click="toggleEnabled"
        :disabled="isUpdating || isTesting"
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
    <div class="col-span-5 md:col-span-2 text-sm text-gray-500 truncate">
      {{ formatDate(config.updatedAt || config.createdAt) }}
    </div>

    <!-- Actions -->
    <div class="col-span-5 md:col-span-2 flex justify-end items-center space-x-3">
      <button
        @click="testChannel"
        :disabled="isUpdating || isTesting"
        class="text-blue-500 hover:text-blue-700 disabled:opacity-50"
        title="Test Channel Fetch"
      >
        <font-awesome-icon :icon="['fas', isTesting ? 'spinner' : 'vial']" :spin="isTesting" />
      </button>
      <button
        @click="deleteConfig"
        :disabled="isUpdating || isTesting"
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

const emit = defineEmits(['update', 'delete', 'error', 'success']);

const isUpdating = ref(false);
const isTesting = ref(false);
const editableSchedule = ref(props.config.schedule);
const editableMessagePattern = ref(props.config.messagePattern || '');

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  try {
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch (e) { return 'Invalid Date'; }
}

async function updateConfig(payload) {
  if (isUpdating.value) return;
  isUpdating.value = true;
  try {
    const updated = await $fetch(`${props.apiBase}/cron-configs/${props.config.id}`, {
      method: 'PUT',
      body: payload,
    });
    emit('update', updated);
  } catch (err) {
    console.error('Error updating cron config:', err);
    emit('error', `Failed to update config: ${err.data?.message || err.message}`);
    if ('enabled' in payload) props.config.enabled = !payload.enabled;
    if ('schedule' in payload) editableSchedule.value = props.config.schedule;
    if ('messagePattern' in payload) editableMessagePattern.value = props.config.messagePattern || '';
  } finally {
    isUpdating.value = false;
  }
}

async function deleteConfig() {
  if (!confirm(`Are you sure you want to delete the cron config for "${props.config.channelName}"?`)) {
    return;
  }
  if (isUpdating.value) return;
  isUpdating.value = true;
  try {
    await $fetch(`${props.apiBase}/cron-configs/${props.config.id}`, {
      method: 'DELETE',
    });
    emit('delete', props.config.id);
  } catch (err) {
    console.error('Error deleting cron config:', err);
    emit('error', `Failed to delete config: ${err.data?.message || err.message}`);
  } finally {
    isUpdating.value = false;
  }
}

async function testChannel() {
  if (isUpdating.value || isTesting.value) return;
  isTesting.value = true;
  try {
    const result = await $fetch(`${props.apiBase}/cron-configs/${props.config.id}/test`, {
      method: 'POST',
    });

    let toastMessage = result.message;
    if (result.details) {
      const cleanContent = result.details.content.replace(/<[^>]*>?/gm, '');
      toastMessage += `\nFrom: ${result.details.from}\nContent: ${cleanContent.substring(0, 100)}${cleanContent.length > 100 ? '...' : ''}`;
    }
    emit('success', toastMessage, 'Channel Test Result');

  } catch (err) {
    console.error('Error testing cron config:', err);
    emit('error', `Failed to test channel "${props.config.channelName}": ${err.data?.message || err.message}`);
  } finally {
    isTesting.value = false;
  }
}

function toggleEnabled() {
  updateConfig({ enabled: !props.config.enabled });
}

function updateSchedule() {
  const newSchedule = editableSchedule.value.trim();
  if (newSchedule !== props.config.schedule) {
    updateConfig({ schedule: newSchedule });
  }
}

function updateMessagePattern() {
  const newPattern = editableMessagePattern.value.trim();
  if (newPattern !== (props.config.messagePattern || '')) {
    updateConfig({ messagePattern: newPattern || null });
  }
}
</script>

<style scoped>
</style>