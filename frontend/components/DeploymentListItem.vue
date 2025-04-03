<template>
  <div class="grid grid-cols-12 p-4 border-b hover:bg-gray-50 cursor-pointer transition" @click="viewDetails">
    <div class="col-span-4 md:col-span-5">
      <div class="font-medium text-gray-800 flex items-center gap-2">
        <font-awesome-icon :icon="['fas', 'user-circle']" class="text-indigo-500" />
        {{ deployment.from }}
      </div>
      <div class="text-gray-500 text-sm mt-1 content-preview" v-html="contentPreview"></div>
      <div v-if="deployment.nextTag" class="mt-1">
        <span class="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded">Tag: {{ deployment.nextTag }}</span>
      </div>
    </div>
    <div class="col-span-4 md:col-span-2 flex items-center">
      <span v-html="statusElement" :title="statusTitle"></span>
      <font-awesome-icon v-if="hasErrors" :icon="['fas', 'exclamation-circle']" class="text-red-500 ml-2" title="Errors occurred during processing" />
    </div>
    <div class="col-span-2 md:col-span-2 flex items-center">
      <span v-if="deployment.nextTag" v-html="approvalElement"></span>
      <span v-else class="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs flex items-center gap-1">
        <font-awesome-icon :icon="['fas', 'minus-circle']" /> Not needed
      </span>
    </div>
    <div class="col-span-2 md:col-span-2 flex items-center text-sm text-gray-500">
      {{ formattedUpdatedAt }}
    </div>
    <div class="col-span-0 md:col-span-1 flex items-center justify-end">
      <button class="text-indigo-600 hover:text-indigo-800 transition" @click.stop="viewDetails">
        <font-awesome-icon :icon="['fas', 'chevron-right']" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  deployment: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['view-details']);

// --- Helper Functions (Consider moving to utils) ---
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  try {
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch (e) {
    return 'Invalid Date';
  }
}

function stripHtml(html) {
  if (!html) return '';
  // Basic stripping, consider a library for robustness if needed
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

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

    if (status === 'processed' && deployment.deployed === true) {
        return 'deployed';
    }
    if (deploymentHasLog(deployment, ['tag', 'already']) || deploymentHasLog(deployment, ['no', 'changes'])) {
        return 'skipped';
    }
    if (some('error') || some('fatal') || (deployment.processingBranchErrors && deployment.processingBranchErrors.length > 0)) {
        return 'failed';
    }
    if (status === 'processed') {
        return 'ready';
    }
    // Handle 'processing' explicitly if needed, otherwise rely on backend status
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

function getApprovalInfo(approved) {
  if (approved === true) {
    return { label: 'Approved', color: 'bg-green-100 text-green-800', icon: 'fa-check-circle' };
  } else if (approved === false) {
    // Assuming false means rejected, adjust if needed
    return { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: 'fa-times-circle' };
  } else {
    return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: 'fa-clock' };
  }
}

// --- Computed Properties ---
const computedStatus = computed(() => computeStatus(props.deployment));
const statusInfo = computed(() => getStatusInfo(computedStatus.value));
const approvalInfo = computed(() => getApprovalInfo(props.deployment.approved));

const statusElement = computed(() => {
  const { label, color, icon } = statusInfo.value;
  return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}">
            <i class="fas ${icon} mr-1"></i>
            ${label}
          </span>`;
});

const statusTitle = computed(() => {
    const status = computedStatus.value;
    if (status === 'skipped') {
        const tagLog = deploymentLogGet(props.deployment, ['tag', 'already']);
        if (tagLog) return tagLog.message;
        const noChangesLog = deploymentLogGet(props.deployment, ['no', 'changes']);
        if (noChangesLog) return noChangesLog.message;
    }
    return statusInfo.value.label; // Default title is the status label
});


const approvalElement = computed(() => {
  const { label, color, icon } = approvalInfo.value;
  return `<span class="px-2 py-1 rounded-full ${color} text-xs flex items-center gap-1">
            <i class="fas ${icon}"></i> ${label}
          </span>`;
});

const formattedUpdatedAt = computed(() => {
  const dateToFormat = props.deployment.updatedAt || props.deployment.createdAt;
  return formatDate(dateToFormat);
});

const contentPreview = computed(() => {
  // Basic preview, might need refinement for complex HTML
  const text = stripHtml(props.deployment.content);
  return text.substring(0, 100) + (text.length > 100 ? '...' : '');
});

const hasErrors = computed(() => {
    return props.deployment.processingBranchErrors && props.deployment.processingBranchErrors.length > 0;
});


// --- Methods ---
function viewDetails() {
  emit('view-details', props.deployment.id);
}
</script>