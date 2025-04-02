<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div class="pv-field-horizontal">
    <div class="label-title">Account</div>
    <div class="pipeline-field pipeline-field-account">
      <select class="form-select" v-model="state.account" @change="onChange($event)">
        <optgroup :label="tenantConfig.id" v-for="(tenantConfig, index) in accounts" :key="index">
          <option :value="role.id" v-for="(role, j) in tenantConfig.roles" :key="j">
            {{ role.id }}{{ role.description ? ` (${role.description})` : "" }}
          </option>
        </optgroup>
      </select>
      <small class="pv-error" v-if="v$.account.$error && v$.account.$dirty"> It's required. </small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import useVuelidate from "@vuelidate/core";
import { required } from "@vuelidate/validators";
import utils from "../utils";
import type { RES_ACCOUNT } from "@/types/response";
import { useMainStore } from "@/stores/store";
import type { ACCOUNT_PROP_TYPES } from "@/types/props";

const props = defineProps<ACCOUNT_PROP_TYPES>();

const store = useMainStore();
const accounts = ref<RES_ACCOUNT[]>([]);
const state = reactive({
  account: props.account
});

const rules = {
  account: { required }
};

const v$ = useVuelidate(rules, state);

const onChange = (event: Event) => {
  const account = (event.target as HTMLInputElement).value;
  store.setSelectedAccount(account);
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
      state.account = accounts.value[0].roles[0].id;
      store.setSelectedAccount(state.account);
    }
  });
};

onMounted(() => {
  v$.value.$touch();
  fetchAccounts();
  initDefaultAccount();
});
</script>
