"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addBookCopies,
  createBook,
  createMember,
  createReservation,
  issueLoan,
  payDebt,
  renewLoan,
  returnLoan,
  updateBook,
  updateMember,
  updateReservationStatus,
  updateSettings,
} from "@/lib/api";
import type { BookInput, MemberInput } from "@/lib/api";
import type { ActionResult } from "@/lib/action-result";
import type { ReservationStatus } from "@/lib/types";

/* ==========================================================================
   Server Actions.
   Mọi thao tác ghi dữ liệu đi qua đây, để giao diện chỉ gọi hàm và
   không phải tự quản lý Supabase client.
   ========================================================================== */

/* ---------------- Đăng nhập / đăng ký ---------------- */

export async function signInAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "Nhập đầy đủ email và mật khẩu." };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      ok: false,
      message:
        error.message === "Invalid login credentials"
          ? "Email hoặc mật khẩu không đúng."
          : error.message,
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUpAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = "Cần nhập họ tên.";
  if (!email) fieldErrors.email = "Cần nhập email.";
  if (password.length < 8) fieldErrors.password = "Mật khẩu tối thiểu 8 ký tự.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Thiếu thông tin.", fieldErrors };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return {
      ok: false,
      message:
        error.message === "User already registered"
          ? "Email này đã được đăng ký."
          : error.message,
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/* ---------------- Cho mượn ---------------- */

export async function issueLoanAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const bookId = String(formData.get("bookId") ?? "");
  const copyId = String(formData.get("copyId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!bookId || !copyId || !memberId) {
    return { ok: false, message: "Cần chọn đầy đủ sách, bản vật lý và hội viên." };
  }

  try {
    const result = await issueLoan({ bookId, copyId, memberId, note });

    if (!result.ok) return { ok: false, message: result.reason };

    revalidatePath("/");
    revalidatePath("/loans");
    revalidatePath("/books");

    return {
      ok: true,
      message: `Đã tạo phiếu ${result.receiptCode}, hạn trả ${result.dueOn}.`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Không tạo được phiếu mượn.",
    };
  }
}

export async function returnLoanAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const loanId = String(formData.get("loanId") ?? "");
  if (!loanId) return { ok: false, message: "Thiếu mã phiếu." };

  try {
    const result = await returnLoan(loanId);

    if (!result.ok) {
      return { ok: false, message: result.reason ?? "Không trả được sách." };
    }

    revalidatePath("/");
    revalidatePath("/loans");
    revalidatePath("/reports");

    return {
      ok: true,
      message:
        result.fine && result.fine > 0
          ? `Đã nhận lại sách. Phí trễ hạn ${result.fine.toLocaleString("vi-VN")} đ.`
          : "Đã nhận lại sách.",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Không trả được sách.",
    };
  }
}

export async function renewLoanAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const loanId = String(formData.get("loanId") ?? "");
  if (!loanId) return { ok: false, message: "Thiếu mã phiếu." };

  try {
    const result = await renewLoan(loanId);

    if (!result.ok) {
      return { ok: false, message: result.reason ?? "Không gia hạn được." };
    }

    revalidatePath("/loans");
    revalidatePath("/");

    return { ok: true, message: `Đã gia hạn, hạn trả mới ${result.dueOn}.` };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Không gia hạn được.",
    };
  }
}

/* ---------------- Hội viên ---------------- */

export async function createMemberAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const input = readMemberForm(formData);
  if ("error" in input) return { ok: false, message: input.error };

  try {
    await createMember(input);
    revalidatePath("/members");
    return { ok: true, message: `Đã cấp thẻ ${input.fullName}.` };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Không tạo được hội viên.",
    };
  }
}

export async function updateMemberAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const input = readMemberForm(formData);
  if ("error" in input) return { ok: false, message: input.error };
  if (!id) return { ok: false, message: "Thiếu mã hội viên." };

  try {
    await updateMember(id, input);
    revalidatePath("/members");
    revalidatePath(`/members/${id}`);
    return { ok: true, message: "Đã cập nhật hồ sơ hội viên." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Không cập nhật được.",
    };
  }
}

/* ---------------- Phí và đặt trước ---------------- */

export async function payFineAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const fineId = String(formData.get("fineId") ?? "").trim();
  const loanId = String(formData.get("loanId") ?? "").trim();
  const amount = Number(formData.get("amount") ?? "0");

  if (!fineId && !loanId) {
    return { ok: false, message: "Thiếu mã khoản phí." };
  }

  try {
    const result = await payDebt({
      fineId: fineId || null,
      loanId: loanId || null,
      amount: Number.isFinite(amount) ? amount : 0,
    });

    if (!result.ok) {
      return { ok: false, message: result.reason ?? "Không ghi nhận được phí." };
    }

    revalidatePath("/members");
    revalidatePath("/loans");
    revalidatePath("/reports");
    return { ok: true, message: "Đã ghi nhận thu phí." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Không ghi nhận được phí.",
    };
  }
}

export async function reserveBookAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const bookId = String(formData.get("bookId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  if (!bookId || !memberId) {
    return { ok: false, message: "Cần chọn sách và hội viên." };
  }

  try {
    const result = await createReservation(bookId, memberId);
    if (!result.ok) {
      return { ok: false, message: result.reason ?? "Không đặt trước được." };
    }
    revalidatePath("/books");
    revalidatePath("/reservations");
    return { ok: true, message: "Đã ghi nhận đặt trước." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Không đặt trước được.",
    };
  }
}

export async function updateReservationAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ReservationStatus;
  if (!id || !status) return { ok: false, message: "Thiếu thông tin lượt đặt trước." };

  try {
    await updateReservationStatus(id, status);
    revalidatePath("/reservations");
    revalidatePath("/books");
    return { ok: true, message: "Đã cập nhật lượt đặt trước." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Không cập nhật được.",
    };
  }
}

/* ---------------- Sách ---------------- */

export async function createBookAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const input = readBookForm(formData);
  if ("error" in input) return { ok: false, message: input.error };

  const copies = Number(formData.get("copies") ?? "1");

  try {
    const id = await createBook(
      input,
      Number.isFinite(copies) ? Math.max(0, Math.floor(copies)) : 1,
    );
    revalidatePath("/books");
    return { ok: true, message: `Đã nhập đầu sách ${input.title}.`, id };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Không nhập được đầu sách.",
    };
  }
}

export async function updateBookAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const input = readBookForm(formData);
  if ("error" in input) return { ok: false, message: input.error };
  if (!id) return { ok: false, message: "Thiếu mã đầu sách." };

  const extraCopies = Number(formData.get("extraCopies") ?? "0");

  try {
    await updateBook(id, input);
    if (Number.isFinite(extraCopies) && extraCopies > 0) {
      await addBookCopies(id, Math.floor(extraCopies));
    }
    revalidatePath("/books");
    revalidatePath(`/books/${id}`);
    return { ok: true, message: "Đã cập nhật hồ sơ đầu sách." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Không cập nhật được.",
    };
  }
}

/* ---------------- Nhập hội viên hàng loạt ---------------- */

export async function importMembersAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = String(formData.get("csv") ?? "").trim();
  if (!raw) return { ok: false, message: "Chưa có nội dung CSV." };

  const rows = parseCsv(raw);
  if (rows.length === 0) {
    return { ok: false, message: "Không đọc được dòng dữ liệu nào từ CSV." };
  }

  const header = rows[0].map((h) => h.toLowerCase());
  const hasHeader = header.some((h) =>
    ["họ tên", "ho ten", "full_name", "tên", "ten"].includes(h),
  );
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (dataRows.length === 0) {
    return { ok: false, message: "CSV chỉ có dòng tiêu đề, chưa có hội viên nào." };
  }

  // Bỏ qua dòng tiêu đề nếu có; nếu không thì dùng thứ tự cột cố định.
  const idx = (names: string[], fallback: number) => {
    if (!hasHeader) return fallback;
    const found = names.findIndex((n) => header.includes(n));
    return found >= 0 ? found : -1;
  };

  const iName = idx(["họ tên", "ho ten", "full_name", "tên", "ten"], 0);
  const iEmail = idx(["email", "e-mail"], 1);
  const iPhone = idx(["điện thoại", "dien thoai", "số điện thoại", "phone"], 2);
  const iTier = idx(["hạng", "hang", "tier"], 3);
  const iMax = idx(["hạn mức", "han muc", "max_books"], 4);
  const iJoined = idx(["ngày cấp", "ngay cap", "joined_on"], 5);
  const iExpires = idx(["ngày hết hạn", "ngay het han", "expires_on", "hạn"], 6);
  const iNotes = idx(["ghi chú", "ghi chu", "notes"], 7);

  const created: string[] = [];
  const failed: string[] = [];

  for (const row of dataRows) {
    const name = (iName >= 0 ? row[iName] : "").trim();
    if (!name) continue;

    const expires = (iExpires >= 0 ? row[iExpires] : "").trim();
    if (!expires) {
      failed.push(`${name}: thiếu ngày hết hạn`);
      continue;
    }

    const tierRaw = (iTier >= 0 ? row[iTier] : "").trim();
    const tier = (["Thường", "Vàng", "Đọc tại chỗ"] as const).includes(
      tierRaw as "Thường",
    )
      ? (tierRaw as MemberInput["tier"])
      : "Thường";

    const maxRaw = Number((iMax >= 0 ? row[iMax] : "").trim() || "5");
    const maxBooks = tier === "Đọc tại chỗ" ? 0 : Number.isFinite(maxRaw) ? maxRaw : 5;

    try {
      await createMember({
        fullName: name,
        email: (iEmail >= 0 ? row[iEmail] : "").trim() || null,
        phone: (iPhone >= 0 ? row[iPhone] : "").trim() || null,
        tier,
        maxBooks,
        joinedOn:
          (iJoined >= 0 ? row[iJoined] : "").trim() ||
          new Date().toISOString().slice(0, 10),
        expiresOn: expires,
        status: "active",
        notes: (iNotes >= 0 ? row[iNotes] : "").trim() || null,
      });
      created.push(name);
    } catch (e) {
      failed.push(`${name}: ${e instanceof Error ? e.message : "lỗi không rõ"}`);
    }
  }

  revalidatePath("/members");

  if (created.length === 0) {
    return {
      ok: false,
      message: `Không tạo được hội viên nào. ${failed.slice(0, 3).join("; ")}`,
    };
  }

  const failedNote = failed.length
    ? ` ${failed.length} dòng bị bỏ qua (${failed.slice(0, 2).join("; ")}).`
    : "";

  return {
    ok: true,
    message: `Đã cấp thẻ cho ${created.length} hội viên.${failedNote}`,
  };
}

/** Tách nội dung CSV thành mảng hàng, tự xử lý dấu nháy kép. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/* ---------------- Cài đặt ---------------- */

export async function updateSettingsAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const loanDays = Number(formData.get("loanDays") ?? "14");
  const finePerDay = Number(formData.get("finePerDay") ?? "17000");
  const maxRenewals = Number(formData.get("maxRenewals") ?? "1");

  if (!name) return { ok: false, message: "Cần nhập tên thư viện." };
  if (!Number.isFinite(loanDays) || loanDays <= 0) {
    return { ok: false, message: "Số ngày mượn phải lớn hơn 0." };
  }
  if (!Number.isFinite(finePerDay) || finePerDay < 0) {
    return { ok: false, message: "Phí trễ hạn không được âm." };
  }
  if (!Number.isFinite(maxRenewals) || maxRenewals < 0) {
    return { ok: false, message: "Số lần gia hạn không được âm." };
  }

  try {
    await updateSettings({
      name,
      loanDays: Math.floor(loanDays),
      finePerDay: Math.floor(finePerDay),
      maxRenewals: Math.floor(maxRenewals),
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Đã lưu cấu hình thư viện." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Không lưu được cấu hình.",
    };
  }
}

/* ---------------- Đọc form ---------------- */

function readMemberForm(formData: FormData): MemberInput | { error: string } {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const tier = String(formData.get("tier") ?? "Thường") as MemberInput["tier"];
  const maxBooks = Number(formData.get("maxBooks") ?? 5);
  const expiresOn = String(formData.get("expiresOn") ?? "");

  if (!fullName) return { error: "Cần nhập họ tên." };
  if (!expiresOn) return { error: "Cần chọn ngày hết hạn thẻ." };

  return {
    fullName,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    tier,
    maxBooks: Number.isFinite(maxBooks) ? Math.max(0, maxBooks) : 5,
    joinedOn: String(formData.get("joinedOn") ?? "") || new Date().toISOString().slice(0, 10),
    expiresOn,
    status: String(formData.get("status") ?? "active") as MemberInput["status"],
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

function readBookForm(formData: FormData): BookInput | { error: string } {
  const code = String(formData.get("code") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();

  if (!code) return { error: "Cần nhập mã sách." };
  if (!title) return { error: "Cần nhập tên sách." };
  if (!author) return { error: "Cần nhập tên tác giả." };
  if (!subject) return { error: "Cần nhập chủ đề." };

  const year = Number(formData.get("year") ?? "");
  const pages = Number(formData.get("pages") ?? "");

  return {
    code,
    title,
    author,
    subject,
    publisher: String(formData.get("publisher") ?? "").trim() || null,
    year: Number.isFinite(year) && year > 0 ? Math.floor(year) : null,
    pages: Number.isFinite(pages) && pages > 0 ? Math.floor(pages) : null,
    shelf: String(formData.get("shelf") ?? "").trim() || null,
    keywords: String(formData.get("keywords") ?? "").trim() || null,
    summary: String(formData.get("summary") ?? "").trim() || null,
  };
}