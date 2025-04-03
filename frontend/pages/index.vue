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

    <!-- Footer Toolbar -->
    <footer class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-md p-4 z-40">
      <div class="container mx-auto flex justify-end">
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

    if (status === 'processed' && deployment.deployed === true) return 'deployed';
    if (deploymentHasLog(deployment, ['tag', 'already']) || deploymentHasLog(deployment, ['no', 'changes'])) return 'skipped';
    if (some('error') || some('fatal') || (deployment.processingBranchErrors && deployment.processingBranchErrors.length > 0)) return 'failed';
    if (status === 'processed') return 'ready';
    return status || 'pending';
}

// --- Computed Properties ---
const deploymentStats = computed(() => {
  const counts = { pending: 0, skipped: 0, failed: 0, ready: 0, deployed: 0, canceled: 0, processing: 0 };

  // Add check to ensure allDeployments.value is an array
  if (!Array.isArray(allDeployments.value)) {
    console.warn('deploymentStats computed property received non-array:', allDeployments.value);
    return counts; // Return default counts if not an array
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
    // Use provided title, or generate default based on type
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
    showToast(`Failed to fetch deployments: ${err.message || 'Network error'}`, 'error');
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
    showToast('Deployment processing triggered successfully.', 'success');
    await fetchDeployments();
  } catch (err) {
    console.error('Error processing deployments:', err);
    const errorMessage = err.data?.message || err.message || 'Unknown error';
    showToast(`Error processing deployments: ${errorMessage}`, 'error');
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

// --- Lifecycle Hooks ---
onMounted(() => {
  fetchDeployments();
});
</script>