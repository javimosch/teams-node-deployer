<template>
  <div class="mb-4">
    <!-- Group Header with toggle functionality -->
    <div 
      class="flex justify-between items-center py-2 px-4 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition"
      @click="toggleExpanded"
    >
      <div class="flex items-center gap-2">
        <font-awesome-icon 
          :icon="['fas', expanded ? 'chevron-down' : 'chevron-right']" 
          class="text-gray-500"
        />
        <h3 class="font-medium text-gray-700">{{ title }}</h3>
        <span class="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
          {{ deployments.length }}
        </span>
      </div>
      <div class="text-sm text-gray-500">
        {{ displayText }}
      </div>
    </div>
    
    <!-- Group Content (deployments) -->
    <div v-if="expanded" class="border-b">
      <DeploymentListItem
        v-for="deployment in deployments"
        :key="deployment.id"
        :deployment="deployment"
        @view-details="$emit('view-details', $event)"
      />
      <div v-if="deployments.length === 0" class="p-4 text-center text-gray-500">
        No deployments in this category
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits, computed } from 'vue';
import DeploymentListItem from '~/components/DeploymentListItem.vue';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  deployments: {
    type: Array,
    default: () => []
  },
  defaultExpanded: {
    type: Boolean,
    default: false
  },
  displayText: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['view-details']);

// Start with the group expanded if it has items or if defaultExpanded is true
const expanded = ref(props.defaultExpanded || props.deployments.length > 0);

function toggleExpanded() {
  console.log('DeploymentGroup.vue toggleExpanded', { 
    title: props.title,
    currentExpanded: expanded.value,
    deploymentCount: props.deployments.length
  });
  expanded.value = !expanded.value;
}

// Expose toggle method to parent
defineExpose({
  toggleExpanded
});
</script>
