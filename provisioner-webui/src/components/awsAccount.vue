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
    <div class="label-title">Account</div>
    <div class="pipeline-field pipeline-field-account">
      <Select
        v-model="selectedAccount"
        :options="accountOptions"
        :invalid="!selectedAccount"
        placeholder="Select an account"
        optionLabel="label"
        optionValue="value"
        optionGroupLabel="label"
        optionGroupChildren="items"
        @change="(e: any) => onChange(e.value)"
        class="w-full"
      />

    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import Select from "primevue/select";
import utils from "../utils";
import type { RES_ACCOUNT } from "@/types/response";
import { useMainStore } from "@/stores/store";
import type { ACCOUNT_PROP_TYPES } from "@/types/props";

const props = defineProps<ACCOUNT_PROP_TYPES>();

const store = useMainStore();
const accounts = ref<RES_ACCOUNT[]>([]);
const selectedAccount = ref<string | null>(props.account || null);


const accountOptions = computed(() =>
  accounts.value.map((tenantConfig) => ({
    label: tenantConfig.id,
    items: tenantConfig.roles.map((role) => ({
      label: role.id + (role.description ? ` (${role.description})` : ""),
      value: role.id
    }))
  }))
);

watch(() => props.account, (newVal) => {
  if (newVal && newVal !== selectedAccount.value) {
    selectedAccount.value = newVal;
  }
});

const onChange = (value: string) => {
  const role = accounts.value.flatMap((a) => a.roles).find((r) => r.id === value);
  store.setSelectedAccount(value, role?.description || "");
};

const fetchAccounts = async () => {
  try {
    accounts.value = await utils.httpGet("/cic2-ws/v1/accounts");
  } catch (error) {
    console.error("Error fetching accounts:", error);
  }
};
const initDefaultAccount = () => {
  utils.getUiProperties().then((properties) => {
    if (properties["ON_PREM_MODE"] === "true" && accounts?.value?.[0]?.roles?.[0]?.id) {
      const defaultRole = accounts.value[0].roles[0];
      selectedAccount.value = defaultRole.id;
      store.setSelectedAccount(defaultRole.id, defaultRole.description || "");
    }
  });
};

onMounted(async () => {
  await fetchAccounts();
  initDefaultAccount();

});
</script>

<style>
/* Mimic native <optgroup> styling */
.p-select-overlay .p-select-option-group {
  cursor: default !important;
}
.p-select-overlay .p-select-option-group-label {
  font-weight: 700 !important;
  font-size: 0.875rem !important;
  color: var(--p-text-muted-color, #6c757d) !important;
}
.p-select-overlay .p-select-option {
  padding-left: 1.5rem !important;
}
</style>
