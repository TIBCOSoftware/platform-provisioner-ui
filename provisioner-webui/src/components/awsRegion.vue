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
  <div class="pv-field-horizontal">
    <div class="label-title">Region</div>
    <div class="pipeline-field pipeline-field-region">
      <Select v-model="localRegion" :options="selectOptions" optionLabel="label" optionValue="value" class="w-full" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Select from "primevue/select";
import menuContentService from "../services/menuContentService";
import { onMounted, ref, watch, computed } from "vue";
import type { RES_AWS_REGION } from "@/types/response";
import { useMainStore } from "@/stores/store";
import type { REGION_PROP_TYPES } from "@/types/props";

const store = useMainStore();
const props = defineProps<REGION_PROP_TYPES>();

const options = ref<string[]>([]);
const localRegion = ref<string>(props.region);

const selectOptions = computed(() => options.value.map((opt) => ({ label: opt, value: opt })));

onMounted(() => {
  menuContentService.getAWSRegions().then(
    (response: RES_AWS_REGION) => {
      options.value = response["values"];
      localRegion.value = response["defaultValue"] || "us-west-2";
    },
    (error: Error) => {
      console.error("Error Getting Regions: ", error);
      localRegion.value = "us-west-2";
      options.value = ["us-west-2", "eu-west-1", "ap-southeast-2"];
    }
  );
});

// Watch localRegion and emit an event to the parent component to update the params.region
watch(localRegion, (newValue) => {
  store.setSelectedRegion(newValue);
});
</script>
