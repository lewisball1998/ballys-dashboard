import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PackMatchReview } from "@/components/launcher/pack-match-review";

/** Match imported icon-pack icons to existing apps (v0.2.9). */
export default async function MatchIconsPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const { pack } = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Match icons to apps"
        description="Suggested icons from your imported packs. Suggestions are just hints — review, tick/untick, override, then apply only what you select. Nothing changes until you confirm."
        actions={
          <Link href="/apps">
            <Button variant="outline" size="sm">
              Back to Apps
            </Button>
          </Link>
        }
      />
      <PackMatchReview initialPackId={pack ?? null} />
    </div>
  );
}
