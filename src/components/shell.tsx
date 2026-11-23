"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Bookmark,
  LogOut,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { signOutAction } from "@/app/actions";

const NAV = [
  { href: "/", label: "Sách", icon: BookOpen },
  { href: "/loans", label: "Mượn & Trả", icon: BookMarked },
  { href: "/members", label: "Hội viên", icon: Users },
  { href: "/reservations", label: "Đặt trước", icon: Bookmark },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
];

/* ---------------- Thanh điều hướng dọc ---------------- */

export function Rail() {
  const pathname = usePathname();

  return (
    <nav className="rail" aria-label="Điều hướng chính">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={active ? "is-active" : undefined}
          >
            <Icon size={19} strokeWidth={1.5} aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
      <div className="spacer" />
      <Link href="/settings">
        <Settings size={19} strokeWidth={1.5} aria-hidden />
        <span>Cài đặt</span>
      </Link>
    </nav>
  );
}

/* ---------------- Ô tìm kiếm chung ---------------- */

/**
 * Tìm kiếm chung: gõ tên sách, tên hội viên hoặc mã phiếu, nhấn Enter để
 * chuyển tới trang phù hợp nhất. Phím `/` đưa con trỏ vào ô tìm kiếm.
 */
function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
        setQ("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/loans?q=${encodeURIComponent(term)}`);
  }

  return (
    <form className="search" onSubmit={submit} role="search">
      <Search size={14} strokeWidth={2} aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm sách, hội viên, phiếu mượn"
        aria-label="Tìm sách, hội viên, phiếu mượn"
      />
      <kbd>/</kbd>
    </form>
  );
}

/* ---------------- Nút thông báo ---------------- */

/**
 * Thông báo từ các việc đang treo: sách hết bản, thẻ sắp hết hạn,
 * phiếu quá hạn, lượt đặt trước đang chờ.
 */
export type Notice = {
  id: string;
  text: string;
  href: string;
  tone: "late" | "neutral";
};

function NotificationsButton({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="notice-wrap" ref={ref}>
      <button
        className="icon-btn"
        title="Thông báo"
        aria-label={`Thông báo (${notices.length})`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={17} strokeWidth={1.6} aria-hidden />
        {notices.length > 0 ? (
          <span className="notice-dot" aria-hidden>
            {notices.length > 9 ? "9+" : notices.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notice-panel" role="dialog" aria-label="Thông báo">
          <div className="notice-head">
            <strong>Việc cần xử lý</strong>
            <span>{notices.length} mục</span>
          </div>
          {notices.length === 0 ? (
            <p className="muted">Không có việc nào đang treo.</p>
          ) : (
            <ul>
              {notices.map((n) => (
                <li key={n.id}>
                  <Link href={n.href} onClick={() => setOpen(false)}>
                    <i className={n.tone === "late" ? "is-late" : ""} aria-hidden />
                    {n.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Thanh trên cùng ---------------- */

export function Topbar({
  user,
  libraryName,
  notices = [],
}: {
  user: User | null;
  libraryName: string;
  notices?: Notice[];
}) {
  const name =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Thủ thư";

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="topbar">
      <div className="wordmark">
        Sổ <b>Mượn</b>
      </div>
      <div className="brand-sub">{libraryName}</div>

      <GlobalSearch />

      <NotificationsButton notices={notices} />

      <div className="user-chip">
        <div className="avatar" title={name}>
          {initials || "TT"}
        </div>
        <span className="user-name">{name}</span>
      </div>

      <form action={signOutAction}>
        <button className="icon-btn" title="Đăng xuất" aria-label="Đăng xuất">
          <LogOut size={16} strokeWidth={1.6} aria-hidden />
        </button>
      </form>
    </header>
  );
}
