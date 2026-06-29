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

import utils from "../utils";
import _ from "lodash";
import type { AxiosResponse } from "axios";
import type { RES_MENU_CONFIG_ITEM, RES_MENU_CONTENT, RES_PAGE_CONTENT } from "@/types/response";

let pageContent = new Map();
let menuContentCache: RES_MENU_CONTENT | null = null;
let menuContentPromise: Promise<RES_MENU_CONTENT> | null = null;

class MenuContentService {
  getMenuContent() {
    // If there is cached content, return the cache directly
    if (menuContentCache) {
      return Promise.resolve(menuContentCache);
    }

    // If there is a request in progress, return the Promise of the request directly
    if (menuContentPromise) {
      return menuContentPromise;
    }

    // Initiate a new request and cache the Promise
    menuContentPromise = utils
      .httpGet("/cic2-ws/v1/menu-content")
      .then((response: RES_MENU_CONTENT) => {
        menuContentCache = response; // update the cache
        menuContentPromise = null; // clear the Promise
        return response;
      })
      .catch((error) => {
        console.error("Error getting the Menu Content: ", error);
        menuContentPromise = null; // clear the Promise on error
        throw error;
      });

    return menuContentPromise;
  }
  // Normalize URL for comparison: strip hash, decode percent-encoding,
  // and treat + as space in query string only (not in path)
  private normalizeUrl(url: string): string {
    try {
      const [pathAndQuery] = url.split("#");
      const qIndex = pathAndQuery.indexOf("?");
      if (qIndex === -1) {
        return decodeURIComponent(pathAndQuery).toLowerCase();
      }
      const path = pathAndQuery.substring(0, qIndex);
      const query = pathAndQuery.substring(qIndex + 1).replace(/\+/g, "%20");
      return `${decodeURIComponent(path)}?${decodeURIComponent(query)}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  // Search the menu config for the provided URL
  // If the URL is found, return the config object, otherwise return false
  // If the "highlight" parameter is set to true:
  //   1. The found item will be highlighted with the "p-menubar-item-active" class
  //   2. The parent items will be highlighted as well
  //   3. The original items object will be modified
  private searchMenuConfig(toUrl: string, items: RES_MENU_CONFIG_ITEM[], highlight: boolean = false): boolean | RES_MENU_CONFIG_ITEM {
    // Ensure items is an array before iterating
    if (!Array.isArray(items)) {
      return false;
    }

    const normalizedToUrl = this.normalizeUrl(toUrl);
    let result: boolean | RES_MENU_CONFIG_ITEM = false;

    for (let item of items) {
      const itemPath = item.url || item.routePath;
      const foundInChildren = item.items ? this.searchMenuConfig(toUrl, item.items, highlight) : false;
      const isMatch = !!(itemPath && this.normalizeUrl(itemPath) === normalizedToUrl);

      if (highlight) {
        item.class = isMatch || foundInChildren ? "p-menubar-item-active" : undefined;
      }

      if (isMatch) {
        result = item;
      } else if (foundInChildren) {
        result = foundInChildren;
      }
    }

    return result;
  }

  findConfigFileFromMenuConfig(toUrl: string, menuConfigJson: RES_MENU_CONFIG_ITEM[]) {
    const foundConfig = this.searchMenuConfig(toUrl, menuConfigJson);
    return foundConfig && typeof foundConfig !== "boolean" ? foundConfig.config : "";
  }

  highLightMenuConfig(toUrl: string, menuConfigJson: RES_MENU_CONFIG_ITEM[]) {
    this.searchMenuConfig(toUrl, menuConfigJson, true);
    return menuConfigJson;
  }

  getPageContent(fileName: string, etag: string = ""): Promise<AxiosResponse<RES_PAGE_CONTENT>> {
    return utils.httpGet(
      "/cic2-ws/v1/file-content?fileName=" + fileName,
      {
        headers: etag ? { "If-None-Match": etag } : {}
      },
      true
    );
  }

  getMenuItem(menuOption: string) {
    return this.getMenuContent()
      .then((response: RES_MENU_CONTENT) => {
        const menuValue = _.get(response, menuOption);
        if (menuValue) {
          return menuValue;
        } else {
          throw new Error("No menu item defined");
        }
      })
      .catch((error: Error) => {
        console.error(`Error getting ${menuOption}: `, error);
        throw error;
      });
  }

  getMenuList() {
    return this.getMenuItem("menuConfig");
  }

  getAWSRegions() {
    return this.getMenuItem("aws.region");
  }
}
export default new MenuContentService();
