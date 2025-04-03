<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click.self="closeModal">
    <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex justify-between items-center p-4 border-b">
        <h3 class="text-xl font-semibold text-gray-800">Deployment Details</h3>
        <button @click="closeModal" class="text-gray-400 hover:text-gray-500">
          <font-awesome-icon :icon="['fas', 'times']" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto flex-grow">
        <div v-if="!deployment" class="text-center text-gray-500">Loading details...</div>
        <div v-else class="space-y-6">
          <div>
            <h4 class="text-sm font-medium text-gray-500">From</h4>
            <p class="mt-1 text-sm text-gray-900">{{ deployment.from }}</p>
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-500">Content</h4>
            <div class="mt-1 text-sm text-gray-900" v-html="deployment.content"></div>
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-500">Status</h4>
            <div class="mt-1" v-html="statusElement" :title="statusTitle"></div>
          </div>
          <div v-if="deployment.processedBranches && deployment.processedBranches.length > 0">
            <h4 class="text-sm font-medium text-gray-500">Processed Branches</h4>
            <div class="mt-1 branch-list">
              <span v-for="branch in deployment.processedBranches" :key="branch" class="branch-item">
                <font-awesome-icon :icon="['fas', 'code-branch']" class="text-gray-400" />
                <span class="text-sm text-gray-900">{{ branch }}</span>
              </span>
            </div>
          </div>
           <div v-if="deployment.nextTag">
              <h4 class="text-sm font-medium text-gray-500">Next Tag</h4>
              <p class="mt-1 text-sm text-gray-900">{{ deployment.nextTag }}</p>
           </div>
          <div v-if="hasErrors">
            <h4 class="text-sm font-medium text-gray-500 text-red-600">Errors</h4>
            <div class="mt-1 space-y-2">
              <div v-for="(error, index) in deployment.processingBranchErrors" :key="index" class="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <p class="font-medium">Branch: {{ error.branch }}</p>
                <p class="mt-1">{{ error.message }}</p>
                <pre v-if="error.stack" class="mt-2 text-xs overflow-x-auto bg-red-100 p-2 rounded">{{ error.stack }}</pre>
              </div>
            </div>
          </div>
          <div v-if="deployment.processingLogs && deployment.processingLogs.length > 0">
            <h4 class="text-sm font-medium text-gray-500">Processing Logs</h4>
            <div class="mt-1 space-y-2">
              <div v-for="(log, index) in deployment.processingLogs" :key="index" class="log-entry text-sm text-gray-600 py-1">
                <p><span class="font-medium">{{ log.branch || 'General' }}:</span> {{ log.message }}</p>
              </div>
            </div>
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-500">Created</h4>
            <p class="mt-1 text-sm text-gray-900">{{ formatDate(deployment.createdAt) }}</p>
          </div>
          <div v-if="deployment.updatedAt">
            <h4 class="text-sm font-medium text-gray-500">Last Updated</h4>
            <p class="mt-1 text-sm text-gray-900">{{ formatDate(deployment.updatedAt) }}</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t flex justify-end gap-4">
         <button v-if="showMarkPendingButton" @click="markPending" :disabled="isActionLoading"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
          <font-awesome-icon :icon="['fas', isActionLoading ? 'spinner' : 'undo']" :spin="isActionLoading" />
          Mark as pending
        </button>
        <button v-if="showCancelButton" @click="cancel" :disabled="isActionLoading"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
           <font-awesome-icon :icon="['fas', isActionLoading ? 'spinner' : 'ban']" :spin="isActionLoading" />
          Cancel
        </button>
        <button v-if="showApproveButton" @click="approve" :disabled="isActionLoading"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
           <font-awesome-icon :icon="['fas', isActionLoading ? 'spinner' : 'check']" :spin="isActionLoading" />
          Approve
        </button>
        <button @click="closeModal" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue';

const props = defineProps({
  deploymentId: {
    type: String,
    default: null,
  },
  show: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'update:deployment', 'action-complete', 'action-error']);

const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

const deployment = ref(null);
const isLoading = ref(false);
const isActionLoading = ref(false);

// --- Helper Functions (Copied from DeploymentListItem, consider utils) ---
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  try {
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch (e) { return 'Invalid Date'; }
}

function deploymentHasLog(dep, strs) {
    return dep?.processingLogs?.some(log => strs.every(s => (log.message || '').toLowerCase().includes(s))) ?? false;
}

function deploymentLogGet(dep, strs) {
    return dep?.processingLogs?.find(log => strs.every(s => (log.message || '').toLowerCase().includes(s)));
}

function computeStatus(dep) {
    if (!dep) return 'pending';
    const status = dep.status;
    const logs = dep.processingLogs || [];
    let some = str => logs.some(log => (log.message || '').toLowerCase().includes(str));

    if (status === 'processed' && dep.deployed === true) return 'deployed';
    if (deploymentHasLog(dep, ['tag', 'already']) || deploymentHasLog(dep, ['no', 'changes']) || deploymentHasLog(dep, ['branch', 'not', 'exist'])) return 'skipped';
    if (some('error') || some('fatal') || (dep.processingBranchErrors && dep.processingBranchErrors.length > 0)) return 'failed';
    if (status === 'processed') return 'ready';
    return status || 'pending';
}

function getStatusInfo(status) {
  const statusMap = {
    pending: { label: 'Pending', color: 'bg-blue-100 text-blue-800', icon: 'fa-clock' },
    processing: { label: 'Processing', color: 'bg-yellow-100 text-yellow-800', icon: 'fa-spinner fa-spin' },
    ready: { label: 'Ready', color: 'bg-green-100 text-green-800', icon: 'fa-check-circle' },
    deployed: { label: 'Deployed', color: 'bg-purple-100 text-purple-800', icon: 'fa-rocket' },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: 'fa-exclamation-circle' },
    canceled: { label: 'Canceled', color: 'bg-gray-100 text-gray-800', icon: 'fa-ban' },
    skipped: { label: 'Skipped', color: 'bg-gray-100 text-gray-600', icon: 'fa-arrow-right' },
  };
  return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-600', icon: 'fa-question-circle' };
}

// --- Computed Properties ---
const computedStatus = computed(() => computeStatus(deployment.value));
const statusInfo = computed(() => getStatusInfo(computedStatus.value));
const hasErrors = computed(() => deployment.value?.processingBranchErrors?.length > 0);
const isCanceled = computed(() => deployment.value?.status === 'canceled');
const isDeployed = computed(() => deployment.value?.deployed === true);

const statusElement = computed(() => {
  if (!deployment.value) return '';
  const { label, color, icon } = statusInfo.value;
  return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}">
            <i class="fas ${icon} mr-1"></i>
            ${label}
          </span>`;
});

const statusTitle = computed(() => {
    if (!deployment.value) return '';
    const status = computedStatus.value;
    if (status === 'skipped') {
        const tagLog = deploymentLogGet(deployment.value, ['tag', 'already']);
        if (tagLog) return tagLog.message;
        const noChangesLog = deploymentLogGet(deployment.value, ['no', 'changes']);
        if (noChangesLog) return noChangesLog.message;

        const branchNotFoundLog = deploymentLogGet(deployment.value, ['branch', 'not', 'exist'])
        if (branchNotFoundLog) return branchNotFoundLog.message;

        if (!deployment.value.nextTag) {
            return 'Tag not found';
        }
    }
    return statusInfo.value.label;
});

const showApproveButton = computed(() => {
    if (!deployment.value || !deployment.value.nextTag || deployment.value.approved || isCanceled.value || isDeployed.value) {
        return false;
    }
    // Only show approve if status is 'ready' (processed without errors)
    return computedStatus.value === 'ready';
});

const showCancelButton = computed(() => {
    return deployment.value && !isDeployed.value && !isCanceled.value;
});

const showMarkPendingButton = computed(() => {
    // Show if status is 'ready' or 'failed' but not canceled or deployed
    return deployment.value && ['ready', 'failed'].includes(computedStatus.value) && !isCanceled.value && !isDeployed.value;
});


// --- Methods ---
function closeModal() {
  emit('close');
}

async function fetchDeploymentDetails() {
    if (!props.deploymentId) {
        deployment.value = null;
        return;
    }
    isLoading.value = true;
    try {
        if (!inject('findDeploymentById', null)) {
            try {
                const data = await $fetch(`${apiBase}/deployments`); // Fetch all and find
                deployment.value = data.find(d => d.id === props.deploymentId);
            } catch (fetchErr) {
                console.error("Failed to fetch deployment details:", fetchErr);
                emit('action-error', 'Failed to load deployment details.');
                deployment.value = null;
            }
        }
    } catch (error) {
        console.error('Error fetching deployment details:', error);
        emit('action-error', 'Failed to load deployment details.');
        deployment.value = null;
    } finally {
        isLoading.value = false;
    }
}

async function performAction(actionFn, successMessage, errorMessage) {
    if (!deployment.value) return;
    isActionLoading.value = true;
    try {
        await actionFn();
        emit('action-complete', successMessage);
        closeModal(); // Close modal on success
    } catch (error) {
        console.error(`${errorMessage}:`, error);
        const errorDetail = error.data?.message || error.message || errorMessage;
        emit('action-error', `${errorMessage}: ${errorDetail}`);
    } finally {
        isActionLoading.value = false;
    }
}

async function approve() {
    if (!confirm(`Are you sure you want to approve this deployment request from ${deployment.value?.from}?`)) return;
    await performAction(
        async () => {
            const updatedDeployment = await $fetch(`${apiBase}/deployments`, {
                method: 'PUT',
                body: { id: deployment.value.id, approved: true }
            });
            emit('update:deployment', updatedDeployment);
        },
        'Deployment approved successfully.',
        'Error approving deployment'
    );
}

async function cancel() {
     if (!confirm(`Are you sure you want to cancel this deployment request from ${deployment.value?.from}?`)) return;
     await performAction(
        async () => {
            await $fetch(`${apiBase}/deployments/${deployment.value.id}/cancel`, { method: 'POST' });
            emit('update:deployment', { ...deployment.value, status: 'canceled', updatedAt: new Date().toISOString() });
        },
        'Deployment canceled successfully.',
        'Error canceling deployment'
     );
}

async function markPending() {
    if (!confirm('Are you sure you want to mark this deployment as pending? This will clear logs and errors.')) return;
     await performAction(
        async () => {
             const updatedDeployment = await $fetch(`${apiBase}/deployments`, {
                method: 'PUT',
                body: {
                    id: deployment.value.id,
                    status: 'pending',
                    processingLogs: [],
                    processingBranchErrors: []
                }
            });
             emit('update:deployment', updatedDeployment);
        },
        'Deployment marked as pending successfully.',
        'Error marking deployment as pending'
     );
}


// --- Watchers ---
watch(() => props.deploymentId, (newId) => {
  if (newId && props.show) {
    fetchDeploymentDetails();
  } else {
    deployment.value = null; // Clear data when modal is hidden or ID is null
  }
}, { immediate: true });

watch(() => props.show, (newShow) => {
    if (newShow && props.deploymentId) {
        fetchDeploymentDetails();
    } else {
        deployment.value = null; // Clear data when modal is hidden
    }
});

</script>