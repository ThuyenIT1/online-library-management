/**
 * Gắn khoản phí trễ hạn với phiếu mượn tương ứng.
 *
 *   node scripts/link-fines.mjs
 *
 * Bảng `fines` có cột loan_id nhưng dữ liệu mồi cũ để trống cột này. Khi
 * đó, thủ thư không biết khoản phí đó thuộc phiếu nào, và phần nợ đang tính
 * theo ngày của phiếu sẽ bị tính trùng với khoản phí đã ghi.
 *
 * Script này:
 *  1. Với dòng phí chưa có loan_id, dò phiếu mượn cùng hội viên và cùng
 *     số tiền phí.
 *  2. Nếu phiếu đó đã có một dòng phí khác gắn vào, dòng chưa gắn kia là
 *     bản trùng của dữ liệu mồi → xoá để tránh tính trùng.
 *  3. Nếu chưa có, gắn loan_id cho dòng phí đó.
 *
 * Chạy lại nhiều lần vẫn an toàn.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {
  ...loadEnv(join(root, ".env.local")),
  ...loadEnv(join(root, ".env")),
};

const base = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

if (!base || !secret) {
  console.error("Thiếu cấu hình Supabase trong .env.local");
  process.exit(1);
}

const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function rest(path, options = {}) {
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const fines = await rest(
  "fines?select=id,loan_id,member_id,days_late,amount,paid",
);
const loans = await rest(
  "loans?select=id,receipt_code,member_id,due_on,returned_on,fine_amount",
);

console.log(`Đọc ${fines.length} dòng phí, ${loans.length} phiếu mượn.\n`);

/** Các phiếu đã có ít nhất một dòng phí gắn vào. */
const loansWithFine = new Set(
  fines.filter((f) => f.loan_id).map((f) => f.loan_id),
);

let linked = 0;
let removed = 0;
let skipped = 0;

for (const f of fines) {
  if (f.loan_id) {
    console.log(`  · ${f.id} đã có loan_id — bỏ qua.`);
    skipped++;
    continue;
  }

  // Ứng viên: cùng hội viên và cùng số tiền phí.
  const candidates = loans.filter(
    (l) => l.member_id === f.member_id && l.fine_amount === f.amount,
  );

  if (candidates.length === 0) {
    // Dòng phí cũ (số tiền không còn khớp phiếu nào) nhưng phiếu của hội
    // viên đã có dòng phí chính thức gắn rồi → đây là bản trùng cũ.
    const memberLoansWithFine = loans.filter(
      (l) => l.member_id === f.member_id && loansWithFine.has(l.id),
    );
    if (memberLoansWithFine.length > 0) {
      await rest(`fines?id=eq.${f.id}`, { method: "DELETE" });
      console.log(
        `  ✗ ${f.id}: số tiền đã lỗi thời, phiếu đã có phí gắn — đã xoá.`,
      );
      removed++;
      continue;
    }
    console.log(`  ! ${f.id}: không tìm thấy phiếu khớp — giữ nguyên.`);
    skipped++;
    continue;
  }

  // Nhiều phiếu khớp thì ưu tiên phiếu còn đang mượn, rồi tới phiếu có số
  // ngày trễ khớp với dòng phí.
  const byDays = candidates.filter((l) => {
    if (!f.days_late || !l.due_on) return false;
    const due = new Date(l.due_on + "T00:00:00");
    const diff = Math.floor((Date.now() - due.getTime()) / 86400000);
    return diff === f.days_late;
  });

  const open = candidates.filter((l) => !l.returned_on);
  const pool =
    byDays.length === 1
      ? byDays
      : open.length === 1
        ? open
        : candidates;
  const pick = pool[0];

  // Phiếu đã có dòng phí gắn rồi → dòng này là bản trùng của dữ liệu mồi.
  if (loansWithFine.has(pick.id)) {
    await rest(`fines?id=eq.${f.id}`, { method: "DELETE" });
    console.log(`  ✗ ${f.id}: trùng với phiếu ${pick.receipt_code} — đã xoá.`);
    removed++;
    continue;
  }

  await rest(`fines?id=eq.${f.id}`, {
    method: "PATCH",
    body: JSON.stringify({ loan_id: pick.id }),
  });

  loansWithFine.add(pick.id);
  console.log(`  ✓ ${f.id} → ${pick.receipt_code}`);
  linked++;
}

console.log(
  `\nGắn ${linked} dòng phí, xoá ${removed} dòng trùng, bỏ qua ${skipped} dòng.`,
);
