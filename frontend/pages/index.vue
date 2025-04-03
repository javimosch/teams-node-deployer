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
        <div v-else-if="filteredDeployments.length === 0" class="p-4 text-center text-gray-500">
          No deployments found matching your search.
        </div>
        <div v-else>
          <DeploymentListItem
            v-for="deployment in filteredDeployments"
            :key="deployment.id"
            :deployment="deployment"
            @view-details="showDeploymentDetails"
          />
        </div>
      </div>
    </div>

    <!-- Cron Configurations Section -->
    <CronConfigList
        :api-base="apiBase"
        @success="(message, title) => showToast(message, 'success', title)"
        @error="message => showToast(message, 'error')"
    />

    <!-- Deployment Details Modal -->
    <DeploymentModal
        :show="isModalVisible"
        :deployment-id="selectedDeploymentId"
        @close="closeModal"
        @update:deployment="handleDeploymentUpdate"
        @action-complete="handleActionComplete"
        @action-error="handleActionError"
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
import { ref, computed, onMounted, provide } from 'vue';
import StatsGrid from '~/components/StatsGrid.vue';
import DeploymentListItem from '~/components/DeploymentListItem.vue';
import DeploymentModal from '~/components/DeploymentModal.vue';
import ToastContainer from '~/components/ToastContainer.vue';
import CronConfigList from '~/components/CronConfigList.vue';

// Get runtime config
const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

// State
const allDeployments = ref([]);
const filteredDeployments = ref([]);
const searchTerm = ref('');
const isLoading = ref(false);
const isProcessing = ref(false);
const selectedDeploymentId = ref(null);
const isModalVisible = ref(false);
const toastContainerRef = ref(null);
const isDbDropdownOpen = ref(false);
const showImportModal = ref(false);
const importJsonContent = ref('');
const isImporting = ref(false);
const importError = ref('');

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
function showToast(message, type = 'success', title = null) {
    if (!toastContainerRef.value) {
        console.warn('Toast container not available yet.');
        return;
    }
    const toastTitle = title || (type === 'success' ? 'Success' : type.charAt(0).toUpperCase() + type.slice(1));
    toastContainerRef.value.addToast({ type, title: toastTitle, message });
}

// --- Methods ---
async function fetchDeployments() {
  isLoading.value = true;
  try {
    const data = await $fetch(`${apiBase}/deployments`);
    allDeployments.value = data || [];
    filterDeployments();
  } catch (err) {
    console.error('Failed to fetch deployments:', err);
    showToast(`Failed to fetch deployments: ${err.data?.message || err.message || 'Network error'}`, 'error');
    allDeployments.value = [];
    filteredDeployments.value = [];
  } finally {
    isLoading.value = false;
  }
}

function filterDeployments() {
  const term = searchTerm.value.toLowerCase();
  if (!term) {
    filteredDeployments.value = [...allDeployments.value];
  } else {
    filteredDeployments.value = allDeployments.value.filter(deployment =>
      Object.values(deployment).some(value =>
        String(value).toLowerCase().includes(term)
      ) || (deployment.processedBranches?.join(' ')?.toLowerCase() || '').includes(term)
    );
  }
}

async function refreshDeployments() {
  await fetchDeployments();
  showToast('Deployments refreshed successfully.', 'success');
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
  fetchDeployments();
});
</script>