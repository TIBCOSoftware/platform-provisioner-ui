/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import _ from "lodash";
import pipelinesOptions from "./pipelinesOptions.vue";
import { useMainStore } from "@/stores/store";

vi.mock("../utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils")>();
  return {
    ...actual,
    default: {
      buildPublicApiUrl: vi.fn().mockReturnValue("https://example.com/api"),
      getUiProperties: vi.fn().mockResolvedValue({ NODE_ENV: "production" }),
      deployPipeline: vi.fn(),
      openNewTab: vi.fn(),
      httpGet: vi.fn().mockResolvedValue([])
    },
    // Delegate to the real implementation so restore-default behavior can be asserted.
    formatDataType: vi.fn((type: string, value: any) => actual.formatDataType(type, value)),
    toHashKey: vi.fn((v: string) => v)
  };
});

vi.mock("vue3-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => ({ hash: "", params: {}, query: {} }))
}));

vi.mock("@/router", () => ({
  default: { push: vi.fn() }
}));

describe("pipelinesOptions – change tracking", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const mountComponent = (props = {}) => {
    return mount(pipelinesOptions, {
      props: {
        isInValid: false,
        isShowYamlInPage: false,
        pipelineGroups: [
          {
            index: 1,
            title: "Step 1",
            description: "",
            isValid: true,
            options: [
              {
                value: "test-value",
                name: "Test Field",
                type: "string",
                guiType: "input",
                reference: "meta.guiEnv.GUI_TEST"
              }
            ]
          }
        ],
        ...props
      },
      global: {
        stubs: {
          Button: { template: '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot /></button>', inheritAttrs: true },
          Dialog: { template: '<div v-if="$attrs.visible" class="dialog"><slot /><slot name="footer" /></div>', inheritAttrs: true },
          InputText: { template: '<input />', inheritAttrs: true },
          InputNumber: { template: '<input />', inheritAttrs: true },
          Password: { template: '<input />', inheritAttrs: true },
          ToggleSwitch: { template: '<input />', inheritAttrs: true },
          Checkbox: { template: '<input />', inheritAttrs: true },
          RadioButton: { template: '<input />', inheritAttrs: true },
          Select: { template: '<select />', inheritAttrs: true },
          AutoComplete: { template: '<input />', inheritAttrs: true },
          Stepper: { template: '<div><slot /></div>' },
          StepList: { template: '<div><slot /></div>' },
          StepPanels: { template: '<div><slot /></div>' },
          Step: { template: '<div><slot /></div>' },
          StepPanel: { template: '<div><slot /></div>' },
          MarkdownView: { template: '<div />' },
          RunConfirmChanges: { template: '<div class="run-confirm-changes-stub" />' }
        }
      }
    });
  };

  it("should render pipeline options", () => {
    const wrapper = mountComponent();
    expect(wrapper.find(".pipeline-options").exists()).toBe(true);
  });

  it("should render Run button", () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text().includes("Run"));
    expect(runBtn).toBeDefined();
  });

  it("should show confirmation dialog when Run is clicked", async () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text() === "Run");
    await runBtn?.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".dialog").exists()).toBe(true);
    expect(wrapper.text()).toContain("Are you sure you want to run this pipeline");
  });

  it("should render RunConfirmChanges component in confirmation dialog", async () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text() === "Run");
    await runBtn?.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".run-confirm-changes-stub").exists()).toBe(true);
  });

  it("should close dialog and call deployPipeline when confirm Run is clicked", async () => {
    const utils = (await import("../utils")).default;
    const wrapper = mountComponent();

    // Open dialog
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text() === "Run");
    await runBtn?.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".dialog").exists()).toBe(true);

    // Click confirm Run in the dialog footer
    const dialogButtons = wrapper.find(".dialog").findAll("button");
    const confirmBtn = dialogButtons.find((b) => b.text().includes("Run"));
    await confirmBtn?.trigger("click");
    await wrapper.vm.$nextTick();

    expect(utils.deployPipeline).toHaveBeenCalled();
    expect(wrapper.find(".dialog").exists()).toBe(false);
  });

  it("should close dialog without deploying when Cancel is clicked", async () => {
    const utils = (await import("../utils")).default;
    const wrapper = mountComponent();

    // Open dialog
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text() === "Run");
    await runBtn?.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".dialog").exists()).toBe(true);

    // Click Cancel
    const dialogButtons = wrapper.find(".dialog").findAll("button");
    const cancelBtn = dialogButtons.find((b) => b.text() === "Cancel");
    await cancelBtn?.trigger("click");
    await wrapper.vm.$nextTick();

    expect(utils.deployPipeline).not.toHaveBeenCalled();
    expect(wrapper.find(".dialog").exists()).toBe(false);
  });

  it("should compute yaml changes with store data when Run is clicked", async () => {
    const store = useMainStore();
    store.setOriginalRecipeContent({ meta: { guiEnv: { GUI_TEST: "old" } } } as any);
    store.setYamlEditorContent({ meta: { guiEnv: { GUI_TEST: "new" } } } as any);

    const wrapper = mountComponent();
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text() === "Run");
    await runBtn?.trigger("click");
    await wrapper.vm.$nextTick();

    // Dialog should be open with changes computed
    expect(wrapper.find(".dialog").exists()).toBe(true);
    expect(wrapper.find(".run-confirm-changes-stub").exists()).toBe(true);
  });

  // Covers Finding 1: isDependentField / render must not throw when
  // originalOptionsContent is the store default ({}), i.e. no recipe loaded yet.
  it("should render without throwing when originalOptionsContent is the default {} object", () => {
    const store = useMainStore();
    // The store default is an empty plain object, NOT an array. isDependentField must
    // tolerate this shape (Object.values({}) -> []) without throwing.
    expect(store.originalOptionsContent).toEqual({});
    expect(() => mountComponent()).not.toThrow();
  });
});

describe("pipelinesOptions – dependent field toggle/reset", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // A ToggleSwitch stub that actually emits update:modelValue so the component's
  // onInputChange handler (which drives the dependent-field toggling) is invoked.
  const emittingStubs = {
    Button: { template: '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot /></button>', inheritAttrs: true },
    Dialog: { template: '<div v-if="$attrs.visible" class="dialog"><slot /><slot name="footer" /></div>', inheritAttrs: true },
    InputText: {
      props: ["modelValue"],
      emits: ["update:modelValue"],
      template: '<input class="stub-input-text" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    },
    InputNumber: { template: "<input />", inheritAttrs: true },
    Password: { template: "<input />", inheritAttrs: true },
    ToggleSwitch: {
      props: ["modelValue"],
      emits: ["update:modelValue"],
      template: '<input type="checkbox" class="stub-toggle" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />'
    },
    Checkbox: { template: "<input />", inheritAttrs: true },
    RadioButton: { template: "<input />", inheritAttrs: true },
    Select: { template: "<select />", inheritAttrs: true },
    AutoComplete: { template: "<input />", inheritAttrs: true },
    Stepper: { template: "<div><slot /></div>" },
    StepList: { template: "<div><slot /></div>" },
    StepPanels: { template: "<div><slot /></div>" },
    Step: { template: "<div><slot /></div>" },
    StepPanel: { template: "<div><slot /></div>" },
    MarkdownView: { template: "<div />" },
    RunConfirmChanges: { template: '<div class="run-confirm-changes-stub" />' }
  };

  // Source field is a boolean checkbox that controls a dependent string field.
  const buildOptions = (controlKey: "disableOtherFieldsWhenSet" | "enableOtherFieldsWhenSet") => [
    {
      value: false,
      name: "Source Toggle",
      type: "boolean",
      guiType: "checkbox",
      reference: "meta.guiEnv.GUI_SOURCE",
      [controlKey]: ["meta.guiEnv.GUI_DEPENDENT"]
    },
    {
      value: "default-from-recipe",
      name: "Dependent Field",
      type: "string",
      guiType: "input",
      reference: "meta.guiEnv.GUI_DEPENDENT"
    }
  ];

  const DEPENDENT_REF = "meta.guiEnv.GUI_DEPENDENT";

  const mountWithOptions = (options: any[]) => {
    const store = useMainStore();
    // Populate the store via the SAME path production uses (PipelineView.vue calls
    // store.setOriginalOptionsContent(pipelineOptions)). That goes through
    // resetObjectAndAssign(), which Object.assign()s the array onto the initial {}.
    // The result is an array-LIKE plain object with numeric keys ({ "0": opt, "1": opt }),
    // NOT a true Array — Array.isArray(store.originalOptionsContent) is false at runtime.
    // toggleFields() mutates the dependent option held by the STORE (resolved via _.find),
    // which is a deep clone, separate from the option objects passed to pipelineGroups.
    store.setOriginalOptionsContent(options as any);
    store.setOriginalRecipeContent({
      meta: { guiEnv: { GUI_SOURCE: false, GUI_DEPENDENT: "default-from-recipe" } }
    } as any);

    const wrapper = mount(pipelinesOptions, {
      props: {
        isInValid: false,
        isShowYamlInPage: false,
        pipelineGroups: [
          {
            index: 1,
            title: "Step 1",
            description: "",
            isValid: true,
            options
          }
        ]
      },
      global: { stubs: emittingStubs }
    });
    return { wrapper, store, options };
  };

  // Resolve the dependent option as the component does: from the store's array-like object.
  const storeDependent = (store: ReturnType<typeof useMainStore>) =>
    _.find(store.originalOptionsContent, { reference: DEPENDENT_REF }) as any;

  it("treats the store value as an array-like object (not a true Array) after a recipe loads", () => {
    const { store } = mountWithOptions(buildOptions("disableOtherFieldsWhenSet"));
    // Document the real runtime shape: array-like object, Array.isArray === false.
    expect(Array.isArray(store.originalOptionsContent)).toBe(false);
    expect(typeof store.originalOptionsContent).toBe("object");
    expect(Object.keys(store.originalOptionsContent)).toEqual(["0", "1"]);
  });

  it("applies the indent-fieldset class to dependent fields after a recipe loads", () => {
    // This proves isDependentField() returns true for the real populated store shape,
    // i.e. the Array.isArray guard would have wrongly disabled this feature.
    const { wrapper } = mountWithOptions(buildOptions("disableOtherFieldsWhenSet"));
    const dependentFieldset = wrapper.find('fieldset[data-reference="' + DEPENDENT_REF + '"]');
    expect(dependentFieldset.exists()).toBe(true);
    expect(dependentFieldset.classes()).toContain("indent-fieldset");

    // The controlling source field itself is not a dependent field -> no indent.
    const sourceFieldset = wrapper.find('fieldset[data-reference="meta.guiEnv.GUI_SOURCE"]');
    expect(sourceFieldset.exists()).toBe(true);
    expect(sourceFieldset.classes()).not.toContain("indent-fieldset");
  });

  it("resets the dependent field to its type inactive value when the controlling field disables it", async () => {
    const { wrapper, store } = mountWithOptions(buildOptions("disableOtherFieldsWhenSet"));
    const dependent = storeDependent(store);
    expect(dependent.value).toBe("default-from-recipe");

    // Activate the source toggle -> isFieldActive(source) is true -> dependent gets disabled.
    const toggle = wrapper.find(".stub-toggle");
    await toggle.setValue(true);
    // onInputChange schedules the toggle work inside nextTick.
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    // For a string type, the inactive value is "".
    expect(dependent.value).toBe("");
  });

  it("restores the dependent field to its recipe default when the controlling field re-enables it", async () => {
    const { wrapper, store } = mountWithOptions(buildOptions("enableOtherFieldsWhenSet"));
    const dependent = storeDependent(store);
    // Start dependent at a non-default value to prove it is restored from the recipe.
    dependent.value = "edited-by-user";

    // Activate the source toggle -> isFieldActive(source) is true ->
    // enableOtherFieldsWhenSet calls toggleFields(..., disable = !active = false)
    // which restores the dependent value from originalRecipeContent via formatDataType.
    const toggle = wrapper.find(".stub-toggle");
    await toggle.setValue(true);
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(dependent.value).toBe("default-from-recipe");
  });

  it("disables (resets) the dependent field when an enable-controlling field becomes inactive", async () => {
    const { wrapper, store } = mountWithOptions(buildOptions("enableOtherFieldsWhenSet"));
    const dependent = storeDependent(store);
    const toggle = wrapper.find(".stub-toggle");

    // First activate the source so the dependent is enabled and holds the recipe default.
    await toggle.setValue(true);
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    expect(dependent.value).toBe("default-from-recipe");

    // Now deactivate the source toggle -> isFieldActive(source) is false ->
    // enableOtherFieldsWhenSet calls toggleFields(..., disable = !active = true)
    // which resets the dependent to its type inactive value ("").
    await toggle.setValue(false);
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(dependent.value).toBe("");
  });

  it("resets a non-lowercase typed dependent field ('Boolean') to false on disable", async () => {
    // getFieldInactiveValue() must match types case-insensitively, like formatDataType().
    // With a case-sensitive switch, type "Boolean" would fall through to "" instead of false.
    const store = useMainStore();
    const options = [
      {
        value: false,
        name: "Source Toggle",
        type: "boolean",
        guiType: "checkbox",
        reference: "meta.guiEnv.GUI_SOURCE",
        disableOtherFieldsWhenSet: [DEPENDENT_REF]
      },
      {
        value: true,
        name: "Dependent Boolean Field",
        type: "Boolean", // intentionally non-lowercase
        guiType: "checkbox",
        reference: DEPENDENT_REF
      }
    ];
    store.setOriginalOptionsContent(options as any);
    store.setOriginalRecipeContent({
      meta: { guiEnv: { GUI_SOURCE: false, GUI_DEPENDENT: true } }
    } as any);

    const wrapper = mount(pipelinesOptions, {
      props: {
        isInValid: false,
        isShowYamlInPage: false,
        pipelineGroups: [{ index: 1, title: "Step 1", description: "", isValid: true, options }]
      },
      global: { stubs: emittingStubs }
    });

    const dependent = storeDependent(store);
    expect(dependent.value).toBe(true);

    // Activate the source -> dependent gets disabled -> reset to its type inactive value.
    // The source is the first toggle; find it explicitly by its data-reference fieldset.
    const sourceToggle = wrapper.find('fieldset[data-reference="meta.guiEnv.GUI_SOURCE"] .stub-toggle');
    await sourceToggle.setValue(true);
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    // For a "Boolean" type, the inactive value must be false (not "").
    expect(dependent.value).toBe(false);
  });
});
