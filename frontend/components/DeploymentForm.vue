<script setup>
import { ref, onMounted } from 'vue';

const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

const props = defineProps({
  showForm: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'deployment-created']);

const formData = ref({
  content: '',
  repoName: '',
  connectorId: ''
});

const connectors = ref([]);
const isLoading = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

// Fetch available connectors
const fetchConnectors = async () => {
  console.log('components/DeploymentForm.vue fetchConnectors Fetching git connectors', {});
  try {
    isLoading.value = true;
    const response = await fetch(`${apiBase}/connectors/active`);
    if (!response.ok) {
      throw new Error(`Failed to fetch connectors: ${response.statusText}`);
    }
    const data = await response.json();
    connectors.value = data;
    
    // Set default connector if available
    if (data.length > 0) {
      formData.value.connectorId = data[0].id;
    }
  } catch (err) {
    console.log('components/DeploymentForm.vue fetchConnectors Error fetching connectors', {
      message: err.message,
      stack: err.stack
    });
    errorMessage.value = `Failed to load connectors: ${err.message}`;
  } finally {
    isLoading.value = false;
  }
};

// Create a new deployment
const createDeployment = async () => {
  console.log('components/DeploymentForm.vue createDeployment Creating deployment', { formData: formData.value });
  try {
    isSubmitting.value = true;
    errorMessage.value = '';
    successMessage.value = '';
    
    // Validate form
    if (!formData.value.content) {
      errorMessage.value = 'Please enter deployment content';
      return;
    }
    
    // Create deployment object
    const deploymentData = {
      content: formData.value.content,
      from: 'Manual UI Deployment',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add repository and connector if provided
    if (formData.value.repoName) {
      deploymentData.repoName = formData.value.repoName;
    }
    
    if (formData.value.connectorId) {
      deploymentData.connectorId = formData.value.connectorId;
    }
    
    // Send request to create deployment
    const response = await fetch(`${apiBase}/deployments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deploymentData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to create deployment: ${response.statusText}`);
    }
    
    const data = await response.json();
    successMessage.value = 'Deployment created successfully';
    resetForm();
    emit('deployment-created', data);
  } catch (err) {
    console.log('components/DeploymentForm.vue createDeployment Error creating deployment', {
      message: err.message,
      stack: err.stack
    });
    errorMessage.value = err.message;
  } finally {
    isSubmitting.value = false;
  }
};

// Reset form
const resetForm = () => {
  formData.value = {
    content: '',
    repoName: '',
    connectorId: connectors.value.length > 0 ? connectors.value[0].id : ''
  };
};

// Close form
const closeForm = () => {
  resetForm();
  emit('close');
};

// Lifecycle hooks
onMounted(() => {
  fetchConnectors();
});
</script>

<template>
  <div v-if="showForm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click.self="closeForm">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex justify-between items-center p-4 border-b">
        <h3 class="text-xl font-semibold text-gray-800">Create New Deployment</h3>
        <button @click="closeForm" class="text-gray-400 hover:text-gray-500">
          <font-awesome-icon :icon="['fas', 'times']" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto flex-grow">
        <div v-if="errorMessage" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {{ errorMessage }}
        </div>
        
        <div v-if="successMessage" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {{ successMessage }}
        </div>
        
        <form @submit.prevent="createDeployment" class="space-y-4">
          <!-- Deployment Content -->
          <div>
            <label for="content" class="block text-sm font-medium text-gray-700 mb-1">
              Deployment Content *
            </label>
            <textarea 
              id="content" 
              v-model="formData.content" 
              rows="4" 
              class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="e.g., agent:deploy GEO-123"
              required
            ></textarea>
            <p class="mt-1 text-sm text-gray-500">
              Enter the deployment request content, such as "agent:deploy GEO-123"
            </p>
          </div>
          
          <!-- Git Connector Selection -->
          <div>
            <label for="connector" class="block text-sm font-medium text-gray-700 mb-1">
              Git Connector
            </label>
            <select 
              id="connector" 
              v-model="formData.connectorId" 
              class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="">Default Connector</option>
              <option v-for="connector in connectors" :key="connector.id" :value="connector.id">
                {{ connector.name }} ({{ connector.type }} - {{ connector.url }})
              </option>
            </select>
            <p class="mt-1 text-sm text-gray-500">
              Select which Git connector to use for this deployment
            </p>
          </div>
          
          <!-- Repository Name -->
          <div>
            <label for="repoName" class="block text-sm font-medium text-gray-700 mb-1">
              Repository Name
            </label>
            <input 
              id="repoName" 
              v-model="formData.repoName" 
              type="text" 
              class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="e.g., my-project"
            >
            <p class="mt-1 text-sm text-gray-500">
              Leave empty to use the default repository from environment variables
            </p>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t flex justify-end gap-4">
        <button 
          @click="createDeployment" 
          :disabled="isSubmitting"
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
        >
          <font-awesome-icon v-if="isSubmitting" :icon="['fas', 'spinner']" spin />
          <font-awesome-icon v-else :icon="['fas', 'rocket']" />
          Create Deployment
        </button>
        <button 
          @click="closeForm" 
          class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
