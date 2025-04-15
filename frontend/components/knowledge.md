# Frontend Components Knowledge Base

## Component Categories

### Core Components

#### DeploymentListItem
- Displays individual deployment entries
- Handles status computation and display
- Shows approval state and timestamps
- Manages content preview and truncation

#### DeploymentModal
- Detailed deployment information view
- Handles approval/rejection actions
- Shows processing logs and errors
- Manages branch blacklisting

#### DeploymentGroup
- Groups deployments by status/category
- Implements expandable sections
- Manages group statistics
- Handles sorting and filtering

### Configuration Components

#### CronConfigList
- Manages Teams channel polling configurations
- Handles CRUD operations for configs
- Implements channel search and selection
- Manages schedules and patterns

#### CronConfigForm
- Adds new channel configurations
- Validates cron schedules
- Handles channel selection
- Manages trigger word patterns

### UI Components

#### StatsGrid/StatsCard
- Displays deployment statistics
- Uses consistent color coding
- Shows counts and trends
- Implements responsive layout

#### Toast System
- Manages notifications stack
- Handles different message types
- Implements auto-dismiss
- Manages animation states

## Common Component Patterns

### Props Structure
```javascript
const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  config: {
    type: Object,
    default: () => ({})
  }
});
```

### Event Emission
```javascript
const emit = defineEmits(['update', 'delete', 'error']);

function handleAction() {
  emit('action-name', payload);
}
```

### Error Handling
```javascript
try {
  // Action logic
  emit('success', 'Operation successful');
} catch (error) {
  console.error('Component: Error details:', error);
  emit('error', 'User-friendly error message');
}
```

### Loading States
```javascript
const isLoading = ref(false);

async function performAction() {
  isLoading.value = true;
  try {
    // Action logic
  } finally {
    isLoading.value = false;
  }
}
```

## Style Guidelines

### Layout Classes
- Container: `p-4 rounded-lg shadow`
- Grid: `grid grid-cols-12 gap-4`
- Flex: `flex items-center justify-between`
- Spacing: `space-y-4 gap-4`

### Color Scheme
- Primary: `text-indigo-600 bg-indigo-100`
- Success: `text-green-600 bg-green-100`
- Error: `text-red-600 bg-red-100`
- Warning: `text-yellow-600 bg-yellow-100`

### Typography
- Headers: `text-lg font-semibold text-gray-800`
- Body: `text-sm text-gray-600`
- Labels: `text-xs font-medium text-gray-500`

### Interactive Elements
- Buttons: `px-4 py-2 rounded-lg bg-indigo-600 text-white`
- Inputs: `px-3 py-2 border rounded-md focus:ring-2`
- Toggle: `relative inline-flex items-center`

## Best Practices

### Component Design
- Keep components focused and single-purpose
- Use composition API for logic organization
- Implement proper prop validation
- Handle all possible states

### Performance
- Use computed properties for derived data
- Implement proper caching strategies
- Lazy load when appropriate
- Optimize re-renders

### Accessibility
- Use semantic HTML elements
- Include ARIA labels
- Maintain keyboard navigation
- Provide proper contrast

### Responsive Design
- Use mobile-first approach
- Implement proper breakpoints
- Test all viewport sizes
- Handle touch interactions