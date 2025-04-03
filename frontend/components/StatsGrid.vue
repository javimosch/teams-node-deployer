<template>
  <div class="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
    <StatsCard label="Pending" :count="stats.pending" icon="clock" color="blue" />
    <StatsCard label="Skipped" :count="stats.skipped" icon="arrow-right" color="gray" />
    <StatsCard label="Failed" :count="stats.failed" icon="exclamation-triangle" color="red" />
    <StatsCard label="Ready" :count="stats.ready" icon="check-circle" color="green" />
    <StatsCard label="Deployed" :count="stats.deployed" icon="rocket" color="purple" />
    <StatsCard label="Canceled" :count="stats.canceled" icon="ban" color="gray" />
    <!-- Add more cards if needed, e.g., for 'processing' -->
  </div>
</template>

<script setup>
import StatsCard from './StatsCard.vue';

defineProps({
  stats: {
    type: Object,
    required: true,
    default: () => ({
      pending: 0,
      skipped: 0,
      failed: 0,
      ready: 0,
      deployed: 0,
      canceled: 0,
      // processing: 0, // Example if needed
    }),
  },
});
</script>