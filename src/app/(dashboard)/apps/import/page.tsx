import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DockerImport } from "@/components/docker/import/docker-import";

export default function ImportFromDockerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Import from Docker"
        description="Turn detected Docker containers into Apps launcher entries. Suggestions are just hints — review and edit each one, then import only what you select."
        actions={
          <Link href="/apps">
            <Button variant="outline" size="sm">
              Back to Apps
            </Button>
          </Link>
        }
      />
      <DockerImport />
    </div>
  );
}
