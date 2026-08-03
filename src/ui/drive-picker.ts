import type { DriveFolder } from "../services/google-drive";
import { t } from "../services/i18n";
import { byId } from "./dom";

/**
 * Minimal folder browser for Google Drive: navigate from "My Drive" down
 * through subfolders and confirm one. Resolves with the chosen folder,
 * or null when the dialog is dismissed.
 */

const overlay = byId("drive-picker", HTMLElement);
const titleEl = byId("drive-picker-title", HTMLElement);
const backButton = byId("drive-picker-back", HTMLButtonElement);
const closeButton = byId("drive-picker-close", HTMLButtonElement);
const listEl = byId("drive-folder-list", HTMLElement);
const statusEl = byId("drive-picker-status", HTMLElement);
const selectButton = byId("drive-picker-select", HTMLButtonElement);

/** Built per call so the label follows the current language. */
function rootFolder(): DriveFolder {
  return { id: "root", name: t("driveMyDrive") };
}

export function openDrivePicker(
  listFolders: (parentId: string) => Promise<DriveFolder[]>,
): Promise<DriveFolder | null> {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const path: DriveFolder[] = [rootFolder()];
    let requestId = 0;

    function current(): DriveFolder {
      return path[path.length - 1];
    }

    function close(result: DriveFolder | null): void {
      overlay.hidden = true;
      if (opener instanceof HTMLElement) opener.focus();
      backButton.removeEventListener("click", onBack);
      closeButton.removeEventListener("click", onClose);
      selectButton.removeEventListener("click", onSelect);
      document.removeEventListener("keydown", onKeydown);
      overlay.removeEventListener("click", onOverlayClick);
      resolve(result);
    }

    function onBack(): void {
      if (path.length > 1) {
        path.pop();
        void render();
      }
    }

    function onClose(): void {
      close(null);
    }

    function onSelect(): void {
      close(current());
    }

    function onKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        close(null);
        return;
      }
      if (event.key !== "Tab") return;
      // aria-modal only promises this — Tab has to be kept inside by hand.
      const stops = focusable();
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !overlay.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function focusable(): HTMLElement[] {
      return [...overlay.querySelectorAll("button")].filter(
        (el) => !el.disabled && !el.hidden && el.offsetParent !== null,
      );
    }

    function onOverlayClick(event: MouseEvent): void {
      if (event.target === overlay) close(null);
    }

    async function render(): Promise<void> {
      requestId += 1;
      const myRequest = requestId;
      titleEl.textContent = current().name;
      backButton.hidden = path.length === 1;
      listEl.textContent = "";
      selectButton.disabled = false;
      showStatus(t("driveLoading"));
      let folders: DriveFolder[];
      try {
        folders = await listFolders(current().id);
      } catch (error) {
        if (myRequest !== requestId) return;
        showStatus(
          error instanceof Error ? error.message : t("driveListFailed"),
        );
        return;
      }
      if (myRequest !== requestId) return; // user navigated away meanwhile
      if (folders.length === 0) {
        showStatus(t("driveEmpty"));
        return;
      }
      hideStatus();
      for (const folder of folders) {
        listEl.appendChild(buildFolderItem(folder));
      }
    }

    function buildFolderItem(folder: DriveFolder): HTMLElement {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "drive-picker__folder";
      const icon = document.createElement("span");
      icon.className = "drive-picker__folder-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "📁";
      button.appendChild(icon);
      const name = document.createElement("span");
      name.className = "drive-picker__folder-name";
      name.textContent = folder.name;
      button.appendChild(name);
      button.addEventListener("click", () => {
        path.push(folder);
        void render();
      });
      item.appendChild(button);
      return item;
    }

    function showStatus(message: string): void {
      statusEl.textContent = message;
      statusEl.hidden = false;
    }

    function hideStatus(): void {
      statusEl.hidden = true;
    }

    backButton.addEventListener("click", onBack);
    closeButton.addEventListener("click", onClose);
    selectButton.addEventListener("click", onSelect);
    document.addEventListener("keydown", onKeydown);
    overlay.addEventListener("click", onOverlayClick);

    overlay.hidden = false;
    selectButton.focus();
    void render();
  });
}
