<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div class="pipeline-options" v-if="pipelineGroups.length > 0" :class="{ 'pipeline-options-all-in-one': pipelineGroups.length === 1 }">
    <Stepper :value="activeStep" @update:value="onStepChange">
      <StepList :hidden="pipelineGroups.length === 1">
        <Step
          :value="group.index"
          :class="{
            'pipeline-step-error': !group.isValid,
            'pipeline-step-other': group.index === OTHER_GROUP_INDEX,
          }"
          v-for="(group) in pipelineGroups"
          :key="group.index"
        >
          <strong>{{ group.title }}</strong>
        </Step>
      </StepList>
      <StepPanels>
        <StepPanel v-slot="{ activateCallback }" :value="group.index" v-for="(group, groupIndex) in pipelineGroups" :key="group.index">
          <VMarkdownView :content="group.description" v-if="group.description"></VMarkdownView>
          <fieldset class="pipeline-option" v-for="(opt, optionIndex) in group.options" :key="opt.name" :data-reference="opt.reference">
            <div class="pipeline-option-title" :title="opt.reference"
                   v-if="['multiselect', 'radio', 'textarea'].includes(opt.guiType)">
              {{ opt.name }}
              <i class="pi" :class="{ 'pi-lock': opt.value,  'pi-unlock': !opt.value }" v-if="opt.disableOtherFieldsWhenSet && opt.disableOtherFieldsWhenSet.length"></i>
            </div>

            <!-- for guiType: input (string, number, password) -->
            <div v-if="opt.guiType === 'input'" :class="'pipeline-option-' + opt.guiType">
              <label class="pipeline-option-title" :for="getInputId(opt.guiType, groupIndex, optionIndex)" :title="opt.reference">
                {{ opt.name }}
                <i class="pi" :class="{ 'pi-lock': opt.value,  'pi-unlock': !opt.value }" v-if="opt.disableOtherFieldsWhenSet && opt.disableOtherFieldsWhenSet.length"></i>
              </label>
              <div class="field-container">
                <input
                  :type="getInputType(opt.guiType, opt.type)"
                  :class="{ 'hidden-password': opt.type === 'password' }"
                  autocomplete="off"
                  class="form-control"
                  :value="opt.value"
                  :id="getInputId(opt.guiType, groupIndex, optionIndex)"
                  v-on:input="onInputChange(opt, $event)"
                />
                <div class="description" v-if="opt.description" v-html="opt.description"></div>
                <small class="pv-error" v-if="opt.required && opt.value === ''"> It's required. </small>
              </div>
            </div>

            <!-- for guiType: file -->
            <div v-if="opt.guiType === 'file'" :class="'pipeline-option-' + opt.guiType">
              <label class="pipeline-option-title" :for="getInputId(opt.guiType, groupIndex, optionIndex)" :title="opt.reference">
                {{ opt.name }}
                <i class="pi" :class="{ 'pi-lock': opt.value,  'pi-unlock': !opt.value }" v-if="opt.disableOtherFieldsWhenSet && opt.disableOtherFieldsWhenSet.length"></i>
              </label>
              <div class="field-container">
                <input type="file" class="form-control"
                       :id="getInputId(opt.guiType, groupIndex, optionIndex)"
                       :accept="opt.accept || undefined"
                       v-on:input="onFileChange(opt, $event)"
                />
                <div class="description" v-if="opt.description" v-html="opt.description"></div>
                <small class="pv-error" v-if="opt.required && opt.value === ''"> It's required. </small>
                <small class="pv-error" v-if="opt.error">{{ opt.error }}</small>
              </div>
            </div>

            <!-- for guiType: checkbox (boolean) -->
            <div v-if="opt.guiType === 'checkbox'" :class="'pipeline-option-' + opt.guiType">
              <label class="pipeline-option-title" :for="getInputId(opt.guiType, groupIndex, optionIndex)" :title="opt.reference">
                <input type="checkbox" :id="getInputId(opt.guiType, groupIndex, optionIndex)" v-model="opt.value" v-on:change="onInputChange(opt)" />
                <span>{{ opt.name }}</span>
                <i class="pi" :class="{ 'pi-lock': opt.value,  'pi-unlock': !opt.value }" v-if="opt.disableOtherFieldsWhenSet && opt.disableOtherFieldsWhenSet.length"></i>
              </label>
              <div>
                <div class="description" v-if="opt.description" v-html="opt.description"></div>
                <small class="pv-error" v-if="opt.required && typeof opt.value !== 'boolean'">
                  Check the right side YAML editor, the value MUST be 'true' or 'false'.
                </small>
              </div>
            </div>

            <!-- for guiType: multiselect -->
            <div v-if="opt.guiType === 'multiselect'" :class="'pipeline-option-' + opt.guiType">
              <div v-for="(options, _index) in multiselectOptions(opt, groupIndex, optionIndex)" :key="_index" class="label-group">
                <label v-for="item in options" :key="item.id">
                  <input type="checkbox" :name="item.name" :value="item.value" v-model="opt.value" @change="onInputChange(opt)" />
                  <span>{{ item.label }}</span>
                </label>
              </div>
              <div class="description" v-if="opt.description" v-html="opt.description"></div>
              <small class="pv-error" v-if="opt.required && (!opt.value || opt.value.length === 0)"> It's required. </small>
            </div>

            <!-- for guiType: radio -->
            <div v-if="opt.guiType === 'radio'" :class="'pipeline-option-' + opt.guiType">
              <div v-for="(options, _index) in multiselectOptions(opt, groupIndex, optionIndex)" :key="_index" class="label-group">
                <label v-for="item in options" :key="item.id">
                  <input type="radio" :name="item.name" :value="item.value" v-model="opt.value" v-on:change="onInputChange(opt)" />
                  <span>{{ item.label }}</span>
                </label>
              </div>
              <div class="description" v-if="opt.description" v-html="opt.description"></div>
              <small class="pv-error" v-if="opt.required && (!opt.value || opt.value.length === 0)"> It's required. </small>
            </div>

            <!-- for guiType: dropdown -->
            <div v-if="opt.guiType === 'dropdown'" :class="'pipeline-option-' + opt.guiType">
              <div class="pipeline-option-title" :title="opt.reference">
                {{ opt.name }}
                <i class="pi" :class="{ 'pi-lock': opt.value,  'pi-unlock': !opt.value }" v-if="opt.disableOtherFieldsWhenSet && opt.disableOtherFieldsWhenSet.length"></i>
              </div>
              <div class="field-container">
                <select class="form-select" v-model="opt.value" @change="onInputChange(opt)">
                  <option value="" disabled selected>Select an option</option>
                  <option v-for="(label, labelIndex) in opt.values" :key="labelIndex" :value="label">
                    {{ (opt?.labels ?? [])[labelIndex] }}
                  </option>
                </select>

                <div class="description" v-if="opt.description" v-html="opt.description"></div>
              </div>
              <small class="pv-error" v-if="opt.required && (!opt.value || opt.value.length === 0)"> It's required. </small>
            </div>

            <!-- for guiType: textarea -->
            <div v-if="opt.guiType === 'textarea'" :class="'pipeline-option-' + opt.guiType">
              <div :id="getInputId(opt.guiType, groupIndex, optionIndex)"></div>
              <div class="description" v-if="opt.description" v-html="opt.description"></div>
              <small class="pv-error" v-if="opt.required && opt.value === ''"> It's required. </small>
            </div>
          </fieldset>
          <div class="step-buttons" :class="{ 'justify-end': groupIndex === 0 }" v-if="!isShowYamlInPage">
            <Button v-if="groupIndex > 0" label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback(pipelineGroups[groupIndex - 1].index)" />
            <Button
              v-if="groupIndex < pipelineGroups.length - 1"
              label="Next"
              icon="pi pi-arrow-right"
              severity="info"
              iconPos="right"
              @click="activateCallback(pipelineGroups[groupIndex + 1].index)"
            />
            <div class="d-flex" v-if="groupIndex === pipelineGroups.length - 1">
              <Button label="Run" severity="success" icon="pi pi-check" :disabled="isInValid || isEditingYaml" @click="onPipelineDeploy" />
              <Button label="Status" severity="info" icon="pi pi-cog" :disabled="isInValid || isEditingYaml" @click="openStatusLink" v-if="isShowStatus"/>
            </div>
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>
  </div>
</template>
<script setup lang="ts">
import Stepper from "primevue/stepper";
import StepList from "primevue/steplist";
import StepPanels from "primevue/steppanels";
import Step from "primevue/step";
import StepPanel from "primevue/steppanel";
import Button from "primevue/button";
import { ref, onBeforeUnmount, watch, computed, nextTick } from "vue";
import { fromEvent, Subject, Subscription, tap } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { VMarkdownView } from "vue3-markdown";
import ace from "ace-builds";
import type { PIPELINE_GROUPS, PIPELINE_OPTION } from "@/types/pipeline";
import { useMainStore } from "@/stores/store";
import type { PIPELINE_OPTIONS_PROP_TYPES } from "@/types/props";
import utils from "@/utils";
import { useRoute } from "vue-router";
import { OTHER_GROUP_INDEX } from "@/types/global";
import router from "@/router";
import _ from "lodash";

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

const subscriptions: Subscription[] = [];
const inputSubject = new Subject<PIPELINE_OPTION>();
const breakLineLimit = 4; // Number of the input radio or checkbox per line

const onPipelineDeploy = () => {
  utils.deployPipeline(store.changedPipelineDeployParams, store.yamlEditorContent);
  isShowStatus.value = true;
};
const openStatusLink = () => {
  const url = `/status?account=${store.changedPipelineDeployParams.account}&action=pipeline`;
  utils.openNewTab(url);
};
const getInputType = (guiType: string, type: string) => {
  type = type.toLowerCase();
  const supportedTypes = ["text", "password", "number", "file"];
  if (guiType === "input") {
    if (type === "string" || type === "password") {
      return "text";
    }
    if (supportedTypes.includes(type)) {
      return type;
    }
  }
  return "text";
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
  const groupIndex = props.pipelineGroups?.findIndex(group => group.index === activeStep.value);
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
      readOnly: false
    });
    editors.value.set(editorId, editor);
  }
  // Only update the value of the textarea when the new value is different from the current value of the textarea
  if (editor.getValue() !== opt.value) {
    editor.setValue(opt.value || "", -1);
  }
  subscriptions.push(
    fromEvent(editor.session, 'change')
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
        value: " "  // when the file size exceeds the limit, the value is set to a space to trigger the file is selected
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
      emitPipelineOptionFieldChange(newOpt);
    };
    reader.readAsArrayBuffer(file);
  }
};

const onInputChange = (opt: PIPELINE_OPTION, event?: Event) => {
  const newOpt = {
    ...opt,
    value: opt.guiType === "input" && event ? (event.target as HTMLInputElement).value : opt.value
  };
  checkboxDisableOtherFields(newOpt);
  inputSubject.next(newOpt);
};
const checkboxDisableOtherFields = (opt: PIPELINE_OPTION) => {
  if (opt.disableOtherFieldsWhenSet && opt.disableOtherFieldsWhenSet.length > 0) {
    opt.disableOtherFieldsWhenSet.forEach(field => {
      nextTick(() => {
        document.querySelectorAll('[data-reference="'+ field +'"]').forEach(fieldset => {
          if (fieldset instanceof HTMLElement) {
            let isDisableOther = false;
            if (opt.type === "number" && Number(opt.value) !== 0) {
              isDisableOther = true;
            } else if (opt.type === "string" && opt.value !== "") {
              isDisableOther = true;
            } else if (opt.type === "boolean" && opt.value === true) {
              isDisableOther = true;
            } else if (opt.type === "array" && opt.value.length > 0) {
              isDisableOther = true;
            }
            fieldset.classList.toggle("disabled-fieldset", isDisableOther);
          }
        });
      });
    });
  }
};
const initCheckboxDisableOtherFields = (options: PIPELINE_OPTION[]) => {
  if (options && options.length > 0) {
    options.forEach((opt: PIPELINE_OPTION) => {
      checkboxDisableOtherFields(opt);
    });
  }
};
const emitPipelineOptionFieldChange = (option: PIPELINE_OPTION) => {
  store.setPipelineOptionField(option);
};
const initInputChange = () => {
  subscriptions.push(
    inputSubject
      .pipe(
        tap(() => store.setIsEditingYaml(true)),
        debounceTime(300)
      )
      .subscribe((opt: PIPELINE_OPTION) => {
        emitPipelineOptionFieldChange(opt);
        store.setIsEditingYaml(false);
      })
  );
};

const unsubscribe = () => {
  subscriptions.forEach((sub) => sub.unsubscribe());
};

const onStepChange = (index: STEPPER_INDEX) => {
  // get current pipeline options, and initialize the checkboxDisableOtherFields
  const currentPipelineOptions = _.find(props.pipelineGroups, { index })?.options || [];
  initCheckboxDisableOtherFields(currentPipelineOptions);

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
      hash: '#' + newValue
    });
  }
);

onBeforeUnmount(() => {
  unsubscribe();
});
</script>

<style lang="less" scoped>
.pipeline-options {
  height: fit-content;
  padding-bottom: 20px;
  &.pipeline-options-all-in-one {
    :deep(.p-stepper) {
      .p-steppanels {
        padding: 0;
        width: calc(100% - 10px);
      }
    }
  }
  .markdown-body {
    padding: 10px;
  }
  .pipeline-option {
    padding: 10px;
    &:hover {
      background: #f5f5f5;
    }
    &.disabled-fieldset {
      opacity: 0.3;
      pointer-events: none;
      user-select: none;
      filter: grayscale(100%) brightness(85%);
      background-color: #e6e6e6;
    }
    .pi-lock, .pi-unlock {
      margin-top: 3px;
      margin-left: 5px;
      font-size: 14px;
    }
    .pipeline-option-title {
      font-weight: 500;
      margin-bottom: 5px;
      font-size: 0.875rem;
    }
    .pipeline-option-input,
    .pipeline-option-checkbox,
    .pipeline-option-dropdown {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      .field-container {
        flex: 1;
        flex-direction: column;
        display: flex;
        .hidden-password {
          color: transparent;
          text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
          caret-color: #000;
        }
      }
      .pipeline-option-title {
        margin-bottom: 0;
        margin-right: 10px;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        width: 230px;
      }
    }
    .pipeline-option-input {
      input {
        font-size: 0.75rem;
      }
    }
    .pipeline-option-checkbox {
      flex-direction: column;
      .pipeline-option-title {
        display: flex;
        width: auto;
        margin-right: 0;
        input[type="checkbox"] {
          flex: 1;
          margin-right: 5px;
        }
      }
    }
    .pipeline-option-radio,
    .pipeline-option-multiselect {
      .label-group {
        display: flex;
        .item:not(:last-child) {
          margin-bottom: 5px;
        }
        label {
          display: flex;
          width: 25%;
          box-sizing: border-box;
          font-size: 0.75rem;
          input {
            margin-right: 5px;
          }
        }
      }
    }
    .pipeline-option-dropdown {
      select {
        font-size: 0.75rem;
      }
    }
    .pipeline-option-textarea {
      .ace_editor {
        border: var(--bs-border-width) solid var(--bs-border-color);
        z-index: 1;
      }
      textarea {
        min-height: 100px;
        max-height: 200px;
      }
    }
    .description {
      font-size: 0.75rem;
      color: #b5b6b6;
      margin-top: 5px;
    }
  }
  :deep(.p-stepper) {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    .p-steplist {
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      height: 100%;
      position: sticky;
      top: 80px;
      max-width: 340px;
      width: max-content;
      margin-right: 20px;
      z-index: 10;
      .p-step {
        flex-direction: column;
        flex: none;
        --p-stepper-step-number-size: 1.25rem;
        &.pipeline-step-error {
          --p-stepper-step-number-background: var(--bs-danger);
          --p-stepper-step-number-active-background: var(--bs-danger);
          --p-stepper-step-number-border-color: var(--bs-danger);
          --p-stepper-step-number-active-border-color: var(--bs-danger);
          --p-stepper-step-number-color: var(--bs-white);
        }
        &.pipeline-step-other {
          .p-step-header .p-step-number {
            font-size: 0;
            padding-top: 5px;
            &::before {
              font-size: 1.25rem;
              content: "*";
            }
          }
        }
        .p-step-header {
          align-items: center;
          .p-step-number {
            font-size: 0.75rem;
          }
          .p-step-title {
            text-align: left;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            strong {
              display: block;
              font-size: 0.875rem;
              font-weight: normal;
            }
            span {
              font-size: 0.875rem;
            }
          }
        }
      }
    }
    .p-steppanels {
      padding: 0;
      flex: 1;
    }
  }
}
.step-buttons {
  display: flex;
  z-index: 2;
  justify-content: space-between;
  padding: 20px 0;
  position: sticky;
  bottom: 0;
  background: #fff;
  &.justify-end {
    justify-content: flex-end;
  }
  button {
    margin: 0 10px;
  }
}
@media (min-width: 2390px) {
  .pipeline-options .pipeline-option .pipeline-option-input label {
    width: 25%;
  }
}
</style>
