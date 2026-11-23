import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead, SectionTitle } from "@/components/ui";
import { PayFineButton } from "@/components/fine-actions";
import { PrintButton } from "@/components/print-button";
import { getBook, getSettings, getStats, listDebts, listLoans } from "@/lib/api";
import {
  daysLate,
  formatDateShort,
  formatVND,
  formatVNDFull,
  todayISO,
} from "@/lib/types";

/* ---------------- Các kỳ báo cáo ---------------- */

const PERIODS = [
  { key: 30, days: 30, label: "30 ngày" },
  { key: 90, days: 90, label: "90 ngày" },
  { key: 365, days: 365, label: "12 tháng" },
] as const;

/** Lùi ngày, dùng cho mốc đầu kỳ. */
function shiftDays(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

/* ---------------- Biểu đồ thanh kẻ ---------------- */

function BarChart({
  rows,
  max,
}: {
  rows: { cat: string; value: number }[];
  max: number;
}) {
  return (
    <div>
      {rows.map((r) => (
        <div className="chart-row" key={r.cat}>
          <span className="cat">{r.cat}</span>
          <span className="track">
            <i
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
              aria-hidden
            />
          </span>
          <span className="v">{r.value}</span>
        </div>
      ))}
      <div className="chart-axis">
        <span />
        <span>
          <span>0</span>
          <span>{max}</span>
        </span>
        <span />
      </div>
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const today = todayISO();

  const period =
    PERIODS.find((p) => String(p.key) === sp.period) ?? PERIODS[0];
  const from = shiftDays(today, -period.days);

  const [stats, loans, settings, debts] = await Promise.all([
    getStats(),
    listLoans(today),
    getSettings(),
    listDebts(),
  ]);

  const active = loans.filter((l) => !l.returnedAt);
  const overdue = active.filter((l) => l.status === "overdue");

  // Chỉ tính lưu lượng trong kỳ đã chọn.
  const periodLoans = loans.filter(
    (l) => l.borrowedAt >= from && l.borrowedAt <= today,
  );
  const periodReturns = loans.filter(
    (l) => l.returnedAt !== null && l.returnedAt >= from && l.returnedAt <= today,
  );
  const periodOverdue = periodLoans.filter((l) => l.status === "overdue");

  // Số bản theo chủ đề, tính từ view book_stock.
  const subjectRows = stats.bySubject
    .map((s) => ({ cat: s.subject, value: s.count }))
    .sort((a, b) => b.value - a.value);
  const subjectMax = Math.max(...subjectRows.map((r) => r.value), 1);
  const subjectTotal = subjectRows.reduce((s, r) => s + r.value, 0) || 1;

  const shareRows = subjectRows.map((r) => ({
    cat: r.cat,
    value: Math.round((r.value / subjectTotal) * 100),
  }));

  const bookTitles = await loadTitles(stats.borrowCount.map((b) => b.bookId));

  const borrowRows = stats.borrowCount
    .map((b) => ({
      cat: bookTitles.get(b.bookId) ?? "Sách đã xoá",
      value: b.count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const borrowMax = Math.max(...borrowRows.map((r) => r.value), 1);

  const unpaidDebts = debts.filter((d) => !d.paid);
  const fineTotal = unpaidDebts.reduce((s, d) => s + d.amount, 0);
  const avgLate = overdue.length
    ? Math.round(
        overdue.reduce((s, l) => s + daysLate(l.dueAt, today), 0) / overdue.length,
      )
    : 0;

  return (
    <AppShell>
      <PageHead
        title="Báo cáo"
        meta={`Lưu lượng mượn trả, tỉ lệ quá hạn, doanh thu phí · ${period.label}`}
        actions={
          <>
            <Link className="btn btn-quiet" href="/reports/export?period=30&kind=loans">
              Xuất báo cáo
            </Link>
            <PrintButton />
          </>
        }
      />

      <div className="tabs" role="tablist">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={p.key === 30 ? "/reports" : `/reports?period=${p.key}`}
            role="tab"
            aria-selected={period.key === p.key}
            className="tab-btn"
          >
            {p.label}
          </Link>
        ))}
      </div>

      <section className="section">
        <SectionTitle>Tổng quan</SectionTitle>
        <div className="counts counts-4">
          <div>
            <span className="n">{stats.totalCopies}</span>
            <span className="label">Bản sách trong kho</span>
          </div>
          <div>
            <span className="n">{active.length}</span>
            <span className="label">Đang lưu hành</span>
          </div>
          <div>
            <span className="n alert">{overdue.length}</span>
            <span className="label">Quá hạn</span>
          </div>
          <div>
            <span className="n">{formatVND(fineTotal)}</span>
            <span className="label">Phí trễ hạn đang nợ</span>
          </div>
        </div>
      </section>

      <section className="section">
        <SectionTitle>Lưu lượng trong kỳ</SectionTitle>
        <div className="counts counts-4">
          <div>
            <span className="n">{periodLoans.length}</span>
            <span className="label">Phiếu mượn phát sinh</span>
          </div>
          <div>
            <span className="n">{periodReturns.length}</span>
            <span className="label">Phiếu trả trong kỳ</span>
          </div>
          <div>
            <span className="n alert">{periodOverdue.length}</span>
            <span className="label">Trong đó quá hạn</span>
          </div>
          <div>
            <span className="n">
              {periodLoans.length
                ? Math.round((periodReturns.length / periodLoans.length) * 100)
                : 0}
              %
            </span>
            <span className="label">Tỉ lệ trả trong kỳ</span>
          </div>
        </div>
      </section>

      <div className="report-grid">
        <section className="section">
          <SectionTitle>Sách theo chủ đề</SectionTitle>
          <BarChart rows={subjectRows} max={subjectMax} />
        </section>

        <section className="section">
          <SectionTitle>Tỉ lệ theo chủ đề</SectionTitle>
          <div>
            {shareRows.map((r) => (
              <div className="chart-row" key={r.cat}>
                <span className="cat">{r.cat}</span>
                <span className="bar">
                  <span className="seg-a" style={{ width: `${r.value}%` }} />
                </span>
                <span className="v">{r.value}%</span>
              </div>
            ))}
            <div className="legend">
              <span>
                <i style={{ background: "var(--color-ink)" }} />
                Tỉ trọng theo số đầu sách
              </span>
            </div>
          </div>
        </section>

        <section className="section">
          <SectionTitle>Sách được mượn nhiều nhất</SectionTitle>
          {borrowRows.length === 0 ? (
            <p className="muted">Chưa có dữ liệu mượn.</p>
          ) : (
            <BarChart rows={borrowRows} max={borrowMax} />
          )}
        </section>

        <section className="section">
          <SectionTitle>Phí trễ hạn</SectionTitle>
          <div className="counts counts-3">
            <div>
              <span className="n">{formatVND(fineTotal)}</span>
              <span className="label">Tổng đang nợ</span>
            </div>
            <div>
              <span className="n">{avgLate}</span>
              <span className="label">Ngày trễ trung bình</span>
            </div>
            <div>
              <span className="n">{formatVNDFull(settings.finePerDay)}</span>
              <span className="label">Đơn giá mỗi ngày</span>
            </div>
          </div>

          <div className="fine-list">
            {unpaidDebts.map((d) => (
              <div key={d.fineId ?? d.loanId ?? d.receiptCode} className="fine-row">
                <span className="code">{d.receiptCode}</span>
                <span className="who">
                  {d.memberName}
                  <br />
                  {d.bookTitle}
                </span>
                <span className="who code">{d.daysLate} ngày</span>
                <span className="num alert">{formatVNDFull(d.amount)}</span>
                <PayFineButton
                  fineId={d.fineId}
                  loanId={d.loanId}
                  amount={d.amount}
                />
              </div>
            ))}
            {unpaidDebts.length === 0 ? (
              <p className="muted">Không có khoản nợ trễ hạn nào.</p>
            ) : null}
          </div>

          {debts.some((d) => d.paid) ? (
            <>
              <SectionTitle count={`${debts.filter((d) => d.paid).length} mục`}>
                Đã thu phí
              </SectionTitle>
              <div className="fine-list">
                {debts
                  .filter((d) => d.paid)
                  .map((d) => (
                    <div
                      key={d.fineId ?? d.loanId ?? d.receiptCode}
                      className="fine-row"
                    >
                      <span className="code">{d.receiptCode}</span>
                      <span className="who">
                        {d.memberName}
                        <br />
                        {d.bookTitle}
                      </span>
                      <span className="who code">{d.daysLate} ngày</span>
                      <span className="num">{formatVNDFull(d.amount)}</span>
                      <span className="who code">
                        {d.paidOn ? `Thu ${formatDateShort(d.paidOn)}` : "Đã thu"}
                      </span>
                    </div>
                  ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

async function loadTitles(bookIds: string[]) {
  const map = new Map<string, string>();
  await Promise.all(
    bookIds.map(async (id) => {
      const b = await getBook(id);
      if (b) map.set(id, b.title);
    }),
  );
  return map;
}