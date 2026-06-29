<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - Licensed under the Apache License, Version 2.0 (the "License");
  - you may not use this file except in compliance with the License.
  - You may obtain a copy of the License at
  -
  -     http://www.apache.org/licenses/LICENSE-2.0
  -
  - Unless required by applicable law or agreed to in writing, software
  - distributed under the License is distributed on an "AS IS" BASIS,
  - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  - See the License for the specific language governing permissions and
  - limitations under the License.
  -->
<template>
  <div class="run-confirm-changes" v-if="changes.hasChanges">
    <div class="run-confirm-label">Changes</div>

    <!-- Friendly guiEnv changes grouped by step -->
    <div v-if="grouped.length > 0" class="gui-env-changes">
      <div v-for="group in grouped" :key="group.groupIndex" class="change-group">
        <div class="change-group-header">#{{ group.groupIndex }} {{ group.groupTitle }}</div>
        <div v-for="item in group.items" :key="item.reference" class="change-item">
          <span class="change-arrow">&rarr;</span>
          <span class="change-name">{{ item.optionName }}:</span>
          <span class="change-value">{{ formatChangeValue(item.newValue, changes.uploadedFileNames[item.reference]) }}</span>
        </div>
      </div>
    </div>

    <!-- Non-guiEnv unified diff -->
    <div v-if="changes.otherDiffText" class="other-changes">
      <div class="other-changes-label">Other changes:</div>
      <pre class="other-changes-diff"><template v-for="(line, i) in diffLines" :key="i"><span :class="diffLineClass(line)">{{ line }}
</span></template></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { groupChanges, formatChangeValue, type YamlDiffResult } from "@/changeTracker";

const props = defineProps<{
  changes: YamlDiffResult;
}>();

const grouped = computed(() => groupChanges(props.changes.guiEnvChanges));

const diffLines = computed(() => props.changes.otherDiffText.split("\n"));

const diffLineClass = (line: string) => {
  if (line.startsWith("+")) return "diff-added";
  if (line.startsWith("-")) return "diff-removed";
  if (line.startsWith("@@")) return "diff-hunk";
  return "diff-context";
};
</script>

<style scoped>
.run-confirm-changes {
  margin-top: 12px;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
}

.run-confirm-changes > .run-confirm-label {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  margin-bottom: 8px;
}

.gui-env-changes {
  max-height: 600px;
  overflow-y: auto;
}

.change-group {
  margin-bottom: 8px;
}

.change-group-header {
  font-weight: 600;
  color: var(--primary-dark);
  font-size: 0.8125rem;
  margin-bottom: 4px;
}

.change-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-left: 16px;
  font-size: 0.8125rem;
  line-height: 1.6;
}

.change-arrow {
  color: var(--primary-color);
  flex-shrink: 0;
}

.change-name {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.change-value {
  color: var(--primary-dark);
  font-weight: 500;
  word-break: break-all;
}

.other-changes {
  margin-top: 8px;
}

.other-changes-label {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  margin-bottom: 4px;
}

.other-changes-diff {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-family: var(--font-family-mono);
  font-size: 0.75rem;
  line-height: 1.5;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
}

.diff-added {
  color: var(--success-dark);
  background: var(--success-light);
}

.diff-removed {
  color: var(--danger-dark);
  background: var(--danger-light);
}

.diff-hunk {
  color: var(--primary-color);
}

.diff-context {
  color: var(--text-primary);
}
</style>
