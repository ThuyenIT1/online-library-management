import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead, Row, Rows, SectionTitle, Status } from "@/components/ui";
import { listBooks, listLoans, listShelves, listSubjects } from "@/lib/api";

const PER_PAGE = 8;

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; subject?: string; shelf?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const subject = sp.subject ?? "all";
  const shelf = sp.shelf ?? "all";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [books, loans, subjects, shelves] = await Promise.all([
    listBooks({ search: q, subject, shelf }),
    listLoans(),
    listSubjects(),
    listShelves(),
  ]);

  const pages = Math.max(1, Math.ceil(books.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const slice = books.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // Link xuất CSV giữ nguyên bộ lọc đang áp dụng.
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (subject !== "all") exportParams.set("subject", subject);
  if (shelf !== "all") exportParams.set("shelf", shelf);
  const exportHref = `/books/export?${exportParams.toString()}`;

  const onLoanByBook = new Map<string, number>();
  for (const l of loans) {
    if (!l.returnedAt) {
      onLoanByBook.set(l.bookId, (onLoanByBook.get(l.bookId) ?? 0) + 1);
    }
  }

  /** Dựng link giữ nguyên các bộ lọc khác. */
  const link = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (subject !== "all") params.set("subject", subject);
    if (shelf !== "all") params.set("shelf", shelf);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `/books?${s}` : "/books";
  };

  return (
    <AppShell>
      <PageHead
        title="Kho sách"
        meta={`${books.length} đầu sách khớp bộ lọc`}
        actions={
          <>
            <Link className="btn btn-quiet" href="/books/new">
              Nhập sách mới
            </Link>
            <Link className="btn" href={exportHref}>
              Xuất danh mục
            </Link>
          </>
        }
      />

      <form className="fieldset" method="get">
        <label className="search-inline">
          <input
            type="search"
            name="q"
            placeholder="Tên sách, tác giả, mã sách"
            defaultValue={q}
            aria-label="Tìm trong kho sách"
          />
        </label>

        <select
          className="select-mini"
          name="subject"
          defaultValue={subject}
          aria-label="Lọc theo chủ đề"
        >
          <option value="all">Mọi chủ đề</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="select-mini"
          name="shelf"
          defaultValue={shelf}
          aria-label="Lọc theo khoang kệ"
        >
          <option value="all">Mọi khoang kệ</option>
          {shelves.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button className="btn btn-quiet" type="submit">
          Lọc
        </button>
        <span className="filter-count">{books.length} kết quả</span>
      </form>

      <section className="section">
        <SectionTitle>Danh mục</SectionTitle>

        {books.length === 0 ? (
          <p className="muted">
            Không có cuốn nào khớp bộ lọc. Xoá từ khoá để xem lại toàn bộ kho.
          </p>
        ) : (
          <Rows>
            {slice.map((b) => {
              const onLoan = onLoanByBook.get(b.id) ?? 0;
              const state =
                b.available === 0
                  ? ("late" as const)
                  : b.available < b.copies
                    ? ("neutral" as const)
                    : ("ok" as const);
              return (
                <Row key={b.id} className="c5">
                  <span className="no code">{b.code}</span>
                  <div>
                    <Link href={`/books/${b.id}`} className="title link">
                      {b.title}
                    </Link>
                    <span className="sub">
                      {b.author}
                      {b.year ? `, ${b.year}` : ""}, {b.subject}
                    </span>
                  </div>
                  <span className="who">{b.shelf}</span>
                  <span className="num">
                    {b.available}
                    <span className="of"> / {b.copies}</span>
                  </span>
                  <Status tone={state}>
                    {b.available === 0
                      ? "Hết bản"
                      : b.available < b.copies
                        ? `Còn ${b.available}, đang mượn ${onLoan}`
                        : "Sẵn có"}
                  </Status>
                </Row>
              );
            })}
          </Rows>
        )}

        <div className="pager">
          <span className="code">
            Trang {safePage} / {pages}
          </span>
          <span className="spacer" />
          {safePage > 1 ? (
            <Link href={link({ page: String(safePage - 1) })}>Trước</Link>
          ) : (
            <span className="is-off">Trước</span>
          )}
          {safePage < pages ? (
            <Link href={link({ page: String(safePage + 1) })}>Sau</Link>
          ) : (
            <span className="is-off">Sau</span>
          )}
        </div>
      </section>
    </AppShell>
  );
}
