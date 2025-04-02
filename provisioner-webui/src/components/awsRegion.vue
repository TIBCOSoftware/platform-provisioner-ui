<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div class="pv-field-horizontal">
    <div class="label-title">Region</div>
    <div class="pipeline-field pipeline-field-region">
      <select class="form-select" v-model="localRegion">
        <option v-bind:value="opt" v-for="opt in options" v-bind:key="opt">{{ opt }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import menuContentService from "../services/menuContentService";
import { onMounted, ref, watch } from "vue";
import type { RES_AWS_REGION } from "@/types/response";
import { useMainStore } from "@/stores/store";
import type { REGION_PROP_TYPES } from "@/types/props";

const store = useMainStore();
const props = defineProps<REGION_PROP_TYPES>();

const options = ref<string[]>([]);
const localRegion = ref<string>(props.region);

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
