import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { BookForm } from "../book-form";

export default function NewBookPage() {
  return (
    <AppShell>
      <PageHead
        title="Nhập sách mới"
        meta="Tạo hồ sơ đầu sách kèm số bản vật lý ban đầu"
      />
      <BookForm />
    </AppShell>
  );
}
