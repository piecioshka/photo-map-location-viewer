/**
 * Google Drive import, kept behind the `googleDrive` feature flag and
 * loaded on demand — with the flag off, none of the Drive code (nor the
 * picker UI) reaches the browser.
 */
import { t } from "../services/i18n";
import {
  clientId,
  downloadImages,
  listFolders,
  listImages,
  requestAccessToken,
} from "../services/google-drive";
import { openDrivePicker } from "../ui/drive-picker";
import { hideLoader, showLoader, showToast } from "../ui/ui";

export interface DriveImportDeps {
  /** Feeds the downloaded files into the regular photo pipeline. */
  processFiles(files: File[]): Promise<void>;
}

export function initDriveImport(
  button: HTMLButtonElement,
  deps: DriveImportDeps,
): void {
  // Sign-in needs the OAuth Client ID baked in at build time — without it
  // the button stays hidden.
  const id = clientId();
  if (id === null) return;
  button.hidden = false;

  let running = false;

  async function importFromDrive(): Promise<void> {
    if (running || id === null) return;
    running = true;
    button.disabled = true;
    try {
      const token = await requestAccessToken(id);
      const folder = await openDrivePicker((parentId) =>
        listFolders(token, parentId),
      );
      if (!folder) return;
      const images = await listImages(token, folder.id);
      if (images.length === 0) {
        showToast(t("driveNoPhotos"));
        return;
      }
      showLoader(0, images.length);
      let files: File[];
      try {
        files = await downloadImages(token, images, (done) =>
          showLoader(done, images.length),
        );
      } finally {
        hideLoader();
      }
      await deps.processFiles(files);
    } catch (error) {
      // Google's own messages are English and technical — log them, show ours.
      console.error(error);
      showToast(t("driveImportFailed"));
    } finally {
      running = false;
      button.disabled = false;
    }
  }

  button.addEventListener("click", () => {
    void importFromDrive();
  });
}
