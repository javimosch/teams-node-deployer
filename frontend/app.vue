<template>
  <div class="bg-gray-50 min-h-screen">
    <NuxtPage />
  </div>
</template>

<style>
/* Global styles from original index.html */
.log-entry {
  position: relative;
  padding-left: 1.5rem;
  border-left: 2px solid #e2e8f0;
}

.log-entry:before {
  content: '';
  position: absolute;
  left: -7px;
  top: 8px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #4f46e5;
}

.log-entry:last-child {
  border-left-color: transparent;
}

.branch-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.branch-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.content-preview {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c7d2fe;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a5b4fc;
}

/* Adjust main content padding to avoid overlap with footer */
.container {
  padding-bottom: 80px; /* Adjust value as needed */
}
</style>