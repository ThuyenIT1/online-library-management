import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { getSettings } from "@/lib/api";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <AppShell>
      <PageHead
        title="Cài đặt"
        meta="Cấu hình áp dụng cho toàn thư viện: hạn mượn, phí trễ hạn, số lần gia hạn"
      />
      <SettingsForm settings={settings} />
    </AppShell>
  );
}
