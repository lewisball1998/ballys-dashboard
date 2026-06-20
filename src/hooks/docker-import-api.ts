import type { DockerImportCandidatesResponseDTO, DockerImportResultDTO } from "@/lib/types";
import type { DockerImportInput } from "@/lib/validation";
import { apiRequest } from "./api-client";

/** Typed, React-free client functions for the Import-from-Docker endpoints. */

export function fetchImportCandidates() {
  return apiRequest<DockerImportCandidatesResponseDTO>("/api/docker/import/candidates");
}

export function importApps(input: DockerImportInput) {
  return apiRequest<DockerImportResultDTO>("/api/docker/import", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
