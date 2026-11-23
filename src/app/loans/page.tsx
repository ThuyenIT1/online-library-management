import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead, Row, Rows, SectionTitle, Status } from "@/components/ui";
import { RenewButton, ReturnButton } from "@/components/loan-actions";
import { getSettings, listLoans, listMembers } from "@/lib/api";
import { daysLate, daysLeft, formatDate, formatVNDFull, todayISO } from "@/lib/types";

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const tab = sp.tab ?? "active";
  const today = todayISO();

  const [loans, members, settings] = await Promise.all([
    listLoans(today),
    listMembers(),
    getSettings(),
  ]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const bookTitle = new Map<string, string>();
  {
    const { listBooks } = await import("@/lib/api");
    const books = await listBooks();
    for (const b of books) bookTitle.set(b.id, b.title);
  }

  const active = loans.filter((l) => !l.returnedAt);
  const overdue = active.filter((l) => l.status === "overdue");
  const returned = loans.filter((l) => l.returnedAt);

  let list =
    tab === "overdue" ? overdue : tab === "returned" ? returned : active;

  if (q) {
    list = list.filter((l) => {
      const member = memberById.get(l.memberId);
      return (
        l.receiptCode.toLowerCase().includes(q) ||
        (bookTitle.get(l.bookId) ?? "").toLowerCase().includes(q) ||
        (member?.name ?? "").toLowerCase().includes(q) ||
        (member?.code ?? "").includes(q)
      );
    });
  }

  const dueSoon = active.filter((l) => {
    const d = daysLeft(l.dueAt, today);
    return d >= 0 && d <= 3;
  });

  const tabLink = (key: string) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (key !== "active") params.set("tab", key);
    const s = params.toString();
    return s ? `/loans?${s}` : "/loans";
  };

  return (
    <AppShell>
      <PageHead
        title="Mượn & Trả"
        meta={`${active.length} phiếu đang mở, ${overdue.length} quá hạn`}
        actions={
          <>
            <Link className="btn btn-quiet" href="/loans?tab=returned">
              Nhập trả tại chỗ
            </Link>
            <Link className="btn" href="/loans/issue">
              Tạo phiếu mượn
            </Link>
          </>
        }
      />

      <div className="tabs" role="tablist">
        {(
          [
            ["active", "Đang mượn", active.length],
            ["overdue", "Quá hạn", overdue.length],
            ["returned", "Đã trả", returned.length],
          ] as [string, string, number][]
        ).map(([key, label, count]) => (
          <Link
            key={key}
            href={tabLink(key)}
            role="tab"
            aria-selected={tab === key}
            className="tab-btn"
          >
            {label}
            <span className="tab-count">{count}</span>
          </Link>
        ))}
      </div>

      <form className="fieldset" method="get">
        {tab !== "active" ? <input type="hidden" name="tab" value={tab} /> : null}
        <label className="search-inline">
          <input
            type="search"
            name="q"
            placeholder="Mã phiếu, tên sách, hội viên"
            defaultValue={sp.q ?? ""}
            aria-label="Tìm phiếu mượn"
          />
        </label>
        <button className="btn btn-quiet" type="submit">
          Tìm
        </button>
        <span className="filter-count">{list.length} phiếu</span>
      </form>

      <section className="section">
        <SectionTitle count={`${list.length} phiếu`}>
          {tab === "active"
            ? "Phiếu đang mở"
            : tab === "overdue"
              ? "Phiếu quá hạn"
              : "Phiếu đã trả"}
        </SectionTitle>

        {list.length === 0 ? (
          <p className="muted">
            {tab === "returned"
              ? "Chưa có phiếu trả nào trong bộ dữ liệu hiện tại."
              : "Không có phiếu nào khớp bộ lọc."}
          </p>
        ) : (
          <Rows>
            {list.map((l) => {
              const member = memberById.get(l.memberId);
              const late = l.status === "overdue";
              const d = daysLate(l.dueAt, today);
              return (
                <Row key={l.id} className="loan">
                  <span className="no code">{l.receiptCode}</span>
                  <div>
                    <Link href={`/books/${l.bookId}`} className="title link">
                      {bookTitle.get(l.bookId)}
                    </Link>
                    <span className="sub">
                      {member?.name}, bản {l.copyLabel}
                    </span>
                  </div>
                  <span className="who code">
                    Hạn {formatDate(l.dueAt)}
                    {late ? (
                      <span className="sub late-sub">
                        trễ {d} ngày, {formatVNDFull(d * settings.finePerDay)}
                      </span>
                    ) : null}
                  </span>
                  <span className="who code">{member?.code}</span>
                  <div className="row-actions">
                    {l.returnedAt ? (
                      <Status tone="neutral">Đã trả</Status>
                    ) : (
                      <>
                        <Status tone={late ? "late" : "neutral"}>
                          {late ? "Quá hạn" : "Còn hạn"}
                        </Status>
                        {!late ? (
                          <RenewButton
                            loanId={l.id}
                            renewCount={l.renewCount}
                            maxRenewals={settings.maxRenewals}
                          />
                        ) : null}
                        <ReturnButton loanId={l.id} receiptCode={l.receiptCode} />
                      </>
                    )}
                  </div>
                </Row>
              );
            })}
          </Rows>
        )}
      </section>

      {tab === "active" && dueSoon.length > 0 ? (
        <section className="section">
          <SectionTitle count={`${dueSoon.length} phiếu`}>
            Đến hạn trong 3 ngày tới
          </SectionTitle>
          <Rows>
            {dueSoon.map((l) => (
              <Row key={l.id} className="c4">
                <span className="no code">{l.copyLabel}</span>
                <div>
                  <span className="title">{bookTitle.get(l.bookId)}</span>
                  <span className="sub">{memberById.get(l.memberId)?.name}</span>
                </div>
                <span className="who code">{formatDate(l.dueAt)}</span>
                <Status tone="neutral">Sắp đến hạn</Status>
              </Row>
            ))}
          </Rows>
        </section>
      ) : null}
    </AppShell>
  );
}
