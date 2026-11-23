import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHead, Row, Rows, SectionTitle, Status } from "@/components/ui";
import { PayFineButton } from "@/components/fine-actions";
import { getMember, listDebts, listLoans } from "@/lib/api";
import { formatDate, formatVNDFull, isMembershipValid, todayISO } from "@/lib/types";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const today = todayISO();

  const member = await getMember(id);
  if (!member) notFound();

  const [loans, debts] = await Promise.all([
    listLoans(today),
    listDebts({ memberId: id }),
  ]);

  const own = loans.filter((l) => l.memberId === member.id);
  const active = own.filter((l) => !l.returnedAt);
  const returned = own.filter((l) => l.returnedAt);

  const unpaid = debts.filter((d) => !d.paid);
  const fineTotal = unpaid.reduce((s, d) => s + d.amount, 0);

  const valid = isMembershipValid(member.expiryDate, today);

  // Tải tên sách một lần thay vì gọi trong vòng lặp JSX.
  const { listBooks } = await import("@/lib/api");
  const allBooks = await listBooks();
  const bookTitle = new Map(allBooks.map((b) => [b.id, b.title]));

  return (
    <AppShell>
      <Link className="back-link" href="/members">
        <ArrowLeft size={13} strokeWidth={2} aria-hidden />
        Về danh sách hội viên
      </Link>

      <PageHead
        title={member.name}
        meta={
          <>
            <span className="code">Thẻ {member.code}</span>
            <span>Hạng {member.tier}</span>
            {member.email ? <span>{member.email}</span> : null}
            {member.phone ? <span>{member.phone}</span> : null}
          </>
        }
        actions={
          <>
            <Link className="btn btn-quiet" href={`/members/${member.id}/edit`}>
              Sửa hồ sơ
            </Link>
            <Link className="btn" href="/loans/issue">
              Cho mượn
            </Link>
          </>
        }
      />

      <div className="detail-grid">
        <div className="detail-main">
          <section className="section">
            <SectionTitle count={`${active.length} cuốn`}>Đang mượn</SectionTitle>
            {active.length === 0 ? (
              <p className="muted">Hội viên không có cuốn nào đang mượn.</p>
            ) : (
              <Rows>
                {active.map((l) => (
                  <Row key={l.id} className="c4">
                    <span className="no code">{l.copyLabel}</span>
                    <div>
                      <Link href={`/books/${l.bookId}`} className="title link">
                        {bookTitle.get(l.bookId) ?? "Sách đã xoá"}
                      </Link>
                      <span className="sub">Phiếu {l.receiptCode}</span>
                    </div>
                    <span className="who code">Hạn {formatDate(l.dueAt)}</span>
                    <Status tone={l.status === "overdue" ? "late" : "neutral"}>
                      {l.status === "overdue" ? "Trễ hạn" : "Còn hạn"}
                    </Status>
                  </Row>
                ))}
              </Rows>
            )}
          </section>

          {returned.length > 0 ? (
            <section className="section">
              <SectionTitle count={`${returned.length} phiếu`}>Lịch sử mượn</SectionTitle>
              <Rows>
                {returned.slice(0, 10).map((l) => (
                  <Row key={l.id} className="c4">
                    <span className="no code">{l.copyLabel}</span>
                    <div>
                      <Link href={`/books/${l.bookId}`} className="title link">
                        {bookTitle.get(l.bookId) ?? "Sách đã xoá"}
                      </Link>
                      <span className="sub">Phiếu {l.receiptCode}</span>
                    </div>
                    <span className="who code">{formatDate(l.returnedAt!)}</span>
                    <Status tone="neutral">Đã trả</Status>
                  </Row>
                ))}
              </Rows>
            </section>
          ) : null}
        </div>

        <aside className="detail-side">
          <dl className="facts">
            <div>
              <dt>Số thẻ</dt>
              <dd className="code">{member.code}</dd>
            </div>
            <div>
              <dt>Hạng</dt>
              <dd>{member.tier}</dd>
            </div>
            <div>
              <dt>Hạn mức</dt>
              <dd className="code">{member.maxBooks} cuốn</dd>
            </div>
            <div>
              <dt>Ngày cấp</dt>
              <dd className="code">{formatDate(member.joinedAt)}</dd>
            </div>
            <div>
              <dt>Hết hạn</dt>
              <dd className="code">{formatDate(member.expiryDate)}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>
                <Status tone={valid ? "ok" : "late"}>
                  {valid ? "Còn hiệu lực" : "Đã hết hạn"}
                </Status>
              </dd>
            </div>
          </dl>

          <div className="copy-list">
            <h3>Phí trễ hạn đang nợ</h3>
            <div className="fine-summary">
              <span className="num">{formatVNDFull(fineTotal)}</span>
              <span className="m">
                {unpaid.length > 0
                  ? `từ ${unpaid.length} khoản nợ`
                  : "Không có khoản nợ nào"}
              </span>
            </div>
            {unpaid.length > 0 ? (
              <div className="debt-list">
                {unpaid.map((d) => (
                  <div key={d.fineId ?? d.loanId ?? d.receiptCode} className="debt-row">
                    <span className="code">{d.receiptCode}</span>
                    <span className="who">
                      {d.bookTitle}
                      <br />
                      trễ {d.daysLate} ngày
                    </span>
                    <span className="num alert">{formatVNDFull(d.amount)}</span>
                    <PayFineButton
                      fineId={d.fineId}
                      loanId={d.loanId}
                      amount={d.amount}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {member.notes ? (
            <div className="copy-list">
              <h3>Ghi chú</h3>
              <p className="muted">{member.notes}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
