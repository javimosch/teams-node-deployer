<template>
  <div class="container mx-auto px-4 py-8 mb-20">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <font-awesome-icon :icon="['fas', 'rocket']" />
          Deployment Manager
        </h1>
        <p class="text-gray-600">Manage and track deployment requests</p>
      </div>
      <div class="flex items-center gap-4">
        <button @click="refreshData" :disabled="isLoading"
          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50">
          <font-awesome-icon :icon="['fas', 'sync-alt']" :spin="isLoading" />
          Refresh
        </button>
      </div>
    </div>
    
    <!-- Tab Navigation -->
    <div class="border-b border-gray-200 mb-8">
      <ul class="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500">
        <li class="mr-2" v-for="(tab, index) in tabs" :key="index">
          <button @click="tabClicked(tab.id)" 
            :class="['inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg',
              activeTab === tab.id 
                ? 'text-indigo-600 border-indigo-600 active'
                : 'border-transparent hover:text-gray-600 hover:border-gray-300']"
            :aria-current="activeTab === tab.id ? 'page' : undefined">
            <font-awesome-icon :icon="['fas', tab.icon]" class="mr-2" />
            <span>{{ tab.name }}</span>
            <!-- Notification badge for Events tab -->
            <span 
              v-if="tab.id === 'events' && unreadEventsCount > 0" 
              class="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-red-500 rounded-full"
            >
              {{ unreadEventsCount > 99 ? '99+' : unreadEventsCount }}
            </span>
          </button>
        </li>
      </ul>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Deployments Tab -->
      <div v-if="activeTab === 'deployments'" class="deployments-tab">
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-800 mb-1">Deployments</h2>
            <p class="text-gray-600">Manage and track deployment requests</p>
          </div>
          <div class="flex items-center gap-2">
            <button @click="showDeploymentForm = true"
              class="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition">
              <font-awesome-icon :icon="['fas', 'plus']" />
              New Deployment
            </button>
          </div>
          <div class="flex items-center gap-4">
            <div class="relative">
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <font-awesome-icon :icon="['fas', 'search']" class="text-gray-400" />
              </div>
              <input type="text" v-model="searchTerm" @input="filterDeployments"
                class="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 p-2.5"
                placeholder="Search deployments...">
            </div>
            <button @click="refreshDeployments" :disabled="isLoading"
              class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50">
              <font-awesome-icon :icon="['fas', 'sync-alt']" :spin="isLoading" />
              Refresh
            </button>
          </div>
        </div>
        
        <!-- Deployment Filters -->
        <DeploymentFilters @filter-change="applyFilters" />
        
        <!-- Stats Cards -->
        <StatsGrid :stats="deploymentStats" />

        <!-- Deployments List -->
        <div class="bg-white rounded-lg shadow overflow-hidden mb-12">
          <!-- Table Header -->
          <div class="grid grid-cols-12 bg-gray-100 p-4 border-b text-sm font-medium text-gray-600">
            <div class="col-span-4 md:col-span-5">Request Details</div>
            <div class="col-span-4 md:col-span-2">Status</div>
            <div class="col-span-2 md:col-span-2">Human approval</div>
            <div class="col-span-2 md:col-span-2">Updated</div>
            <div class="col-span-0 md:col-span-1"></div>
          </div>

          <!-- Deployment Items -->
          <div id="deployments-container">
            <div v-if="isLoading" class="p-4 text-center text-gray-500">Loading...</div>
            <div v-else-if="groupedDeployments.totalCount === 0" class="p-4 text-center text-gray-500">
              No deployments found matching your search.
            </div>
            <div v-else>
              <!-- Actionable Deployments Group -->
              <DeploymentGroup
                title="Actionable Deployments"
                :deployments="groupedDeployments.actionable"
                :default-expanded="true"
                display-text="Needs your attention"
                @view-details="showDeploymentDetails"
              />
              
              <!-- Recent Deployments Group -->
              <DeploymentGroup
                title="Recent Deployments"
                :deployments="groupedDeployments.recent"
                :default-expanded="true"
                display-text="Last 7 days"
                @view-details="showDeploymentDetails"
              />
              
              <!-- Completed Deployments Group -->
              <DeploymentGroup
                title="Completed Deployments"
                :deployments="groupedDeployments.completed"
                :default-expanded="false"
                display-text="Previously deployed"
                @view-details="showDeploymentDetails"
              />
              
              <!-- Other Deployments Group -->
              <DeploymentGroup
                title="Other Deployments"
                :deployments="groupedDeployments.other"
                :default-expanded="false"
                display-text="Archived items"
                @view-details="showDeploymentDetails"
              />
        
              
              <!-- Show More Button (if needed) -->
              <div v-if="hasMoreDeployments" class="p-4 text-center">
                <button 
                  @click="showAllDeployments"
                  class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 inline-flex items-center gap-2">
                  <font-awesome-icon :icon="['fas', 'chevron-down']" />
                  Show All Deployments
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Cron Jobs Tab -->
      <div v-if="activeTab === 'cron'" class="cron-tab">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Channel Polling Cron Jobs</h2>
        <CronConfigList
          :api-base="apiBase"
          @success="(message, title) => showToast(message, 'success', title)"
          @error="message => showToast(message, 'error')"
        />
      </div>
      
      <!-- Git Connectors Tab -->
      <div v-if="activeTab === 'connectors'" class="connectors-tab">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-800">Git Connectors</h2>
          <p class="text-gray-600">Manage Git provider connections for multi-repository support</p>
        </div>
        <GitConnectors />
      </div>
      
      <!-- Events Tab -->
      <div v-if="activeTab === 'events'" class="events-tab">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-800">Server Events</h2>
          <div class="flex gap-2">
            <button 
              v-if="hasUnreadEvents" 
              @click="markAllEventsAsRead" 
              class="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm rounded-md transition"
            >
              <font-awesome-icon :icon="['fas', 'check-double']" />
              Mark All as Read
            </button>
            <button 
              @click="refreshEvents" 
              :disabled="isLoadingEvents"
              class="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm rounded-md transition disabled:opacity-50"
            >
              <font-awesome-icon :icon="['fas', 'sync-alt']" :spin="isLoadingEvents" />
              Refresh
            </button>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden mb-12">
          <div v-if="isLoadingEvents && !serverEvents.length" class="p-8 text-center text-gray-500">
            <font-awesome-icon :icon="['fas', 'circle-notch']" spin class="text-3xl mb-3" />
            <p>Loading events...</p>
          </div>
          <div v-else-if="serverEvents.length === 0" class="p-8 text-center text-gray-500">
            <font-awesome-icon :icon="['fas', 'info-circle']" class="text-3xl mb-3" />
            <p>No events recorded yet.</p>
            <p class="text-sm mt-2">Events will appear here as background processes run on the server.</p>
          </div>
          <div v-else>
            <!-- Event filters -->
            <div class="bg-gray-50 p-4 border-b border-gray-200">
              <div class="flex flex-wrap gap-2">
                <button
                  @click="eventTypeFilter = 'all'"
                  :class="[
                    'px-3 py-1 text-xs rounded-full font-medium',
                    eventTypeFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  ]"
                >
                  All
                </button>
                <button
                  v-for="type in eventTypes"
                  :key="type.value"
                  @click="eventTypeFilter = type.value"
                  :class="[
                    'px-3 py-1 text-xs rounded-full font-medium',
                    eventTypeFilter === type.value ? `bg-${type.color}-100 text-${type.color}-800 border border-${type.color}-300` : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  ]"
                >
                  <font-awesome-icon :icon="['fas', type.icon]" class="mr-1" />
                  {{ type.label }}
                </button>
              </div>
            </div>
            
            <!-- Events list -->
            <div class="divide-y divide-gray-200">
              <div 
                v-for="event in filteredEvents" 
                :key="event.id" 
                :class="['p-4 hover:bg-gray-50 transition-colors', !event.read ? 'bg-blue-50' : '']"
                @click="markEventAsRead(event.id)"
              >
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0 mt-1">
                    <font-awesome-icon 
                      :icon="['fas', getEventIcon(event.type)]" 
                      :class="getEventIconClass(event.type)" 
                    />
                  </div>
                  <div class="flex-grow">
                    <div class="flex flex-wrap justify-between">
                      <h4 class="font-medium text-gray-900 flex items-center gap-2">
                        {{ event.title }}
                        <span v-if="!event.read" class="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                      </h4>
                      <span class="text-sm text-gray-500">{{ formatDate(event.timestamp) }}</span>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">{{ event.message }}</p>
                    
                    <!-- Expandable details section -->
                    <div v-if="event.details" class="mt-2">
                      <button 
                        @click.stop="toggleEventDetails(event.id)" 
                        class="text-xs inline-flex items-center text-gray-500 hover:text-gray-700"
                      >
                        <font-awesome-icon 
                          :icon="['fas', expandedEvents.includes(event.id) ? 'chevron-up' : 'chevron-down']" 
                          class="mr-1" 
                        />
                        {{ expandedEvents.includes(event.id) ? 'Hide' : 'Show' }} Details
                      </button>
                      <div 
                        v-if="expandedEvents.includes(event.id)" 
                        class="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto"
                      >
                        <pre class="whitespace-pre-wrap">{{ JSON.stringify(event.details, null, 2) }}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Pagination or load more button if needed -->
            <div v-if="serverEvents.length > initialEventsLimit && !showAllEvents" class="p-4 text-center">
              <button 
                @click="showAllEvents = true" 
                class="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Show All Events ({{ serverEvents.length }})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Deployment Details Modal -->
    <DeploymentModal
        :show="isModalVisible"
        :deployment-id="selectedDeploymentId"
        @close="closeModal"
        @update:deployment="handleDeploymentUpdate"
        @action-complete="handleActionComplete"
        @action-error="handleActionError"
    />

    <!-- New Deployment Form -->
    <DeploymentForm
      :show-form="showDeploymentForm"
      @close="showDeploymentForm = false"
      @deployment-created="handleDeploymentCreated"
    />

    <!-- DB Import Modal -->
    <div v-if="showImportModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]" @click.self="closeImportModal">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div class="flex justify-between items-center p-4 border-b">
          <h3 class="text-lg font-semibold text-gray-800">Import Database (JSON)</h3>
          <button @click="closeImportModal" class="text-gray-400 hover:text-gray-500">
            <font-awesome-icon :icon="['fas', 'times']" />
          </button>
        </div>
        <div class="p-6 overflow-y-auto flex-grow">
          <p class="text-sm text-gray-600 mb-4">Paste the JSON content below. This will <strong class="text-red-600">overwrite</strong> the current database.</p>
          <textarea
            v-model="importJsonContent"
            rows="10"
            class="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono"
            placeholder='{ "deployments": [...], "cronConfigs": [...] }'
          ></textarea>
          <p v-if="importError" class="text-red-500 text-sm mt-2">{{ importError }}</p>
        </div>
        <div class="p-4 border-t flex justify-end gap-4">
          <button @click="closeImportModal" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
            Cancel
          </button>
          <button @click="handleImportDb" :disabled="isImporting || !importJsonContent"
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', isImporting ? 'spinner' : 'upload']" :spin="isImporting" />
            Import Data
          </button>
        </div>
      </div>
    </div>

    <!-- Footer Toolbar -->
    <footer class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-md p-4 z-40">
      <div class="container mx-auto flex justify-end items-center gap-4">
        <!-- DB Management Dropdown -->
        <div class="relative inline-block text-left">
          <div>
            <button @click="toggleDbDropdown" type="button" class="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" id="options-menu" aria-haspopup="true" aria-expanded="true">
              Database
              <font-awesome-icon :icon="['fas', 'chevron-down']" class="-mr-1 ml-2 h-5 w-5" />
            </button>
          </div>
          <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <div v-show="isDbDropdownOpen" class="origin-bottom-left absolute left-0 bottom-full mb-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
              <div class="py-1" role="none">
                <a :href="`${apiBase}/db/export`" download="data.json" @click="closeDbDropdown" class="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100" role="menuitem">
                  <font-awesome-icon :icon="['fas', 'download']" class="mr-2" /> Export DB (JSON)
                </a>
                <button @click="openImportModal" class="text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100" role="menuitem">
                  <font-awesome-icon :icon="['fas', 'upload']" class="mr-2" /> Import DB (JSON)
                </button>
              </div>
            </div>
          </transition>
        </div>

        <!-- Fetch Messages Button -->
        <button @click="fetchMessages" :disabled="isFetching"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50">
          <font-awesome-icon :icon="['fas', isFetching ? 'spinner' : 'download']" :spin="isFetching" />
          {{ isFetching ? 'Fetching...' : 'Fetch Messages' }}
        </button>

        <!-- Process Deployments Button -->
        <button @click="processDeployments" :disabled="isProcessing"
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50">
          <font-awesome-icon :icon="['fas', isProcessing ? 'spinner' : 'cogs']" :spin="isProcessing" />
          {{ isProcessing ? 'Processing...' : 'Process Deployments' }}
        </button>
      </div>
    </footer>

    <!-- Toast Notification Container -->
    <ToastContainer ref="toastContainerRef" />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import GitConnectors from '~/components/GitConnectors.vue';
import DeploymentForm from '~/components/DeploymentForm.vue';
import StatsGrid from '~/components/StatsGrid.vue';
import DeploymentListItem from '~/components/DeploymentListItem.vue';
import DeploymentModal from '~/components/DeploymentModal.vue';
import ToastContainer from '~/components/ToastContainer.vue';
import CronConfigList from '~/components/CronConfigList.vue';
import DeploymentFilters from '~/components/DeploymentFilters.vue';
import DeploymentGroup from '~/components/DeploymentGroup.vue';

// Get runtime config
const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

// Tab Navigation
const tabs = [
  { id: 'deployments', name: 'Deployments', icon: 'rocket' },
  { id: 'cron', name: 'Channel Polling', icon: 'clock' },
  { id: 'connectors', name: 'Git Connectors', icon: 'code-branch' },
  { id: 'events', name: 'Events Log', icon: 'bell' },
];
const activeTab = ref('deployments');

// Deployments State
const allDeployments = ref([]);
const filteredDeployments = ref([]);
const searchTerm = ref('');
const isLoading = ref(false);
const isProcessing = ref(false);
const isFetching = ref(false);

const activeFilters = ref({
  statuses: [],
  dateRange: 'all',
  onlyActionable: true,
  limitedItems: true,
  maxItems: 10
});
const showingAllDeployments = ref(false);

// Events State
const serverEvents = ref([]);
const isLoadingEvents = ref(false);
const unreadEventsCount = ref(0);
const eventTypeFilter = ref('all');
const expandedEvents = ref([]);
const showAllEvents = ref(false);
const initialEventsLimit = 20;
const eventPollingInterval = ref(null);

// Event types for filtering
const eventTypes = [
  { value: 'info', label: 'Info', color: 'blue', icon: 'info-circle' },
  { value: 'success', label: 'Success', color: 'green', icon: 'check-circle' },
  { value: 'warning', label: 'Warning', color: 'yellow', icon: 'exclamation-circle' },
  { value: 'error', label: 'Error', color: 'red', icon: 'exclamation-triangle' }
];

const selectedDeploymentId = ref(null);
const isModalVisible = ref(false);
const toastContainerRef = ref(null);
const isDbDropdownOpen = ref(false);
const showImportModal = ref(false);
const importJsonContent = ref('');
const isImporting = ref(false);
const importError = ref('');
const showDeploymentForm = ref(false);

// Provide function for modal to find deployment
provide('findDeploymentById', (id) => allDeployments.value.find(d => d.id === id));

// --- Helper Functions ---
function deploymentHasLog(deployment, strs) {
    return deployment.processingLogs?.some(log => strs.every(s => (log.message || '').toLowerCase().includes(s))) ?? false;
}

function deploymentLogGet(deployment, strs) {
    return deployment.processingLogs?.find(log => strs.every(s => (log.message || '').toLowerCase().includes(s)));
}

function computeStatus(deployment) {
    if (!deployment) return 'pending';
    const status = deployment.status;
    const logs = deployment.processingLogs || [];
    let some = str => logs.some(log => (log.message || '').toLowerCase().includes(str));

    if (status === 'canceled') return 'canceled';
    if (status === 'processed' && deployment.deployed === true) return 'deployed';
    if (deploymentHasLog(deployment, ['tag', 'already']) || deploymentHasLog(deployment, ['no', 'changes']) || !deployment.nextTag) return 'skipped';
    if (some('error') || some('fatal') || (deployment.processingBranchErrors && deployment.processingBranchErrors.length > 0)) return 'failed';
    if (status === 'processed') return 'ready';
    return status || 'pending';
}

// --- Computed Properties ---
// Computed properties for events
const filteredEvents = computed(() => {
  let events = [...serverEvents.value];
  
  // Apply type filter
  if (eventTypeFilter.value !== 'all') {
    events = events.filter(event => event.type === eventTypeFilter.value);
  }
  
  // Apply limit if not showing all
  if (!showAllEvents.value) {
    events = events.slice(0, initialEventsLimit);
  }
  
  return events;
});

const hasUnreadEvents = computed(() => unreadEventsCount.value > 0);

// Computed properties for deployments
const activeFilterCount = computed(() => {
  let count = 0;
  if (activeFilters.value.statuses?.length > 0) count++;
  if (activeFilters.value.dateRange !== 'all') count++;
  if (activeFilters.value.onlyActionable) count++;
  return count;
});

const hasActiveFilters = computed(() => activeFilterCount.value > 0);

// Group deployments for display
const groupedDeployments = computed(() => {
  console.log('index.vue groupedDeployments', { count: filteredDeployments.value.length });
  
  // Start with filtered deployments
  let deployments = [...filteredDeployments.value];
  
  // Sort by date (newest first)
  deployments.sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt).getTime();
    return dateB - dateA;
  });
  
  // Apply max items limit if needed
  const isLimited = activeFilters.value.limitedItems && !showingAllDeployments.value;
  
  // Define groups
  let actionable = [];
  let recent = [];
  let completed = [];
  let other = [];
  
  // Categorize each deployment
  for (const deployment of deployments) {
    const status = computeStatus(deployment);
    
    // Actionable: ready for approval or failed
    if (status === 'ready' || status === 'failed') {
      actionable.push(deployment);
    }
    // Recent: last 7 days but not actionable or deployed
    else if (isRecent(deployment) && status !== 'deployed') {
      recent.push(deployment);
    }
    // Completed: deployed successfully
    else if (status === 'deployed') {
      completed.push(deployment);
    }
    // Other: everything else
    else {
      other.push(deployment);
    }
  }
  
  // Apply filters
  if (isLimited) {
    // Always show all actionable items
    recent = recent.slice(0, activeFilters.value.maxItems);
    completed = completed.slice(0, activeFilters.value.maxItems);
    other = other.slice(0, activeFilters.value.maxItems);
  }
  
  // Only show actionable items if filter is enabled
  if (activeFilters.value.onlyActionable && !showingAllDeployments.value) {
    return {
      actionable,
      recent: [],
      completed: [],
      other: [],
      totalCount: actionable.length
    };
  }
  
  // Return grouped deployments
  return {
    actionable,
    recent,
    completed,
    other,
    totalCount: actionable.length + recent.length + completed.length + other.length
  };
});

// Check if there are more deployments to show
const hasMoreDeployments = computed(() => {
  if (!activeFilters.value.limitedItems || showingAllDeployments.value) return false;
  
  const totalVisible = groupedDeployments.value.actionable.length +
                      groupedDeployments.value.recent.length +
                      groupedDeployments.value.completed.length +
                      groupedDeployments.value.other.length;
                      
  return totalVisible < filteredDeployments.value.length;
});

const deploymentStats = computed(() => {
  const counts = { pending: 0, skipped: 0, failed: 0, ready: 0, deployed: 0, canceled: 0, processing: 0 };

  if (!Array.isArray(allDeployments.value)) {
    console.warn('deploymentStats computed property received non-array:', allDeployments.value);
    return counts;
  }

  allDeployments.value.forEach(deployment => {
    const computed = computeStatus(deployment);
    if (counts.hasOwnProperty(computed)) counts[computed]++;
    else if (deployment.status === 'processing') counts.processing++;
    else counts.pending++;
  });
  return counts;
});

// --- Toast ---
function formatDate(timestamp) {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    // Format: Apr 15, 2025, 6:45 PM
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  } catch (err) {
    console.log('index.vue formatDate error', { timestamp, error: err.message });
    return 'Date error';
  }
}

function showToast(message, type = 'success', title = null) {
    if (!toastContainerRef.value) {
        console.warn('Toast container not available yet.');
        return;
    }
    const toastTitle = title || (type === 'success' ? 'Success' : type.charAt(0).toUpperCase() + type.slice(1));
    toastContainerRef.value.addToast({ type, title: toastTitle, message });
}

function getEventIcon(type) {
  switch (type) {
    case 'success': return 'check-circle';
    case 'error': return 'exclamation-triangle';
    case 'warning': return 'exclamation-circle';
    case 'info':
    default: return 'info-circle';
  }
}

function getEventIconClass(type) {
  switch (type) {
    case 'success': return 'text-green-500';
    case 'error': return 'text-red-500';
    case 'warning': return 'text-yellow-500';
    case 'info':
    default: return 'text-blue-500';
  }
}

// Helper function to check if a deployment is recent (last 7 days)
function isRecent(deployment) {
  const date = new Date(deployment.updatedAt || deployment.createdAt);
  const now = new Date();
  const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
  return date >= oneWeekAgo;
}

// --- Methods ---
async function fetchDeployments() {
  console.log('index.vue fetchDeployments starting');
  isLoading.value = true;
  try {
    const data = await $fetch(`${apiBase}/deployments`);
    console.log('index.vue fetchDeployments success', { dataLength: data?.length || 0 });
    allDeployments.value = data || [];
    filterDeployments();
  } catch (err) {
    console.log('index.vue fetchDeployments error', { message: err.message, stack: err.stack });
    showToast(`Failed to fetch deployments: ${err.data?.message || err.message || 'Network error'}`, 'error');
    allDeployments.value = [];
    filteredDeployments.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function fetchEvents() {
  console.log('index.vue fetchEvents starting');
  isLoadingEvents.value = true;
  try {
    // Fetch events from the server
    const data = await $fetch(`${apiBase}/events`);
    console.log('index.vue fetchEvents success', { eventCount: data?.length || 0 });
    
    // Update events
    serverEvents.value = data || [];
    
    // Calculate unread count
    updateUnreadCount();
  } catch (err) {
    console.log('index.vue fetchEvents error', { message: err.message, stack: err.stack });
    showToast(`Failed to fetch events: ${err.data?.message || err.message || 'Network error'}`, 'error');
  } finally {
    isLoadingEvents.value = false;
  }
}

function updateUnreadCount() {
  // Calculate number of unread events
  unreadEventsCount.value = serverEvents.value.filter(event => !event.read).length;
  console.log('index.vue updateUnreadCount', { unreadCount: unreadEventsCount.value });
}

async function refreshEvents() {
  console.log('index.vue refreshEvents');
  await fetchEvents();
}

// Apply filters from the filter component
function applyFilters(filters) {
  console.log('index.vue applyFilters', { filters });
  activeFilters.value = {
    statuses: filters.statuses || [],
    dateRange: filters.dateRange || 'all',
    onlyActionable: filters.onlyActionable,
    limitedItems: filters.limitedItems,
    maxItems: filters.maxItems || 10
  };
  // Reset all deployments view when filters change
  showingAllDeployments.value = false;
  filterDeployments();
}

// Show all deployments (remove limits)
function showAllDeployments() {
  console.log('index.vue showAllDeployments');
  showingAllDeployments.value = true;
}

// Reset filters function
function resetFilters() {
  console.log('index.vue resetFilters');
  activeFilters.value = {
    statuses: [],
    dateRange: 'all',
    onlyActionable: false,
    limitedItems: false,
    maxItems: 10
  };
  filterDeployments();
}

// Refresh deployments
async function refreshDeployments() {
  console.log('index.vue refreshDeployments');
  await fetchDeployments();
  showToast('Deployments refreshed successfully.', 'success');
}

async function markEventAsRead(eventId) {
  console.log('index.vue markEventAsRead', { eventId });
  try {
    // Find the event
    const event = serverEvents.value.find(e => e.id === eventId);
    if (!event || event.read) return; // Already read or not found
    
    // Update locally first for responsive UI
    const updatedEvents = serverEvents.value.map(e => {
      if (e.id === eventId) {
        return { ...e, read: true };
      }
      return e;
    });
    serverEvents.value = updatedEvents;
    updateUnreadCount();
    
    // Send update to server
    await $fetch(`${apiBase}/events/mark-read`, {
      method: 'PUT',
      body: { eventIds: [eventId] }
    });
  } catch (err) {
    console.log('index.vue markEventAsRead error', { eventId, message: err.message, stack: err.stack });
    showToast('Failed to mark event as read', 'error');
  }
}

async function markAllEventsAsRead() {
  console.log('index.vue markAllEventsAsRead');
  try {
    // Update locally first
    const updatedEvents = serverEvents.value.map(e => ({ ...e, read: true }));
    serverEvents.value = updatedEvents;
    unreadEventsCount.value = 0;
    
    // Send update to server
    await $fetch(`${apiBase}/events/mark-all-read`, {
      method: 'PUT'
    });
    
    showToast('All events marked as read', 'success');
  } catch (err) {
    console.log('index.vue markAllEventsAsRead error', { message: err.message, stack: err.stack });
    showToast('Failed to mark all events as read', 'error');
    // Roll back on error by refreshing
    await fetchEvents();
  }
}

function toggleEventDetails(eventId) {
  const index = expandedEvents.value.indexOf(eventId);
  if (index === -1) {
    expandedEvents.value.push(eventId);
  } else {
    expandedEvents.value.splice(index, 1);
  }
}

function tabClicked(tabId) {
  // If clicking on events tab, mark events as read
  if (tabId === 'events' && activeTab.value !== 'events') {
    // We'll mark events as read when viewed
    console.log('index.vue tabClicked - switching to events tab');
  }
  
  activeTab.value = tabId;
}

function filterDeployments() {
  console.log('index.vue filterDeployments', { searchTerm: searchTerm.value, activeFilters: activeFilters.value });
  
  const term = searchTerm.value.toLowerCase();
  let filtered = [...allDeployments.value];
  
  // Text search
  if (term) {
    filtered = filtered.filter(deployment =>
      // Search in all fields including branches
      Object.values(deployment).some(value =>
        String(value).toLowerCase().includes(term)
      ) || (deployment.processedBranches?.join(' ')?.toLowerCase() || '').includes(term)
    );
  }
  
  // Status filter
  if (activeFilters.value.statuses && activeFilters.value.statuses.length > 0) {
    filtered = filtered.filter(deployment => {
      const status = computeStatus(deployment);
      return activeFilters.value.statuses.includes(status);
    });
  }
  
  // Date range filter
  if (activeFilters.value.dateRange !== 'all') {
    const now = new Date();
    let cutoffDate;
    
    if (activeFilters.value.dateRange === 'today') {
      cutoffDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (activeFilters.value.dateRange === 'week') {
      cutoffDate = new Date(now.setDate(now.getDate() - 7));
    } else if (activeFilters.value.dateRange === 'month') {
      cutoffDate = new Date(now.setDate(now.getDate() - 30));
    }
    
    if (cutoffDate) {
      filtered = filtered.filter(deployment => {
        const deploymentDate = new Date(deployment.updatedAt || deployment.createdAt);
        return deploymentDate >= cutoffDate;
      });
    }
  }
  
  filteredDeployments.value = filtered;
}

async function refreshData() {
  console.log('index.vue refreshData', { activeTab: activeTab.value });
  
  if (isProcessing.value) {
    // Don't refresh if we're already processing deployments
    showToast("Processing is in progress. Please try again later.", "warning");
    return;
  }
  
  // Refresh based on active tab
  if (activeTab.value === 'deployments') {
    await fetchDeployments();
  } else if (activeTab.value === 'events') {
    await fetchEvents();
  }
  // Cron jobs are fetched automatically by the CronConfigList component
}



async function fetchMessages() {
  isFetching.value = true;
  try {
    await $fetch(`${apiBase}/messages/fetch`, { method: 'POST' });
    showToast('Messages fetched successfully.', 'success');
    await fetchDeployments();
  } catch (err) {
    console.error('Error fetching messages:', err);
    const errorMessage = err.data?.message || err.message || 'Unknown error';
    showToast(`Error fetching messages: ${errorMessage}`, 'error');
  } finally {
    isFetching.value = false;
  }
}

async function processDeployments() {
  isProcessing.value = true;
  try {
    await $fetch(`${apiBase}/deployments/process`, { method: 'POST' });
    showToast('Deployment processing initiated.', 'info', 'Processing Started');
    setTimeout(fetchDeployments, 2000);
  } catch (err) {
    console.error('Error processing deployments:', err);
    const errorMessage = err.data?.message || err.message || 'Unknown error';
    showToast(`Error initiating processing: ${errorMessage}`, 'error');
  } finally {
    isProcessing.value = false;
  }
}

function showDeploymentDetails(id) {
  selectedDeploymentId.value = id;
  isModalVisible.value = true;
}

function closeModal() {
  isModalVisible.value = false;
  selectedDeploymentId.value = null;
}

// --- Modal Event Handlers ---
function handleDeploymentUpdate(updatedDeployment) {
    const index = allDeployments.value.findIndex(d => d.id === updatedDeployment.id);
    if (index !== -1) {
        allDeployments.value[index] = updatedDeployment;
        filterDeployments();
    } else {
        fetchDeployments();
    }
}

function handleActionComplete(message) {
    showToast(message, 'success');
    fetchDeployments();
}

function handleActionError(message) {
    showToast(message, 'error');
}

function handleDeploymentCreated(deployment) {
    showToast('Deployment created successfully', 'success');
    fetchDeployments();
}

// --- DB Management ---
function toggleDbDropdown() {
  isDbDropdownOpen.value = !isDbDropdownOpen.value;
}

function closeDbDropdown() {
  isDbDropdownOpen.value = false;
}

function openImportModal() {
  importJsonContent.value = '';
  importError.value = '';
  showImportModal.value = true;
  closeDbDropdown();
}

function closeImportModal() {
  showImportModal.value = false;
}

async function handleImportDb() {
  importError.value = '';
  let parsedJson;

  try {
    parsedJson = JSON.parse(importJsonContent.value);
    if (typeof parsedJson !== 'object' || parsedJson === null || Array.isArray(parsedJson)) {
      throw new Error('Invalid format: Input must be a JSON object.');
    }
  } catch (e) {
    importError.value = `Invalid JSON: ${e.message}`;
    return;
  }

  isImporting.value = true;
  try {
    await $fetch(`${apiBase}/db/import`, {
      method: 'POST',
      body: parsedJson,
      headers: { 'Content-Type': 'application/json' }
    });
    showToast('Database imported successfully!', 'success');
    closeImportModal();
    await fetchDeployments();
  } catch (err) {
    console.error('Error importing database:', err);
    const errorMessage = err.data?.message || err.message || 'Unknown error during import.';
    importError.value = `Import failed: ${errorMessage}`;
    showToast(`Import failed: ${errorMessage}`, 'error');
  } finally {
    isImporting.value = false;
  }
}

// --- Lifecycle Hooks ---
onMounted(() => {
  // Load initial data based on active tab
  if (activeTab.value === 'deployments') {
    fetchDeployments();
  } else if (activeTab.value === 'events') {
    fetchEvents();
  }
  
  // Always fetch events in the background for the notification counter
  fetchEvents();
  
  // Setup polling for events (every 30 seconds)
  eventPollingInterval.value = setInterval(async () => {
    console.log('index.vue polling for events');
    // Only do full refresh if not currently viewing events (to avoid UI disruption)
    if (activeTab.value !== 'events') {
      await fetchEvents();
    }
  }, 30000); // 30 seconds
  
  // Watch for tab changes to load data as needed
  watch(activeTab, (newTab) => {
    console.log('index.vue tab changed', { newTab });
    if (newTab === 'deployments' && allDeployments.value.length === 0) {
      fetchDeployments();
    } else if (newTab === 'events') {
      fetchEvents();
    }
  });
});

onBeforeUnmount(() => {
  // Clean up polling interval when component is destroyed
  if (eventPollingInterval.value) {
    clearInterval(eventPollingInterval.value);
  }
});
</script>