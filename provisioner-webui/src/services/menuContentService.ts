/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import utils from "../utils";
import _ from "lodash";
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

    for (let item of items) {
      // If a direct match for the "url" is found, return the item
      if (item.url?.toLowerCase() === toUrl.toLowerCase()) {
        if (highlight) {
          item.class = "p-menubar-item-active";
        }
        return item;
      }

      // If the item has subitems, recursively search within them
      const foundItem = item.items ? this.searchMenuConfig(toUrl, item.items, highlight) : false;
      if (foundItem) {
        // If the target is found in the subitem, the parent item can also be highlighted
        if (highlight) {
          item.class = "p-menubar-item-active";
        }
        return foundItem;
      }
    }

    return false;
  }

  findConfigFileFromMenuConfig(toUrl: string, menuConfigJson: RES_MENU_CONFIG_ITEM[]) {
    const foundConfig = this.searchMenuConfig(toUrl, menuConfigJson);
    return foundConfig && typeof foundConfig !== "boolean" ? foundConfig.config : "";
  }

  highLightMenuConfig(toUrl: string, menuConfigJson: RES_MENU_CONFIG_ITEM[]) {
    this.searchMenuConfig(toUrl, menuConfigJson, true);
    return menuConfigJson;
  }

  getPageContent(fileName: string): Promise<RES_PAGE_CONTENT> {
    return new Promise((resolve, reject) => {
      if (pageContent.has(fileName)) {
        resolve(pageContent.get(fileName));
      } else {
        pageContent.set(fileName, "");
        utils.httpGet("/cic2-ws/v1/file-content?fileName=" + fileName).then(
          (response) => {
            pageContent.set(fileName, response);
            resolve(response);
          },
          (error) => {
            console.error("Error getting the Menu Content: ", error);
            reject(error);
          }
        );
      }
    });
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
