import type { DockerActionResultDTO, DockerContainersResponseDTO } from "@/lib/types";
import type { DockerActionInput } from "@/lib/validation";
import { apiRequest } from "./api-client";

/** Typed, React-free client functions for the Docker Command Centre endpoints. */

export function fetchContainers() {
  return apiRequest<DockerContainersResponseDTO>("/api/docker/containers");
}

export function containerAction(id: string, action: DockerActionInput["action"]) {
  return apiRequest<DockerActionResultDTO>(`/api/docker/containers/${id}/action`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}
