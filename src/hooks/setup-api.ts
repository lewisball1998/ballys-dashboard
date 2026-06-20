import type { SetupSeedResultDTO, SetupStatusDTO } from "@/lib/types";
import type { SetupCompleteInput, SetupSeedInput } from "@/lib/validation";
import { apiRequest } from "./api-client";

/** React-free client functions for the setup endpoints. */

export function fetchSetupStatus() {
  return apiRequest<SetupStatusDTO>("/api/setup/status");
}

export function seedTemplate(template: SetupSeedInput["template"]) {
  return apiRequest<SetupSeedResultDTO>("/api/setup/seed", {
    method: "POST",
    body: JSON.stringify({ template }),
  });
}

export function completeSetup(payload: SetupCompleteInput) {
  return apiRequest<SetupStatusDTO>("/api/setup/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
