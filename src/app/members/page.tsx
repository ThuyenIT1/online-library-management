import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead, Row, Rows, SectionTitle, Status } from "@/components/ui";
import { listLoans, listMembers } from "@/lib/api";
import { daysLeft, formatDate, isMembershipValid, todayISO } from "@/lib/types";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const today = todayISO();

  const [members, loans] = await Promise.all([listMembers(q), listLoans(today)]);

  const activeByMember = new Map<string, number>();
  for (const l of loans) {
    if (!l.returnedAt) {
      activeByMember.set(l.memberId, (activeByMember.get(l.memberId) ?? 0) + 1);
    }
  }

  const expiring = members.filter((m) => {
    const d = daysLeft(m.expiryDate, today);
    return d >= 0 && d <= 60;
  });

  const atQuota = members.filter(
    (m) => m.maxBooks > 0 && (activeByMember.get(m.id) ?? 0) >= m.maxBooks,
  );

  return (
    <AppShell>
      <PageHead
        title="Hội viên"
        meta={`${members.length} thẻ đang cấp, ${expiring.length} thẻ sắp hết hạn`}
        actions={
          <>
            <Link className="btn btn-quiet" href="/members/import">
              Nhập danh sách
            </Link>
            <Link className="btn" href="/members/new">
              Cấp thẻ mới
            </Link>
          </>
        }
      />

      <form className="fieldset" method="get">
        <label className="search-inline">
          <input
            type="search"
            name="q"
            placeholder="Tên, số thẻ, email"
            defaultValue={q}
            aria-label="Tìm hội viên"
          />
        </label>
        <button className="btn btn-quiet" type="submit">
          Tìm
        </button>
        <span className="filter-count">{members.length} hội viên</span>
      </form>

      <section className="section">
        <SectionTitle>Danh sách thẻ</SectionTitle>
        <Rows>
          {members.map((m) => {
            const valid = isMembershipValid(m.expiryDate, today);
            const active = activeByMember.get(m.id) ?? 0;
            const over = active > m.maxBooks;
            const left = daysLeft(m.expiryDate, today);
            return (
              <Row key={m.id} className="mem">
                <div>
                  <Link href={`/members/${m.id}`} className="title link">
                    {m.name}
                  </Link>
                  <span className="sub">
                    Thẻ {m.code}
                    {m.email ? `, ${m.email}` : ""}
                  </span>
                </div>
                <span className="who">{m.tier}</span>
                <span className="num">
                  {active}
                  <span className="of"> / {m.maxBooks}</span>
                </span>
                <span className="who code">
                  {formatDate(m.expiryDate)}
                  {!valid ? (
                    <span className="sub late-sub">Đã quá hạn</span>
                  ) : left <= 60 ? (
                    <span className="sub">Còn {left} ngày</span>
                  ) : null}
                </span>
                <Status tone={over ? "late" : valid ? "ok" : "neutral"}>
                  {over ? "Vượt hạn mức" : valid ? "Còn hiệu lực" : "Hết hạn"}
                </Status>
              </Row>
            );
          })}
        </Rows>
        {members.length === 0 ? (
          <p className="muted">Không có hội viên nào khớp từ khoá.</p>
        ) : null}
      </section>

      {expiring.length > 0 ? (
        <section className="section">
          <SectionTitle count={`${expiring.length} thẻ`}>
            Thẻ hết hạn trong 60 ngày
          </SectionTitle>
          <Rows>
            {expiring.map((m) => (
              <Row key={m.id} className="c4">
                <span className="no code">{m.code}</span>
                <div>
                  <span className="title">{m.name}</span>
                  <span className="sub">
                    Hạng {m.tier}, còn{" "}
                    {Math.max(0, m.maxBooks - (activeByMember.get(m.id) ?? 0))} cuốn có
                    thể mượn
                  </span>
                </div>
                <span className="who code">{formatDate(m.expiryDate)}</span>
                <Status tone="neutral">Gia hạn</Status>
              </Row>
            ))}
          </Rows>
        </section>
      ) : null}

      {atQuota.length > 0 ? (
        <section className="section">
          <SectionTitle count={`${atQuota.length} người`}>
            Đã đạt hạn mức mượn
          </SectionTitle>
          <Rows>
            {atQuota.map((m) => (
              <Row key={m.id} className="c4">
                <span className="no code">{m.code}</span>
                <div>
                  <span className="title">{m.name}</span>
                  <span className="sub">
                    Hạng {m.tier}, tối đa {m.maxBooks} cuốn
                  </span>
                </div>
                <span className="who code">
                  {activeByMember.get(m.id) ?? 0} cuốn đang mượn
                </span>
                <Status tone="late">Chặn mượn mới</Status>
              </Row>
            ))}
          </Rows>
        </section>
      ) : null}
    </AppShell>
  );
}
