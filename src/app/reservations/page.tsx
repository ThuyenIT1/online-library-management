import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead, Row, Rows, SectionTitle, Status } from "@/components/ui";
import { ReservationActions } from "@/components/reservation-actions";
import { listBooks, listMembers, listReservations } from "@/lib/api";
import { formatDate } from "@/lib/types";
import type { ReservationStatus } from "@/lib/types";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  waiting: "Đang chờ",
  ready: "Sẵn sàng",
  picked_up: "Đã lấy",
  cancelled: "Đã huỷ",
};

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab ?? "waiting";

  const [reservations, books, members] = await Promise.all([
    listReservations(),
    listBooks(),
    listMembers(),
  ]);

  const bookById = new Map(books.map((b) => [b.id, b]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  const byStatus = (s: ReservationStatus) =>
    reservations.filter((r) => r.status === s);

  const lists: Record<string, ReservationStatus[]> = {
    waiting: ["waiting"],
    ready: ["ready"],
    picked_up: ["picked_up"],
    cancelled: ["cancelled"],
  };

  const current = lists[tab] ?? lists.waiting;
  const list = current.flatMap((s) => byStatus(s));

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "waiting", label: "Đang chờ", count: byStatus("waiting").length },
    { key: "ready", label: "Sẵn sàng", count: byStatus("ready").length },
    { key: "picked_up", label: "Đã lấy", count: byStatus("picked_up").length },
    { key: "cancelled", label: "Đã huỷ", count: byStatus("cancelled").length },
  ];

  return (
    <AppShell>
      <PageHead
        title="Đặt trước"
        meta={`${byStatus("waiting").length + byStatus("ready").length} lượt đang chờ xử lý`}
      />

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "waiting" ? "/reservations" : `/reservations?tab=${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            className="tab-btn"
          >
            {t.label}
            <span className="tab-count">{t.count}</span>
          </Link>
        ))}
      </div>

      <section className="section">
        <SectionTitle count={`${list.length} lượt`}>
          {tabs.find((t) => t.key === tab)?.label ?? "Đang chờ"}
        </SectionTitle>

        {list.length === 0 ? (
          <p className="muted">Không có lượt đặt trước nào trong mục này.</p>
        ) : (
          <Rows>
            {list.map((r) => {
              const book = bookById.get(r.bookId);
              const member = memberById.get(r.memberId);
              return (
                <Row key={r.id} className="c4">
                  <span className="no code">{formatDate(r.reservedAt)}</span>
                  <div>
                    {book ? (
                      <Link href={`/books/${book.id}`} className="title link">
                        {book.title}
                      </Link>
                    ) : (
                      <span className="title">Sách đã xoá</span>
                    )}
                    <span className="sub">
                      {member?.name ?? "Hội viên đã xoá"} · thẻ{" "}
                      {member?.code ?? "—"}
                    </span>
                  </div>
                  <span className="who code">
                    {book?.available ?? 0}/{book?.copies ?? 0} bản còn trong kệ
                  </span>
                  <div className="row-actions">
                    <Status
                      tone={r.status === "cancelled" ? "neutral" : "ok"}
                    >
                      {STATUS_LABEL[r.status]}
                    </Status>
                    <ReservationActions
                      reservationId={r.id}
                      status={r.status}
                    />
                  </div>
                </Row>
              );
            })}
          </Rows>
        )}
      </section>
    </AppShell>
  );
}
