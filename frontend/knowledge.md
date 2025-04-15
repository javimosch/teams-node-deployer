# Frontend Knowledge Base

## Project Overview
Teams Node Deployer Frontend - A Nuxt.js application that provides a user interface for managing deployments from Microsoft Teams messages.

## Core Technologies
- Nuxt 3 (SSR disabled)
- Vue 3 Composition API
- TailwindCSS
- FontAwesome Icons

## Key Components

### Deployment Management
- `DeploymentListItem.vue`: Individual deployment entry display
- `DeploymentGroup.vue`: Groups deployments by status
- `DeploymentModal.vue`: Detailed deployment view and actions
- `DeploymentFilters.vue`: Filtering and search interface

### Cron Configuration
- `CronConfigList.vue`: Manages Teams channel polling
- `CronConfigForm.vue`: Add/edit cron configurations
- `CronConfigItem.vue`: Individual cron config display

### UI Components
- `StatsGrid.vue`: Dashboard statistics overview
- `StatsCard.vue`: Individual statistic display
- `ToastContainer.vue`: Notification system
- `ToastNotification.vue`: Individual notification display

## Important Guidelines

### State Management
- Use Vue 3 Composition API with `ref` and `computed`
- Keep state close to where it's used
- Use props for parent-child communication
- Emit events for child-parent communication

### Error Handling
- Use toast notifications for user feedback
- Log errors to console with context
- Handle API errors gracefully
- Show user-friendly error messages

### API Integration
- Use Nuxt's `$fetch` for API calls
- Base URL configured via `NUXT_PUBLIC_API_BASE`
- Handle authentication errors consistently
- Validate API responses

### UI/UX Standards
- Follow TailwindCSS class naming conventions
- Use responsive design patterns
- Maintain consistent spacing (p-4, gap-4)
- Use semantic HTML elements

## Common Patterns

### Component Structure
```vue
<template>
  <div class="[component-root-class]">
    <!-- Component content -->
  </div>
</template>

<script setup>
// Props
const props = defineProps({...})

// Emits
const emit = defineEmits([...])

// State
const state = ref(...)

// Computed
const computed = computed(...)

// Methods
function handleAction() {...}
</script>
```

### API Calls
```javascript
try {
  const data = await $fetch(`${apiBase}/endpoint`, {
    method: 'POST',
    body: payload
  });
  // Handle success
} catch (error) {
  console.error('Error description:', error);
  emit('error', `User-friendly message: ${error.message}`);
}
```

### Event Handling
```javascript
// Child component
emit('action-name', payload);

// Parent component
<ChildComponent @action-name="handleAction" />
```

## Development Workflow

### Adding New Features
1. Create component in components directory
2. Use Composition API setup
3. Add to relevant parent component
4. Implement error handling
5. Add loading states
6. Test responsive behavior

### Styling Guidelines
- Use TailwindCSS utility classes
- Follow mobile-first approach
- Maintain consistent color scheme
- Use semantic class names

### Testing
- Test component rendering
- Verify API integration
- Check responsive behavior
- Validate error handling
- Test edge cases

### Performance
- Lazy load components when possible
- Optimize API calls
- Use proper caching strategies
- Monitor bundle size