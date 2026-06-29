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
  <div class="pipeline-options" v-if="pipelineGroups.length > 0">
    <Stepper :value="activeStep" @update:value="onStepChange">
      <StepList v-if="pipelineGroups.length > 1">
        <Step
          :value="group.index"
          :class="{
            'pipeline-step-error': !group.isValid,
            'pipeline-step-other': group.index === OTHER_GROUP_INDEX
          }"
          v-for="group in pipelineGroups"
          :key="group.index"
        >
          <strong>{{ group.title }}</strong>
        </Step>
      </StepList>
      <StepPanels>
        <StepPanel v-slot="{ activateCallback }" :value="group.index" v-for="(group, groupIndex) in pipelineGroups" :key="group.index">
            <MarkdownView :content="group.description" v-if="group.description" />
            <fieldset :class="['pipeline-option', { 'indent-fieldset': isDependentField(opt) }]" v-for="(opt, optionIndex) in group.options" :key="opt.name" :data-reference="opt.reference">
              <div class="pipeline-option-title" :title="opt.reference" v-if="['multiselect', 'radio', 'textarea'].includes(opt.guiType)">
                {{ opt.name }}
                <i class="bi" :class="{ 'bi-lock': opt.value, 'bi-unlock': !opt.value }" v-if="isToggleField(opt)"></i>
              </div>

              <!-- for guiType: input (string, number, password) -->
              <div v-if="opt.guiType === 'input'" :class="'pipeline-option-' + opt.guiType">
                <label class="pipeline-option-title" :for="getInputId(opt.guiType, groupIndex, optionIndex)" :title="opt.reference">
                  {{ opt.name }}
                  <i class="bi" :class="{ 'bi-lock': opt.value, 'bi-unlock': !opt.value }" v-if="isToggleField(opt)"></i>
                </label>
                <div class="field-container">
                  <InputNumber
                    v-if="opt.type === 'number'"
                    :modelValue="Number(opt.value)"
                    :inputId="getInputId(opt.guiType, groupIndex, optionIndex)"
                    :invalid="opt.required && opt.value === ''"
                    @update:modelValue="(val: number | null) => onNaiveInputChange(opt, val ?? 0)"
                    class="w-full"
                  />
                  <Password
                    v-else-if="opt.type === 'password'"
                    :modelValue="String(opt.value ?? '')"
                    :inputId="getInputId(opt.guiType, groupIndex, optionIndex)"
                    :invalid="opt.required && opt.value === ''"
                    :feedback="false"
                    toggleMask
                    :inputProps="{ autocomplete: 'new-password' }"
                    @update:modelValue="(val: string) => onNaiveInputChange(opt, val)"
                    class="w-full"
                  />
                  <InputText
                    v-else
                    type="text"
                    autocomplete="new-password"
                    :modelValue="String(opt.value ?? '')"
                    :id="getInputId(opt.guiType, groupIndex, optionIndex)"
                    :invalid="opt.required && opt.value === ''"
                    @update:modelValue="(val: string) => onNaiveInputChange(opt, val)"
                    class="w-full"
                  />
                  <div class="description" v-if="opt.description" v-html="opt.description"></div>
                  <small class="pv-error" role="alert" v-if="opt.required && opt.value === ''"> It's required. </small>
                </div>
              </div>

              <!-- for guiType: file -->
              <div v-if="opt.guiType === 'file'" :class="'pipeline-option-' + opt.guiType">
                <label class="pipeline-option-title" :for="getInputId(opt.guiType, groupIndex, optionIndex)" :title="opt.reference">
                  {{ opt.name }}
                  <i class="bi" :class="{ 'bi-lock': opt.value, 'bi-unlock': !opt.value }" v-if="isToggleField(opt)"></i>
                </label>
                <div class="field-container">
                  <input
                    type="file"
                    class="form-control"
                    :id="getInputId(opt.guiType, groupIndex, optionIndex)"
                    :accept="opt.accept || undefined"
                    v-on:input="onFileChange(opt, $event)"
                  />
                  <div class="description" v-if="opt.description" v-html="opt.description"></div>
                  <small class="pv-error" role="alert" v-if="opt.required && opt.value === ''"> It's required. </small>
                  <small class="pv-error" role="alert" v-if="opt.error">{{ opt.error }}</small>
                </div>
              </div>

              <!-- for guiType: checkbox (boolean) -->
              <div v-if="opt.guiType === 'checkbox'" :class="'pipeline-option-' + opt.guiType">
                <label class="pipeline-option-title" :title="opt.reference" @click.prevent="toggleSwitch(opt)">
                  <ToggleSwitch
                    :modelValue="opt.value === true"
                    @update:modelValue="
                      (val: boolean) => {
                        opt.value = val;
                        onInputChange(opt);
                      }
                    "
                  />
                  <span>{{ opt.name }}</span>
                  <i class="bi" :class="{ 'bi-lock': opt.value, 'bi-unlock': !opt.value }" v-if="isToggleField(opt)"></i>
                </label>
                <div>
                  <div class="description" v-if="opt.description" v-html="opt.description"></div>
                  <small class="pv-error" role="alert" v-if="opt.required && typeof opt.value !== 'boolean'">
                    Check the right side YAML editor, the value MUST be 'true' or 'false'.
                  </small>
                </div>
              </div>

              <!-- for guiType: multiselect -->
              <div v-if="opt.guiType === 'multiselect'" :class="'pipeline-option-' + opt.guiType">
                <div v-for="(options, _index) in multiselectOptions(opt, groupIndex, optionIndex)" :key="_index" class="label-group">
                  <div v-for="item in options" :key="item.id" class="checkbox-item">
                    <Checkbox
                      :modelValue="opt.value"
                      :inputId="item.id"
                      :value="item.value"
                      @update:modelValue="
                        (val: (string | number)[]) => {
                          opt.value = val;
                          onInputChange(opt);
                        }
                      "
                    />
                    <label :for="item.id">{{ item.label }}</label>
                  </div>
                </div>
                <div class="description" v-if="opt.description" v-html="opt.description"></div>
                <small class="pv-error" role="alert" v-if="opt.required && (!opt.value || opt.value.length === 0)"> It's required. </small>
              </div>

              <!-- for guiType: radio -->
              <div v-if="opt.guiType === 'radio'" :class="'pipeline-option-' + opt.guiType">
                <div v-for="(options, _index) in multiselectOptions(opt, groupIndex, optionIndex)" :key="_index" class="label-group">
                  <div v-for="item in options" :key="item.id" class="radio-item">
                    <RadioButton
                      :modelValue="opt.value"
                      :inputId="item.id"
                      :value="item.value"
                      @update:modelValue="
                        (val: string) => {
                          opt.value = val;
                          onInputChange(opt);
                        }
                      "
                    />
                    <label :for="item.id">{{ item.label }}</label>
                  </div>
                </div>
                <div class="description" v-if="opt.description" v-html="opt.description"></div>
                <small class="pv-error" role="alert" v-if="opt.required && (!opt.value || opt.value.length === 0)"> It's required. </small>
              </div>

              <!-- for guiType: dropdown -->
              <div v-if="opt.guiType === 'dropdown'" :class="'pipeline-option-' + opt.guiType">
                <div class="pipeline-option-title" :title="opt.reference">
                  {{ opt.name }}
                  <i
                    class="bi"
                    :class="{ 'bi-lock': opt.value, 'bi-unlock': !opt.value }"
                    v-if="opt.disableOtherFieldsWhenSet && opt.disableOtherFieldsWhenSet.length"
                  ></i>
                </div>
                <div class="field-container">
                  <Select
                    :modelValue="opt.value || null"
                    :options="getDropdownOptions(opt)"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Select an option"
                    :invalid="opt.required && (!opt.value || opt.value.length === 0)"
                    @change="
                      (e: any) => {
                        opt.value = e.value;
                        onInputChange(opt);
                      }
                    "
                    class="w-full"
                  />

                  <div class="description" v-if="opt.description" v-html="opt.description"></div>
                  <small class="pv-error" role="alert" v-if="opt.required && (!opt.value || opt.value.length === 0)"> It's required. </small>
                </div>
              </div>

              <!-- for guiType: autocomplete -->
              <div v-if="opt.guiType === 'autocomplete'" :class="'pipeline-option-' + opt.guiType">
                <div class="pipeline-option-title" :title="opt.reference">
                  {{ opt.name }}
                  <i
                    class="bi"
                    :class="{ 'bi-lock': opt.value, 'bi-unlock': !opt.value }"
                    v-if="opt.disableOtherFieldsWhenSet && opt.disableOtherFieldsWhenSet.length"
                  ></i>
                </div>
                <div class="field-container">
                  <AutoComplete
                    v-model="opt.value"
                    :suggestions="getAutoCompleteOptions(opt)"
                    @complete="(e: any) => onAutoCompleteInput(e.query, opt)"
                    @item-select="(e: any) => { opt.value = e.value; onInputChange(opt); }"
                    @focus="() => onAutoCompleteDropdownClick(opt)"
                    dropdown
                    placeholder="Search or type..."
                    class="w-full"
                  />
                  <div class="description" v-if="opt.description" v-html="opt.description"></div>
                  <small class="pv-error" role="alert" v-if="opt.required && (!opt.value || opt.value.length === 0)"> It's required. </small>
                  <small class="pv-error" role="alert" v-if="opt.error">{{ opt.error }}</small>
                </div>
              </div>

              <!-- for guiType: textarea -->
              <div v-if="opt.guiType === 'textarea'" :class="'pipeline-option-' + opt.guiType">
                <div :id="getInputId(opt.guiType, groupIndex, optionIndex)"></div>
                <div class="description" v-if="opt.description" v-html="opt.description"></div>
                <small class="pv-error" role="alert" v-if="opt.required && opt.value === ''"> It's required. </small>
              </div>
            </fieldset>
            <div class="step-buttons" :class="{ 'justify-end': groupIndex === 0 }" v-if="!isShowYamlInPage">
              <Button v-if="groupIndex > 0" severity="secondary" @click="goToStep(pipelineGroups[groupIndex - 1].index)">
                <i class="bi bi-arrow-left" />
                Back
              </Button>
              <Button v-if="groupIndex < pipelineGroups.length - 1" severity="info" @click="goToStep(pipelineGroups[groupIndex + 1].index)">
                Next
                <i class="bi bi-arrow-right" />
              </Button>
              <div class="d-flex" v-if="groupIndex === pipelineGroups.length - 1">
                <Button severity="success" :disabled="isInValid || isEditingYaml" @click="onPipelineDeploy">
                  <i class="bi bi-check-lg" />
                  Run
                </Button>
                <Button severity="info" :disabled="isInValid || isEditingYaml" @click="openStatusLink" v-if="isShowStatus">
                  <i class="bi bi-gear" />
                  Status
                </Button>
              </div>
            </div>
        </StepPanel>
      </StepPanels>
    </Stepper>
  </div>
  <Dialog v-model:visible="showRunConfirm" header="Confirm Pipeline Run" :modal="true" :closable="true" :style="{ width: yamlChanges.hasChanges ? '920px' : '480px' }">
    <div class="run-confirm-content">
      <p>Are you sure you want to run this pipeline?</p>
      <div class="run-confirm-details">
        <div class="run-confirm-item">
          <span class="run-confirm-label">Account</span>
          <span class="run-confirm-value">
            {{ store.changedPipelineDeployParams.account }}
            <span class="run-confirm-desc" v-if="store.accountDescription">({{ store.accountDescription }})</span>
          </span>
        </div>
        <div class="run-confirm-item">
          <span class="run-confirm-label">Region</span>
          <span class="run-confirm-value">{{ store.changedPipelineDeployParams.region }}</span>
        </div>
        <div class="run-confirm-item">
          <span class="run-confirm-label">Pipeline</span>
          <span class="run-confirm-value">{{ store.changedPipelineDeployParams.pipeline }}</span>
        </div>
        <div class="run-confirm-item" v-if="route.query.title">
          <span class="run-confirm-label">Recipe</span>
          <span class="run-confirm-value">{{ route.query.title }}</span>
        </div>
      </div>
      <RunConfirmChanges :changes="yamlChanges" />
    </div>
    <template #footer>
      <Button severity="secondary" @click="showRunConfirm = false">Cancel</Button>
      <Button severity="success" @click="confirmDeploy">
        <i class="bi bi-check-lg" />
        Run
      </Button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import Button from "primevue/button";
import AutoComplete from "primevue/autocomplete";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Password from "primevue/password";
import ToggleSwitch from "primevue/toggleswitch";
import Checkbox from "primevue/checkbox";
import RadioButton from "primevue/radiobutton";
import Select from "primevue/select";
import Stepper from "primevue/stepper";
import StepList from "primevue/steplist";
import StepPanels from "primevue/steppanels";
import Step from "primevue/step";
import StepPanel from "primevue/steppanel";
import Dialog from "primevue/dialog";
import { ref, toRaw, onBeforeUnmount, watch, computed, nextTick } from "vue";
import { debounce, fromEvent, of, Subject, Subscription, tap, timer } from "rxjs";
import MarkdownView from "@/components/MarkdownView.vue";
import RunConfirmChanges from "@/components/RunConfirmChanges.vue";
import ace from "ace-builds";
import type { PIPELINE_GROUPS, PIPELINE_OPTION } from "@/types/pipeline";
import { useMainStore } from "@/stores/store";
import type { PIPELINE_OPTIONS_PROP_TYPES } from "@/types/props";
import utils, { formatDataType, toHashKey } from "@/utils";
import { useRoute } from "vue-router";
import { OTHER_GROUP_INDEX } from "@/types/global";
import router from "@/router";
import _ from "lodash";
import { computeYamlChanges, type YamlDiffResult } from "@/changeTracker";
import type { GITHUB_INFO } from "@/types/response";

// for CDN resource
// ace.config.set("basePath", "https://cdn.jsdelivr.net/npm/ace-builds@" + ace.version + "/src-noconflict/");
// for local resource: need to copy the ace-builds folder from node_modules folder to the public folder
ace.config.set("basePath", "/ace-builds/src-min-noconflict/");

type MULTI_OPTIONS = {
  label: string;
  value: string;
  id: string;
  name: string;
};
type STEPPER_INDEX = number | string;

const props = defineProps<PIPELINE_OPTIONS_PROP_TYPES>();

const store = useMainStore();
const route = useRoute();

const isShowStatus = ref<boolean>(false);
const showRunConfirm = ref(false);
const isEditingYaml = computed(() => store.isEditingYaml);
// if the route.hash is empty or "props.pipelineGroups[0].index" is null or undefined, the activeStep will be 0
const getStepIndex = (pipelineGroups: PIPELINE_GROUPS[]) => {
  if (route.hash) {
    const realHash = route.hash.slice(1);
    // if route.hash can convert to number, return the number, else return string
    return isNaN(Number(realHash)) ? realHash : Number(realHash);
  }
  return pipelineGroups[0]?.index ?? 0;
};
const activeStep = ref<STEPPER_INDEX>(getStepIndex(props.pipelineGroups));
const editors = ref<Map<string, InstanceType<typeof ace.Editor>>>(new Map());
const autoCompleteCached = ref<Record<string, string[]>>({});
const autoCompleteFiltered = ref<Record<string, string[]>>({});

const goToStep = (index: STEPPER_INDEX) => {
  onStepChange(index);
};

const getAutoCompleteOptions = (opt: PIPELINE_OPTION) => {
  const hashKey = toHashKey(opt.reference);
  const filtered = autoCompleteFiltered.value[hashKey];
  if (!filtered) return [];
  return filtered;
};

const onAutoCompleteInput = (val: string, opt: PIPELINE_OPTION) => {
  opt.value = val;
  const { reference, dataSourceUrl } = opt;
  if (!reference || !dataSourceUrl) return;

  const hashKeyDataSourceUrl = toHashKey(dataSourceUrl);
  const hashKeyReference = toHashKey(reference);
  const cachedData = autoCompleteCached.value[hashKeyDataSourceUrl];
  if (cachedData) {
    const q = val.trim().toLowerCase();
    autoCompleteFiltered.value[hashKeyReference] = q ? cachedData.filter((item) => item.toLowerCase().includes(q)) : [...cachedData];
  } else {
    onAutoCompleteDropdownClick(opt);
  }
  onInputChange(opt);
};

const localStorageKey = "helmChartConfig";
const subscriptions: Subscription[] = [];
const inputSubject = new Subject<PIPELINE_OPTION>();
const breakLineLimit = 4; // Number of the input radio or checkbox per line

const yamlChanges = ref<YamlDiffResult>({ guiEnvChanges: [], otherDiffText: "", hasChanges: false, uploadedFileNames: {} });
const onPipelineDeploy = () => {
  yamlChanges.value = computeYamlChanges(
    toRaw(store.originalRecipeContent),
    toRaw(store.yamlEditorContent),
    props.pipelineGroups,
    toRaw(store.uploadedFileNames)
  );
  showRunConfirm.value = true;
};
const confirmDeploy = () => {
  showRunConfirm.value = false;
  utils.deployPipeline(store.changedPipelineDeployParams, store.yamlEditorContent);
  isShowStatus.value = true;
};
const openStatusLink = () => {
  const url = `/status?account=${store.changedPipelineDeployParams.account}&action=pipeline`;
  utils.openNewTab(url);
};
const getInputId = (guiType: string, pipelineGroupIndex: number, pipelineOptionIndex: number, labelIndex?: number) => {
  const arr = [guiType, pipelineGroupIndex, pipelineOptionIndex];
  if (labelIndex !== undefined) {
    arr.push(labelIndex);
  }
  return arr.join("_");
};
const getInputName = (guiType: string, pipelineGroupIndex: number, pipelineOptionIndex: number) => {
  return getInputId(guiType, pipelineGroupIndex, pipelineOptionIndex);
};
const multiselectOptions = (opt: PIPELINE_OPTION, pipelineGroupIndex: number, optionIndex: number) => {
  return opt.labels?.reduce((grouped: MULTI_OPTIONS[][], label: string, index: number) => {
    const groupIndex = Math.floor(index / breakLineLimit);
    if (!grouped[groupIndex]) {
      grouped[groupIndex] = [];
    }
    grouped[groupIndex].push({
      label: label,
      value: (opt?.values ?? [])[index],
      id: getInputId(opt.guiType, pipelineGroupIndex, optionIndex, index),
      name: getInputName(opt.guiType, pipelineGroupIndex, optionIndex)
    });
    return grouped;
  }, []);
};
const initRichTextarea = () => {
  const groupIndex = props.pipelineGroups?.findIndex((group) => group.index === activeStep.value);
  if (groupIndex === -1) {
    return;
  }
  props.pipelineGroups[groupIndex].options.forEach((opt: PIPELINE_OPTION, optionIndex: number) => {
    if (opt.guiType === "textarea") {
      const editorId = getInputId(opt.guiType, groupIndex, optionIndex);
      initAceEditor(opt, editorId);
    }
  });
};

const initAceEditor = (opt: PIPELINE_OPTION, editorId: string) => {
  let editor = editors.value.get(editorId);
  if (!editor) {
    editor = ace.edit(editorId, {
      mode: `ace/mode/${opt?.lang?.toLowerCase() || "yaml"}`,
      maxLines: 40,
      minLines: 10,
      tabSize: 2,
      wrap: true,
      showPrintMargin: false,
      readOnly: false,
      fontFamily: "'SFMono-Regular', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Menlo, Monaco, Consolas, 'Courier New', monospace",
      fontSize: 13
    });
    editors.value.set(editorId, editor);
  }
  // Only update the value of the textarea when the new value is different from the current value of the textarea
  if (editor.getValue() !== opt.value) {
    editor.setValue(opt.value || "", -1);
  }
  subscriptions.push(
    fromEvent(editor.session, "change")
      // No need to use throttle function here, because the next inputSubject.next() will throttle
      .subscribe(() => {
        const newOpt = {
          ...opt,
          value: editor.getValue()
        };
        onInputChange(newOpt);
      })
  );
};

const onFileChange = (opt: PIPELINE_OPTION, event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  const MAX_FILE_SIZE_KB = opt.fileSize || 100; // Maximum file size in KB
  if (file) {
    // Check if the file size exceeds the limit
    opt.error = "";
    if (file.size > MAX_FILE_SIZE_KB * 1024) {
      opt.error = `File size exceeds ${MAX_FILE_SIZE_KB} KB. Please upload a smaller file.`;
      const newOpt = {
        ...opt,
        value: " " // when the file size exceeds the limit, the value is set to a space to trigger the file is selected
      };
      emitPipelineOptionFieldChange(newOpt);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      // Convert ArrayBuffer to Uint8Array
      const uint8Array = new Uint8Array(arrayBuffer);

      // Convert Uint8Array to a binary string
      let binaryString = "";
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }

      // Encode the binary string as Base64
      const newOpt = {
        ...opt,
        value: btoa(binaryString)
      };
      store.setUploadedFileName(opt.reference, file.name);
      emitPipelineOptionFieldChange(newOpt);
    };
    reader.readAsArrayBuffer(file);
  }
};

// Immediately validate all pipeline groups so that group.isValid, step indicators,
// error messages and the Run button update without waiting for the store round-trip.
const validateGroups = () => {
  const validators: Record<string, (value: unknown) => boolean> = {
    password: (value) => value !== "",
    string: (value) => value !== "",
    number: _.isNumber,
    boolean: _.isBoolean,
    array: (value) => _.isArray(value) && (value as unknown[]).length > 0
  };
  props.pipelineGroups.forEach((group) => {
    let isValid = true;
    for (const option of group.options) {
      if (option.required) {
        const validator = validators[option.type];
        if (validator && !validator(option.value)) {
          isValid = false;
          break;
        }
      }
    }
    group.isValid = isValid;
  });
};

const onNaiveInputChange = (opt: PIPELINE_OPTION, value: string | number) => {
  opt.value = value;
  validateGroups();
  const newOpt = { ...opt, value };
  inputSubject.next(newOpt);
  nextTick(() => {
    checkboxDisableOtherFields(newOpt, true);
    checkboxEnableOtherFields(newOpt, true);
  });
};

const toggleSwitch = (opt: PIPELINE_OPTION) => {
  opt.value = !opt.value;
  onInputChange(opt);
};

const getDropdownOptions = (opt: PIPELINE_OPTION) => {
  return (opt.values ?? []).map((val, index) => ({
    label: (opt.labels ?? [])[index] ?? val,
    value: val
  }));
};

const onInputChange = (opt: PIPELINE_OPTION) => {
  validateGroups();
  const newOpt = { ...opt };
  inputSubject.next(newOpt);
  nextTick(() => {
    checkboxDisableOtherFields(newOpt, true);
    checkboxEnableOtherFields(newOpt, true);
  });
};

const getChartUrl = (val: any) => {
  if (typeof val === "string") {
    return val.trim();
  }
  if (val && typeof val === "object" && typeof val.url === "string") {
    return val.url.trim();
  }
  return "";
};

const onAutoCompleteDropdownClick = (opt: PIPELINE_OPTION) => {
  let { reference, dataSourceUrl } = opt;
  if (!reference || !dataSourceUrl) {
    return;
  }
  const hashKeyDataSourceUrl = toHashKey(dataSourceUrl);
  const hashKeyReference = toHashKey(reference);
  const cachedData = autoCompleteCached.value[hashKeyDataSourceUrl];
  if (cachedData) {
    autoCompleteFiltered.value[hashKeyReference] = [...cachedData];
    return;
  }

  // Load saved config from local storage
  const savedConfig = localStorage.getItem(localStorageKey);
  let helmChartVersionsLocalStorageData: GITHUB_INFO | null = null;
  if (savedConfig) {
    helmChartVersionsLocalStorageData = JSON.parse(savedConfig);
    const helmChartUrl = getChartUrl(helmChartVersionsLocalStorageData?.helmChartUrl);
    if (helmChartUrl) {
      dataSourceUrl += `&helmChartUrl=${encodeURIComponent(helmChartUrl)}`;
    }
  }

  const q = opt.value.trim();
  utils
    .httpGet(dataSourceUrl)
    .then((response: string[]) => {
      autoCompleteCached.value[hashKeyDataSourceUrl] = [...response];
      autoCompleteFiltered.value[hashKeyReference] = q ? response.filter((item) => item.toLowerCase().includes(q)) : [...response];
    })
    .catch(() => {
      autoCompleteFiltered.value[hashKeyReference] = [];
    });
};

const isToggleField = (opt: PIPELINE_OPTION): boolean => {
  // only show lock/unlock icon for disableOtherFieldsWhenSet attribute
  return !!opt.disableOtherFieldsWhenSet?.length;
};

// Set of every reference that is targeted by some option's
// enable/disableOtherFieldsWhenSet. Built once per store change so the per-option
// isDependentField() lookup in the template is O(1) instead of O(n) (avoids O(n^2)
// across all rendered options).
//
// originalOptionsContent defaults to {} in the store, and after a recipe loads it is
// populated via setOriginalOptionsContent() -> resetObjectAndAssign(). Because that assigns
// an array onto an existing plain object, the runtime value is an array-LIKE object with
// numeric keys ({ "0": opt, "1": opt }), NOT a true Array. Object.values() handles both the
// empty default {} (no crash) and the populated array-like object (feature works).
const dependentFieldReferences = computed<Set<string>>(() => {
  const references = new Set<string>();
  const options = store.originalOptionsContent;
  if (!options || typeof options !== "object") {
    return references;
  }
  (Object.values(options) as PIPELINE_OPTION[]).forEach((o: PIPELINE_OPTION) => {
    o?.enableOtherFieldsWhenSet?.forEach((ref) => references.add(ref));
    o?.disableOtherFieldsWhenSet?.forEach((ref) => references.add(ref));
  });
  return references;
});

const isDependentField = (opt: PIPELINE_OPTION): boolean => {
  return dependentFieldReferences.value.has(opt.reference);
};

const isFieldActive = (opt: PIPELINE_OPTION): boolean => {
  switch (opt.type) {
    case "number":
      return Number(opt.value) !== 0;
    case "string":
      return opt.value !== "";
    case "boolean":
      return opt.value === true;
    case "array":
      return Array.isArray(opt.value) && opt.value.length > 0;
    default:
      return false;
  }
};

const getFieldInactiveValue = (type: string): any => {
  // Lowercase the type to stay consistent with formatDataType() (utils.ts), which matches
  // type names case-insensitively. Otherwise a non-lowercase type (e.g. "Boolean") would
  // fall through to the default and reset to "" instead of the correct typed inactive value.
  switch ((type ?? "").toLowerCase()) {
    case "boolean":
      return false;
    case "number":
      return 0;
    case "string":
      return "";
    case "array":
      return [];
    default:
      return "";
  }
};

const toggleFields = (fields: string[] | undefined, disable: boolean, isEmitInputChange = false) => {
  if (fields && fields.length > 0) {
    fields.forEach((field, i) => {
      document.querySelectorAll('[data-reference="' + field + '"]').forEach((fieldset) => {
        if (fieldset instanceof HTMLElement) {
          fieldset.classList.toggle("disabled-fieldset", disable);
        }
      });

      const otherOpt = _.find(store.originalOptionsContent, { reference: field });
      if (isEmitInputChange && otherOpt) {
        let newValue;
        if (disable) {
          newValue = getFieldInactiveValue(otherOpt.type);
        } else {
          newValue = formatDataType(otherOpt.type, _.get(store.originalRecipeContent, field));
        }
        otherOpt.value = newValue;

        setTimeout(
          () => {
            inputSubject.next(otherOpt);
          },
          300 * (i + 1)
        );
      }
    });
  }
};

const checkboxDisableOtherFields = (opt: PIPELINE_OPTION, isEmitInputChange = false) => {
  const isFiledActive = isFieldActive(opt);
  toggleFields(opt.disableOtherFieldsWhenSet, isFiledActive, isEmitInputChange);
};
const checkboxEnableOtherFields = (opt: PIPELINE_OPTION, isEmitInputChange = false) => {
  const isFiledActive = isFieldActive(opt);
  toggleFields(opt.enableOtherFieldsWhenSet, !isFiledActive, isEmitInputChange);
};
const initCheckboxToggleOtherFields = (options: PIPELINE_OPTION[]) => {
  if (options && options.length > 0) {
    options.forEach((opt: PIPELINE_OPTION) => {
      checkboxDisableOtherFields(opt);
      checkboxEnableOtherFields(opt);
    });
  }
};
const emitPipelineOptionFieldChange = (option: PIPELINE_OPTION) => {
  store.setPipelineOptionField(option);
};
let inputSubscription: Subscription | null = null;
const initInputChange = () => {
  // Only create the inputSubject subscription once.
  // It must NOT be in the `subscriptions` array, because `unsubscribe()` is called
  // by `onStepChange()` which is triggered by the deep watcher on `pipelineGroups`.
  // When a dropdown/checkbox changes opt.value, the deep watcher fires and calls
  // unsubscribe(), which would cancel the debounced emission before it reaches the store.
  if (inputSubscription) {
    return;
  }
  inputSubscription = inputSubject
    .pipe(
      tap(() => store.setIsEditingYaml(true)),
      debounce((opt: PIPELINE_OPTION) => (opt.guiType === "autocomplete" ? of(opt) : timer(200)))
    )
    .subscribe((opt: PIPELINE_OPTION) => {
      emitPipelineOptionFieldChange(opt);
      store.setIsEditingYaml(false);
    });
};

const unsubscribe = () => {
  subscriptions.forEach((sub) => sub.unsubscribe());
};

const onStepChange = (index: STEPPER_INDEX) => {
  // get current pipeline options, and initialize the checkboxDisableOtherFields
  const currentPipelineOptions = _.find(props.pipelineGroups, { index })?.options || [];
  nextTick(() => {
    initCheckboxToggleOtherFields(currentPipelineOptions);
  });
  activeStep.value = index;
  unsubscribe();
  nextTick(() => {
    initRichTextarea();
    initInputChange();
  });
};
watch(
  () => props.pipelineGroups,
  (newValue, oldValue) => {
    // When the pipelineGroups oldValue is empty and the newValue is not empty,
    // it means that the pipelineGroups data has been obtained, initialize the default stepper
    if (oldValue.length === 0 && newValue.length > 0) {
      onStepChange(getStepIndex(newValue));
    } else {
      // When the pipelineGroups data changes, reactivate the current stepper
      onStepChange(activeStep.value);
    }
  },
  { deep: true }
);

// When the selectedPipeline changes, clear the editors, because of the pipeline options field are different now.
watch(
  () => store.selectedPipeline,
  () => {
    editors.value = new Map();
  }
);
watch(
  () => activeStep.value,
  (newValue) => {
    // When the default stepper index is the same as the current activeStep index,
    // there is no need to add a hash in the URL
    if (newValue === getStepIndex(props.pipelineGroups)) {
      return;
    }
    router.replace({
      path: route.path,
      query: route.query,
      hash: "#" + newValue
    });
  }
);

onBeforeUnmount(() => {
  unsubscribe();
  inputSubscription?.unsubscribe();
  inputSubscription = null;
});
</script>

<style lang="less" scoped>
.pipeline-options {
  height: fit-content;
  padding-bottom: 20px;

  .markdown-body {
    padding: 6px 10px;
    margin-bottom: 8px;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    border-left: 2px solid var(--primary-color);
    line-height: 1.5;
  }

  :deep(.p-stepper) {
    display: flex;
    align-items: flex-start;

    .p-steplist {
      flex-direction: column;
      align-items: flex-start;
      overflow: visible;
      position: sticky;
      top: 80px;
      max-width: 360px;
      width: max-content;
      margin-right: 16px;
      z-index: 10;
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      min-width: 200px;
      gap: 2px;

      // Steps before active: use active style (primary color)
      // Then reset steps after active back to default via ~ combinator
      .p-step {
        flex-direction: column;
        flex: none;
        position: relative;
        overflow: visible;
        --p-stepper-step-number-size: 1.5rem;
        --p-stepper-step-number-background: var(--primary-color);
        --p-stepper-step-number-color: #fff;
        --p-stepper-step-number-border-color: var(--primary-color);
        --p-stepper-step-number-active-background: var(--primary-color);
        --p-stepper-step-number-active-color: #fff;
        --p-stepper-step-number-active-border-color: var(--primary-color);
        margin-bottom: 0;
        gap: 0;
        padding: 0 0 6px;
        width: 100%;

        // Vertical connector: line from circle to next circle, arrow in middle
        // Gap to next circle: gap(2px) + next header padding-top(8px) = 10px below step edge
        &:not(:last-child)::after {
          content: "";
          position: absolute;
          left: 23.5px;
          top: calc(8px + 1.5rem);
          bottom: -10px;
          width: 0;
          border-left: 2px solid var(--text-muted);
          z-index: 2;
        }

        &:not(:last-child)::before {
          content: "";
          position: absolute;
          left: 19.5px;
          bottom: -2px;
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 7px solid var(--text-muted);
          z-index: 2;
        }

        &.pipeline-step-error {
          --p-stepper-step-number-background: var(--danger-color);
          --p-stepper-step-number-active-background: var(--danger-color);
          --p-stepper-step-number-border-color: var(--danger-color);
          --p-stepper-step-number-active-border-color: var(--danger-color);
          --p-stepper-step-number-color: var(--danger-light);
          .p-step-header:hover {
            .p-step-number {
              background: var(--danger-color);
              color: var(--danger-light);
            }
          }
        }

        &.pipeline-step-other {
          .p-step-header .p-step-number {
            font-size: 0;
            padding-top: 6px;

            &::before {
              font-size: 1.25rem;
              content: "*";
            }
          }
        }

        .p-step-header {
          align-items: center;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-size: 0.8125rem;
          color: var(--text-secondary);
          width: 100%;

          &:hover {
            background: var(--bg-tertiary);
            .p-step-number {
              background: var(--primary-light);
              color: var(--primary-dark);
            }
          }

          .p-step-number {
            font-size: 0.75rem;
            font-weight: unset;
          }

          .p-step-title {
            text-align: left;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            strong {
              font-weight: unset;
            }
          }
        }

        &.p-step-active {
          .p-step-header {
            background: var(--primary-light);
            color: var(--primary-color);
            &:hover {
              .p-step-number {
                background: var(--p-stepper-step-number-active-background);
                color: var(--p-stepper-step-number-active-color);
              }
            }
          }
        }
      }

      // Steps after the active one: reset to default (not yet visited)
      .p-step-active ~ .p-step:not(.pipeline-step-error) {
        --p-stepper-step-number-background: var(--bg-tertiary);
        --p-stepper-step-number-color: var(--text-secondary);
        --p-stepper-step-number-border-color: var(--bg-tertiary);
      }
    }

    .p-steppanels {
      padding: 0;
      flex: 1;
      min-width: 0;
    }
  }

  .pipeline-option {
    padding: 8px 12px;
    margin-bottom: 4px;
    border: none;
    border-bottom: 1px solid var(--border-color);
    border-radius: 0;

    &:last-child {
      border-bottom: none;
    }

    &.indent-fieldset {
      margin-left: 2rem;
    }

    &.disabled-fieldset {
      opacity: 0.4;
      pointer-events: none;
      user-select: none;
      background-color: var(--bg-tertiary);
    }

    .bi-lock,
    .bi-unlock {
      margin-left: 6px;
      font-size: 13px;
      color: var(--primary-color);
    }

    .pipeline-option-title {
      font-weight: 500;
      margin-bottom: 4px;
      font-size: 0.8125rem;
      color: var(--text-primary);
      overflow-wrap: break-word;
      line-height: 1.5;
    }
    .pipeline-option-input,
    .pipeline-option-checkbox,
    .pipeline-option-autocomplete,
    .pipeline-option-dropdown {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;

      .field-container {
        flex: 1;
        flex-direction: column;
        display: flex;
      }

      .pipeline-option-title {
        margin-bottom: 0;
        margin-right: 10px;
        white-space: pre-wrap;
        overflow-wrap: break-word;
        width: 250px;
      }

      small.pv-error {
        display: block;
        width: 100%;
        margin-top: 6px;
      }
    }

    .pipeline-option-checkbox {
      flex-direction: column;

      .pipeline-option-title {
        display: flex;
        width: auto;
        margin-right: 0;
        align-items: center;
        cursor: pointer;
        padding: 6px 0;
        gap: 10px;

        span {
          user-select: none;
        }
      }
    }

    .pipeline-option-radio,
    .pipeline-option-multiselect {
      .label-group {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .checkbox-item,
      .radio-item {
        display: flex;
        align-items: center;
        gap: 6px;

        label {
          cursor: pointer;
          font-size: 0.8125rem;
        }
      }
    }

    .pipeline-option-file {
      input[type="file"] {
        width: 100%;
      }
    }

    .pipeline-option-textarea {
      .ace_editor {
        border: 1px solid var(--border-color);
        z-index: 1;
      }
      textarea {
        min-height: 100px;
        max-height: 200px;
      }
    }
    .description {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-top: 6px;
      line-height: 1.5;
      padding: 6px 10px;
      background: var(--bg-secondary);
      border-left: 2px solid var(--palette-light);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;

      :deep(a) {
        color: var(--primary-color);
        text-decoration: none;
        &:hover {
          text-decoration: underline;
        }
      }
    }

    textarea:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
  }
}
.step-buttons {
  display: flex;
  gap: 8px;
  z-index: 2;
  justify-content: space-between;
  padding: 12px 0;
  margin-top: 12px;
  position: sticky;
  bottom: 0;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);

  &.justify-end {
    justify-content: flex-end;
  }

  .d-flex {
    display: flex;
    gap: 8px;
  }

}
@media (min-width: 2390px) {
  .pipeline-options .pipeline-option .pipeline-option-input label {
    width: 25%;
  }
}
</style>
