<template>
  <form @submit.prevent="addConfig" class="p-4 border rounded-lg bg-gray-50 space-y-4">
    <h3 class="text-lg font-medium text-gray-700">Add New Channel Cron</h3>

    <!-- Channel Autocomplete -->
    <div class="relative">
      <label for="channel-search" class="block text-sm font-medium text-gray-700">Select Channel</label>
      <input
        id="channel-search"
        type="text"
        v-model="channelSearchTerm"
        @input="fetchChannelsDebounced"
        @focus="showSuggestions = true"
        @blur="hideSuggestionsDebounced"
        :disabled="isSubmitting || isLoadingChannels"
        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
        placeholder="Search for a channel or chat..."
        autocomplete="off"
      />
      <div v-if="isLoadingChannels" class="absolute inset-y-0 right-0 flex items-center pr-3">
         <font-awesome-icon :icon="['fas', 'spinner']" spin class="text-gray-400" />
      </div>
      <!-- Suggestions Dropdown -->
      <ul
        v-if="showSuggestions && filteredChannels.length > 0"
        class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
      >
        <li
          v-for="channel in filteredChannels"
          :key="channel.id"
          @mousedown.prevent="selectChannel(channel)"
          class="text-gray-900 cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-600 hover:text-white"
        >
          <span class="block truncate">{{ channel.topic }}</span>
           <span class="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500 text-xs">
             {{ channel.type }}
           </span>
        </li>
      </ul>
       <p v-if="showSuggestions && channelSearchTerm && !isLoadingChannels && filteredChannels.length === 0" class="text-sm text-gray-500 mt-1">
           No channels found matching "{{ channelSearchTerm }}".
       </p>
    </div>

     <!-- Selected Channel Display -->
     <div v-if="selectedChannel" class="p-2 bg-indigo-50 border border-indigo-200 rounded-md text-sm">
       Selected: <span class="font-medium">{{ selectedChannel.topic }}</span> (ID: {{ selectedChannel.id }})
     </div>

    <!-- Schedule Input -->
    <div>
      <label for="cron-schedule" class="block text-sm font-medium text-gray-700">Cron Schedule</label>
      <input
        id="cron-schedule"
        type="text"
        v-model="newSchedule"
        :disabled="isSubmitting"
        required
        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
        placeholder="e.g., */60 * * * * * (every 60s)"
      />
       <p class="mt-1 text-xs text-gray-500">Uses node-cron format (seconds optional). Default is every 60 seconds.</p>
    </div>

    <!-- Submit Button -->
    <div class="flex justify-end">
      <button
        type="submit"
        :disabled="isSubmitting || !selectedChannel || !newSchedule"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        <font-awesome-icon v-if="isSubmitting" :icon="['fas', 'spinner']" spin class="mr-2" />
        Add Cron Config
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  apiBase: {
    type: String,
    required: true,
  }
});

const emit = defineEmits(['add', 'error']);

// State for the form
const channelSearchTerm = ref('');
const allChannels = ref([]); // Cache fetched channels
const filteredChannels = ref([]);
const selectedChannel = ref(null);
const newSchedule = ref('*/60 * * * * *'); // Default schedule
const isSubmitting = ref(false);
const isLoadingChannels = ref(false);
const showSuggestions = ref(false);

let fetchDebounceTimer = null;
let blurDebounceTimer = null;

// --- Channel Fetching & Autocomplete ---
async function fetchAllChannels() {
  if (allChannels.value.length > 0) {
    // Use cached data if available
    filterChannelSuggestions();
    return;
  }
  isLoadingChannels.value = true;
  try {
    const data = await $fetch(`${props.apiBase}/teams/chats`);
    allChannels.value = data || [];
    filterChannelSuggestions();
  } catch (err) {
    console.error('Error fetching channels:', err);
    emit('error', `Failed to fetch channels: ${err.data?.message || err.message}`);
    allChannels.value = []; // Clear cache on error
  } finally {
    isLoadingChannels.value = false;
  }
}

function filterChannelSuggestions() {
  const term = channelSearchTerm.value.toLowerCase();
  if (!term) {
    filteredChannels.value = allChannels.value.slice(0, 10); // Show first 10 if no term
  } else {
    filteredChannels.value = allChannels.value.filter(channel =>
      channel.topic.toLowerCase().includes(term)
    ).slice(0, 10); // Limit suggestions
  }
}

function fetchChannelsDebounced() {
  clearTimeout(fetchDebounceTimer);
  fetchDebounceTimer = setTimeout(() => {
    if (allChannels.value.length > 0) {
      filterChannelSuggestions(); // Filter cached results immediately
    } else {
      fetchAllChannels(); // Fetch if cache is empty
    }
    showSuggestions.value = true; // Ensure suggestions are shown on input
  }, 300); // Debounce API calls/filtering
}

function selectChannel(channel) {
  selectedChannel.value = channel;
  channelSearchTerm.value = channel.topic; // Update input field
  showSuggestions.value = false; // Hide suggestions
  filteredChannels.value = []; // Clear suggestions
}

function hideSuggestionsDebounced() {
    // Delay hiding to allow click event on suggestions
    clearTimeout(blurDebounceTimer);
    blurDebounceTimer = setTimeout(() => {
        showSuggestions.value = false;
    }, 150);
}

// --- Form Submission ---
async function addConfig() {
  if (!selectedChannel.value || !newSchedule.value || isSubmitting.value) {
    return;
  }
  isSubmitting.value = true;
  try {
    const payload = {
      channelId: selectedChannel.value.id,
      channelName: selectedChannel.value.topic,
      schedule: newSchedule.value.trim(),
    };
    const newConfig = await $fetch(`${props.apiBase}/cron-configs`, {
      method: 'POST',
      body: payload,
    });
    emit('add', newConfig); // Emit the newly created config object

    // Reset form
    channelSearchTerm.value = '';
    selectedChannel.value = null;
    newSchedule.value = '*/60 * * * * *'; // Reset to default
    filteredChannels.value = [];

  } catch (err) {
    console.error('Error adding cron config:', err);
    emit('error', `Failed to add config: ${err.data?.message || err.message}`);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
/* Basic styling for autocomplete */
</style>