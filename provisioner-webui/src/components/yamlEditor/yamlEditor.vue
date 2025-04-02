<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div :id="id" class="editor"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import ace from "ace-builds";
import "ace-builds/src-noconflict/ext-language_tools";
import { dump, load } from "js-yaml";
import { cloneDeep, isEqual } from "lodash";
import { distinctUntilChanged, fromEvent, Subscription, tap, throttleTime } from "rxjs";
import { debounceTime, map } from "rxjs/operators";
import type { YAML_EDITOR_CONTENT, YAML_EDITOR_PROP_TYPES } from "@/types/props";
import { useMainStore } from "@/stores/store";

const store = useMainStore();

// Define props
const props = withDefaults(defineProps<YAML_EDITOR_PROP_TYPES>(), {
  content: () => ({}),
  id: "yaml-editor-container",
  lang: "yaml",
  readOnly: false,
});

// the editorLatestContent is used to store the last time editor content
let editorLatestContent = {};

// reactive data
const editor = ref<InstanceType<typeof ace.Editor> | null>(null);
const subscriptions: Subscription[] = [];
const updateEditorHeight = () => {
  const browserHeight = window.innerHeight;
  const minBrowserHeight = 860;
  const minEditorHeight = 450;
  const maxPixelHeight = browserHeight < minBrowserHeight ? minEditorHeight : minEditorHeight + (browserHeight - minBrowserHeight);
  resizeEditor(maxPixelHeight);
};

const resizeEditor = (height: number) => {
  if (!editor.value) {
    return;
  }
  editor.value.setOptions({
    maxPixelHeight: height,
  });
  editor.value.resize();
};
// Initialize Ace editor
const initAceEditor = () => {
  editor.value = ace.edit(props.id, {
    mode: `ace/mode/${props.lang}`,
    maxLines: 100,
    minLines: 22,
    tabSize: 2,
    wrap: true,
    showPrintMargin: false,
    readOnly: props.readOnly
  });
  updateEditorHeight();
  addEditorChangeListener();
};

// Listen for changes in the editor's content
const addEditorChangeListener = () => {
  if (!editor.value) {
    return;
  }
  subscriptions.push(
    // wait for 1 second after the last change before emitting the event
    fromEvent(editor.value?.getSession(), "change")
      .pipe(
        tap(() => store.setIsEditingYaml(true)),
        debounceTime(600)
      )
      .subscribe(() => {
        const parsedContent = getParsedJsonFromYamlStr(editor.value?.getValue() || "");
        // If the content is not valid, keep isEditingYaml as true
        if (parsedContent === false) {
          return;
        }

        if (parsedContent && !isEqual(parsedContent, editorLatestContent)) {
          editorLatestContent = cloneDeep(parsedContent);
          store.setYamlEditorContent(parsedContent);
        }
        store.setIsEditingYaml(false);
      })
  );
};
// Parse YAML string to JSON object
const getParsedJsonFromYamlStr = (content: string) => {
  if (content) {
    try {
      let jsonContent = load(content) || {};
      if (typeof jsonContent === "string") {
        jsonContent = JSON.parse(jsonContent);
      }
      return jsonContent;
    } catch (err: any) {
      console.warn("Error parsing YAML: ", err?.reason);
      return false;
    }
  }
  return false;
};
const setEditorContent = (content: YAML_EDITOR_CONTENT) => {
  editor.value?.setValue(convertToYaml(content), -1);
};
const convertToYaml = (content: YAML_EDITOR_CONTENT) => {
  return dump(content, {
    lineWidth: -1
  });
};
// Watch for changes in the content object
watch(
  () => props.content,
  (newVal) => {
    // Initialize the editor if editor is not provided
    if (!editor.value) {
      initAceEditor();
    }
    if (!isEqual(editorLatestContent, newVal)) {
      editorLatestContent = JSON.parse(JSON.stringify(newVal));
      setEditorContent(newVal);
    }
  },
  { deep: true }
);

watch(
  () => props.readOnly,
  (newVal) => {
    editor.value?.setReadOnly(newVal);
  }
);

onMounted(() => {
  // Initialize the editor if content is provided
  if (Object.keys(props.content).length > 0) {
    initAceEditor();
    setEditorContent(props.content);
  }
  subscriptions.push(
    fromEvent(window, 'resize')
      .pipe(
        throttleTime(200),
        map(() => window.innerHeight),
        distinctUntilChanged()
      )
      .subscribe(() => {
        updateEditorHeight();
      })
  );
});

onBeforeUnmount(() => {
  subscriptions.forEach((sub) => sub.unsubscribe());
});

// Expose editor to parent component's ref attribute
defineExpose({
  editor
});
</script>
