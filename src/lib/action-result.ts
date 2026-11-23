/**
 * Kiểu dữ liệu dùng chung cho Server Actions.
 *
 * File này cố ý KHÔNG có "use server": một module "use server" chỉ được
 * export các hàm async, nên hằng số và kiểu dữ liệu phải nằm ở đây.
 */

export type ActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  /** Mã bản ghi vừa tạo, dùng để chuyển hướng sau khi lưu. */
  id?: string;
};

/**
 * Trạng thái rỗng dùng làm giá trị ban đầu cho useActionState.
 *
 * `ok` là false vì chưa có thao tác nào thành công, nhưng `message` rỗng để
 * phân biệt "chưa báo lỗi" với "báo lỗi nhưng không có nội dung".
 * Hãy dùng `hasError()` để kiểm tra lỗi, đừng so sánh `!state.ok` trực tiếp.
 */
export const EMPTY_RESULT: ActionResult = { ok: false, message: "" };

/**
 * Có đang hiển thị được một thông báo lỗi hay không.
 *
 * Phải yêu cầu `message` khác rỗng, vì trạng thái ban đầu cũng có `ok: false`.
 * Nếu chỉ kiểm tra `!state.ok`, hộp lỗi rỗng sẽ hiện ngay khi vừa tải trang.
 *
 * Hàm cố tình KHÔNG dùng type predicate: `ActionResult` không phải union
 * phân biệt nên nhánh "sai" sẽ bị thu hẹp thành `never`, khiến
 * `state.message` không hợp lệ trong nhánh đó.
 */
export function hasError(state: ActionResult | null | undefined): boolean {
  return Boolean(state && !state.ok && state.message);
}

/** Thao tác vừa thành công. */
export function isSuccess(state: ActionResult | null | undefined): boolean {
  return Boolean(state && state.ok);
}
