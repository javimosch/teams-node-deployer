<template>
  <div class="mt-12">
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">Channel Polling Cron Jobs</h2>

    <!-- Add Form -->
    <CronConfigForm
      :api-base="apiBase"
      @add="handleConfigAdded"
      @error="handleError"
      class="mb-8"
    />

    <!-- List Header -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
       <div class="grid grid-cols-12 bg-gray-100 p-4 border-b text-sm font-medium text-gray-600 gap-2 md:gap-4">
         <div class="col-span-12 md:col-span-3">Channel</div>
         <div class="col-span-6 md:col-span-2">Schedule</div>
         <div class="col-span-6 md:col-span-2">Trigger Word</div>
         <div class="col-span-2 md:col-span-1 text-center">Enabled</div>
         <div class="col-span-5 md:col-span-2">Last Updated</div>
         <div class="col-span-5 md:col-span-2 text-right">Actions</div>
       </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="p-4 text-center text-gray-500">
        Loading cron configurations...
      </div>

      <!-- Empty State -->
      <div v-else-if="cronConfigs.length === 0" class="p-4 text-center text-gray-500">
        No channel-specific cron jobs configured. Add one above.
        <p v-if="legacyCronInfo" class="text-xs mt-1">(Legacy fallback active: {{ legacyCronInfo }})</p>
      </div>

      <!-- List Items -->
      <div v-else>
        <CronConfigItem
          v-for="config in cronConfigs"
          :key="config.id"
          :config="config"
          :api-base="apiBase"
          @update="handleConfigUpdated"
          @delete="handleConfigDeleted"
          @error="handleError"
        />
         <div v-if="legacyCronInfo" class="p-2 text-center text-xs text-gray-500 border-t">
             (Legacy fallback active: {{ legacyCronInfo }})
         </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import CronConfigItem from './CronConfigItem.vue';
import CronConfigForm from './CronConfigForm.vue';

const props = defineProps({
  apiBase: {
    type: String,
    required: true,
  }
});

const emit = defineEmits(['error', 'success']);

const cronConfigs = ref([]);
const isLoading = ref(false);
const legacyCronInfo = ref(null);

async function fetchCronConfigs() {
  isLoading.value = true;
  try {
    const data = await $fetch(`${props.apiBase}/cron-configs`);
    cronConfigs.value = data || [];
    const hasEnabledDynamicConfig = cronConfigs.value.some(c => c.enabled);
    if (!hasEnabledDynamicConfig && !process.env.NUXT_PUBLIC_DISABLE_LEGACY_CRON) {
        legacyCronInfo.value = `CHAT_ID ${process.env.NUXT_PUBLIC_LEGACY_CHAT_ID || '?'}`;
    } else {
        legacyCronInfo.value = null;
    }
  } catch (err) {
    console.error('Error fetching cron configs:', err);
    emit('error', `Failed to load cron configs: ${err.data?.message || err.message}`);
    cronConfigs.value = [];
    legacyCronInfo.value = null;
  } finally {
    isLoading.value = false;
  }
}

function handleConfigAdded(newConfig) {
  cronConfigs.value.push(newConfig);
  emit('success', `Cron config for "${newConfig.channelName}" added.`);
  fetchCronConfigs();
}

function handleConfigUpdated(updatedConfig) {
  const index = cronConfigs.value.findIndex(c => c.id === updatedConfig.id);
  if (index !== -1) {
    cronConfigs.value[index] = updatedConfig;
    emit('success', `Cron config for "${updatedConfig.channelName}" updated.`);
  }
  fetchCronConfigs();
}

function handleConfigDeleted(deletedId) {
  const index = cronConfigs.value.findIndex(c => c.id === deletedId);
  if (index !== -1) {
      const deletedName = cronConfigs.value[index].channelName;
      cronConfigs.value.splice(index, 1);
      emit('success', `Cron config for "${deletedName}" deleted.`);
  }
  fetchCronConfigs();
}

function handleError(errorMessage) {
  emit('error', errorMessage);
}

function handleSuccess(message, title = null) {
    emit('success', message, title);
}

onMounted(() => {
  fetchCronConfigs();
});
</script>