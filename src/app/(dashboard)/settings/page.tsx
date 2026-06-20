import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">Appearance, polling and alert thresholds.</p>
      </header>
      <SettingsForm />
    </div>
  );
}
