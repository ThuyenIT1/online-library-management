import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { getBook } from "@/lib/api";
import { BookForm } from "../../book-form";

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const book = await getBook(id);
  if (!book) notFound();

  return (
    <AppShell>
      <PageHead
        title={`Sửa hồ sơ — ${book.title}`}
        meta={`Mã ${book.code} · ${book.author}`}
      />
      <BookForm book={book} mode="edit" />
    </AppShell>
  );
}
