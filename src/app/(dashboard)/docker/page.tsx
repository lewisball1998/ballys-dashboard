import { PageHeader } from "@/components/layout/page-header";
import { DockerCommandCentre } from "@/components/docker/docker-command-centre";

export default function DockerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Docker"
        description="View and safely manage your Docker containers — start, stop, and restart with confirmation."
      />
      <DockerCommandCentre />
    </div>
  );
}
