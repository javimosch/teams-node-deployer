<script setup>
import { ref, onMounted } from 'vue';

const connectors = ref([]);
const newConnector = ref({
  name: '',
  type: 'gitlab',
  url: '',
  accessToken: '',
  active: true
});
const editingConnector = ref(null);
const showForm = ref(false);
const isEditing = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

// Fetch all connectors
const fetchConnectors = async () => {
  console.log('components/GitConnectors.vue fetchConnectors Fetching git connectors', {});
  try {
    const response = await fetch('/api/connectors');
    if (!response.ok) {
      throw new Error(`Failed to fetch connectors: ${response.statusText}`);
    }
    const data = await response.json();
    connectors.value = data;
  } catch (err) {
    console.log('components/GitConnectors.vue fetchConnectors Error fetching connectors', {
      message: err.message,
      stack: err.stack
    });
    errorMessage.value = `Failed to load connectors: ${err.message}`;
  }
};

// Create a new connector
const createConnector = async () => {
  console.log('components/GitConnectors.vue createConnector Creating connector', { newConnector: newConnector.value });
  try {
    errorMessage.value = '';
    successMessage.value = '';
    
    // Validate form
    if (!newConnector.value.name || !newConnector.value.url || !newConnector.value.accessToken) {
      errorMessage.value = 'Please fill in all required fields';
      return;
    }
    
    const response = await fetch('/api/connectors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newConnector.value)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to create connector: ${response.statusText}`);
    }
    
    const data = await response.json();
    connectors.value.push(data);
    resetForm();
    successMessage.value = 'Connector created successfully';
  } catch (err) {
    console.log('components/GitConnectors.vue createConnector Error creating connector', {
      message: err.message,
      stack: err.stack
    });
    errorMessage.value = err.message;
  }
};

// Update an existing connector
const updateConnector = async () => {
  console.log('components/GitConnectors.vue updateConnector Updating connector', { connector: editingConnector.value });
  try {
    errorMessage.value = '';
    successMessage.value = '';
    
    // Validate form
    if (!editingConnector.value.name || !editingConnector.value.url || !editingConnector.value.accessToken) {
      errorMessage.value = 'Please fill in all required fields';
      return;
    }
    
    const response = await fetch(`/api/connectors/${editingConnector.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(editingConnector.value)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to update connector: ${response.statusText}`);
    }
    
    const data = await response.json();
    const index = connectors.value.findIndex(c => c.id === data.id);
    if (index !== -1) {
      connectors.value[index] = data;
    }
    
    resetForm();
    successMessage.value = 'Connector updated successfully';
  } catch (err) {
    console.log('components/GitConnectors.vue updateConnector Error updating connector', {
      message: err.message,
      stack: err.stack
    });
    errorMessage.value = err.message;
  }
};

// Delete a connector
const deleteConnector = async (id) => {
  console.log('components/GitConnectors.vue deleteConnector Deleting connector', { id });
  if (!confirm('Are you sure you want to delete this connector?')) {
    return;
  }
  
  try {
    errorMessage.value = '';
    successMessage.value = '';
    
    const response = await fetch(`/api/connectors/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to delete connector: ${response.statusText}`);
    }
    
    connectors.value = connectors.value.filter(c => c.id !== id);
    successMessage.value = 'Connector deleted successfully';
  } catch (err) {
    console.log('components/GitConnectors.vue deleteConnector Error deleting connector', {
      message: err.message,
      stack: err.stack
    });
    errorMessage.value = err.message;
  }
};

// Edit a connector
const editConnector = (connector) => {
  console.log('components/GitConnectors.vue editConnector Starting to edit connector', { id: connector.id });
  editingConnector.value = { ...connector };
  isEditing.value = true;
  showForm.value = true;
};

// Reset form
const resetForm = () => {
  newConnector.value = {
    name: '',
    type: 'gitlab',
    url: '',
    accessToken: '',
    active: true
  };
  editingConnector.value = null;
  isEditing.value = false;
  showForm.value = false;
};

// Toggle connector active state
const toggleActive = async (connector) => {
  console.log('components/GitConnectors.vue toggleActive Toggling connector active state', { 
    id: connector.id, 
    currentState: connector.active 
  });
  
  try {
    const updatedConnector = { ...connector, active: !connector.active };
    
    const response = await fetch(`/api/connectors/${connector.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedConnector)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to update connector: ${response.statusText}`);
    }
    
    const data = await response.json();
    const index = connectors.value.findIndex(c => c.id === data.id);
    if (index !== -1) {
      connectors.value[index] = data;
    }
  } catch (err) {
    console.log('components/GitConnectors.vue toggleActive Error toggling connector state', {
      message: err.message,
      stack: err.stack
    });
    errorMessage.value = err.message;
  }
};

// Lifecycle hooks
onMounted(() => {
  fetchConnectors();
});
</script>

<template>
  <div class="git-connectors-container">
    <h2 class="text-xl font-bold mb-4">Git Connectors</h2>
    
    <div v-if="errorMessage" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {{ errorMessage }}
    </div>
    
    <div v-if="successMessage" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
      {{ successMessage }}
    </div>
    
    <button 
      v-if="!showForm" 
      @click="showForm = true" 
      class="mb-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
      Add New Connector
    </button>
    
    <!-- Connector Form -->
    <div v-if="showForm" class="mb-6 p-4 border rounded shadow">
      <h3 class="text-lg font-semibold mb-3">{{ isEditing ? 'Edit' : 'Add' }} Connector</h3>
      
      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="name">
          Name *
        </label>
        <input 
          id="name" 
          :value="isEditing ? editingConnector.name : newConnector.name"
          @input="e => isEditing ? editingConnector.name = e.target.value : newConnector.name = e.target.value" 
          type="text" 
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="e.g., GitLab Production"
        >
      </div>
      
      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="type">
          Type *
        </label>
        <select 
          id="type" 
          :value="isEditing ? editingConnector.type : newConnector.type"
          @change="e => isEditing ? editingConnector.type = e.target.value : newConnector.type = e.target.value" 
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
          <option value="gitlab">GitLab</option>
          <!-- Future support for other Git providers -->
          <option value="github" disabled>GitHub (Coming Soon)</option>
        </select>
      </div>
      
      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="url">
          URL *
        </label>
        <input 
          id="url" 
          :value="isEditing ? editingConnector.url : newConnector.url"
          @input="e => isEditing ? editingConnector.url = e.target.value : newConnector.url = e.target.value" 
          type="text" 
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="e.g., https://gitlab.com"
        >
      </div>
      
      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="accessToken">
          Access Token *
        </label>
        <input 
          id="accessToken" 
          :value="isEditing ? editingConnector.accessToken : newConnector.accessToken"
          @input="e => isEditing ? editingConnector.accessToken = e.target.value : newConnector.accessToken = e.target.value" 
          type="password" 
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="Your access token"
        >
      </div>
      
      <div class="mb-4 flex items-center">
        <input 
          id="active" 
          :checked="isEditing ? editingConnector.active : newConnector.active"
          @change="e => isEditing ? editingConnector.active = e.target.checked : newConnector.active = e.target.checked" 
          type="checkbox" 
          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        >
        <label class="ml-2 block text-gray-700 text-sm font-bold" for="active">
          Active
        </label>
      </div>
      
      <div class="flex items-center justify-between">
        <button 
          @click="isEditing ? updateConnector() : createConnector()" 
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
          {{ isEditing ? 'Update' : 'Create' }}
        </button>
        <button 
          @click="resetForm" 
          class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
          Cancel
        </button>
      </div>
    </div>
    
    <!-- Connectors List -->
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white border">
        <thead>
          <tr>
            <th class="py-2 px-4 bg-gray-100 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Name
            </th>
            <th class="py-2 px-4 bg-gray-100 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Type
            </th>
            <th class="py-2 px-4 bg-gray-100 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              URL
            </th>
            <th class="py-2 px-4 bg-gray-100 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Status
            </th>
            <th class="py-2 px-4 bg-gray-100 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="connectors.length === 0">
            <td colspan="5" class="py-4 px-6 border-b border-gray-200 text-center">
              No connectors found. Add one to get started.
            </td>
          </tr>
          <tr v-for="connector in connectors" :key="connector.id" class="hover:bg-gray-50">
            <td class="py-2 px-4 border-b border-gray-200">
              {{ connector.name }}
            </td>
            <td class="py-2 px-4 border-b border-gray-200">
              {{ connector.type }}
            </td>
            <td class="py-2 px-4 border-b border-gray-200">
              {{ connector.url }}
            </td>
            <td class="py-2 px-4 border-b border-gray-200">
              <span 
                :class="connector.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'" 
                class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
              >
                {{ connector.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="py-2 px-4 border-b border-gray-200 text-sm">
              <button 
                @click="toggleActive(connector)" 
                :class="connector.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'"
                class="mr-2">
                {{ connector.active ? 'Deactivate' : 'Activate' }}
              </button>
              <button 
                @click="editConnector(connector)" 
                class="text-blue-600 hover:text-blue-900 mr-2">
                Edit
              </button>
              <button 
                @click="deleteConnector(connector.id)" 
                class="text-red-600 hover:text-red-900">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
