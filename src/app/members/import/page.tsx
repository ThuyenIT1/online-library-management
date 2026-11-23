import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { MemberImportForm } from "./member-import-form";

export default function MemberImportPage() {
  return (
    <AppShell>
      <PageHead
        title="Nhập danh sách hội viên"
        meta="Dán hoặc tải lên danh sách CSV, hệ thống cấp thẻ cho từng dòng hợp lệ"
      />
      <MemberImportForm />
    </AppShell>
  );
}
