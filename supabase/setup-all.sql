-- ===========================================================================
-- Số Mượn — Cài đặt toên bộ
--
-- Cách dùng: mở trang SQL Editor trong Supabase Dashboard,
-- dán TOÀN BỘ file này, bấm Run.
-- File này an toàn khi chạy lại nhiều lần.
-- ===========================================================================

-- ===========================================================================
-- PHẦN 1: SCHEMA (bảng, chỉ mục, view, RLS)
-- ===========================================================================

-- ===========================================================================
-- Sổ Mượn — schema quản lý thư viện
-- Chạy trên Supabase Postgres.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- 1. Bảng
-- ---------------------------------------------------------------------------

-- Hội viên: hồ sơ thẻ đọc, tách khỏi auth.users vì thẻ có thể cấp trước khi
-- người dùng tự đăng ký tài khoản trực tuyến.
create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  card_code     text not null unique,
  full_name     text not null,
  email         citext,
  phone         text,
  tier          text not null default 'Thường'
                check (tier in ('Thường', 'Vàng', 'Đọc tại chỗ')),
  max_books     integer not null default 5 check (max_books >= 0),
  joined_on     date not null default current_date,
  expires_on    date not null,
  status        text not null default 'active'
                check (status in ('active', 'suspended')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists members_name_idx  on public.members (full_name);
create index if not exists members_expires_idx on public.members (expires_on);

-- Sách: hồ sơ đầu sách, số bản vật lý ghi riêng ở book_copies.
create table if not exists public.books (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  title         text not null,
  author        text not null,
  subject       text not null,
  publisher     text,
  publish_year  integer,
  page_count    integer,
  shelf         text,
  keywords      text,
  summary       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists books_title_idx   on public.books (title);
create index if not exists books_subject_idx on public.books (subject);

-- Bản vật lý: mỗi dòng là một cuốn có thể cho mượn.
create table if not exists public.book_copies (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books (id) on delete cascade,
  copy_label    text not null,
  acquired_on   date,
  condition     text not null default 'Tốt'
                check (condition in ('Tốt', 'Khá', 'Hư cần sửa', 'Hư')),
  unique (book_id, copy_label)
);

create index if not exists book_copies_book_idx on public.book_copies (book_id);

-- Phiếu mượn.
create table if not exists public.loans (
  id            uuid primary key default gen_random_uuid(),
  receipt_code  text not null unique,
  book_id       uuid not null references public.books (id),
  copy_id       uuid references public.book_copies (id),
  member_id     uuid not null references public.members (id),
  borrowed_on   date not null default current_date,
  due_on        date not null,
  returned_on   date,
  fine_amount   integer not null default 0 check (fine_amount >= 0),
  note          text,
  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Một bản vật lý chỉ nằm trong một phiếu chưa trả tại một thời điểm.
-- Postgres không cho ràng buộc UNIQUE kèm điều kiện, nên dùng partial unique index.
create unique index if not exists one_open_loan_per_copy
  on public.loans (copy_id)
  where returned_on is null;

create index if not exists loans_member_idx on public.loans (member_id);
create index if not exists loans_book_idx   on public.loans (book_id);
create index if not exists loans_due_idx    on public.loans (due_on)
  where returned_on is null;

-- Đặt trước.
create table if not exists public.reservations (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  reserved_on   date not null default current_date,
  status        text not null default 'waiting'
                check (status in ('waiting', 'ready', 'picked_up', 'cancelled')),
  created_at    timestamptz not null default now(),
  unique (book_id, member_id, status)
);

-- Thu phí trễ hạn.
create table if not exists public.fines (
  id            uuid primary key default gen_random_uuid(),
  loan_id       uuid references public.loans (id) on delete cascade,
  member_id     uuid not null references public.members (id),
  days_late     integer not null default 0 check (days_late >= 0),
  amount        integer not null default 0 check (amount >= 0),
  paid          boolean not null default false,
  paid_on       date,
  created_at    timestamptz not null default now()
);

create index if not exists fines_member_idx on public.fines (member_id);

-- Nhật ký thao tác, phục vụ đối chiếu khi có khiếu nại.
create table if not exists public.audit_log (
  id            bigint generated always as identity primary key,
  actor_id      uuid references auth.users (id),
  action        text not null,
  entity        text not null,
  entity_id     text,
  detail        jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Cấu hình thư viện (bảng 1 dòng)
-- ---------------------------------------------------------------------------

create table if not exists public.library_settings (
  id                boolean primary key default true check (id),
  name              text not null default 'Thư viện Trung tâm',
  loan_days         integer not null default 14 check (loan_days > 0),
  fine_per_day      integer not null default 17000 check (fine_per_day >= 0),
  max_renewals      integer not null default 1 check (max_renewals >= 0),
  updated_at        timestamptz not null default now()
);

insert into public.library_settings (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Hàm dùng chung
-- ---------------------------------------------------------------------------

-- Ngày hiện tại của thư viện. Cho phép override để test và để tính tới hạn.
create or replace function public.library_today()
returns date
language sql
stable
as $$ select current_date $$;

-- Số ngày trễ so với hôm nay, tối đa 0.
create or replace function public.days_late(due_on date)
returns integer
language sql
immutable
as $$
  select greatest(0, (public.library_today() - due_on)::integer)
$$;

-- Tự cập nhật updated_at.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_touch on public.members;
create trigger members_touch before update on public.members
  for each row execute function public.touch_updated_at();

drop trigger if exists books_touch on public.books;
create trigger books_touch before update on public.books
  for each row execute function public.touch_updated_at();

drop trigger if exists loans_touch on public.loans;
create trigger loans_touch before update on public.loans
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. View đọc: số bản sẵn có, số đang mượn
-- ---------------------------------------------------------------------------

create or replace view public.book_stock as
select
  b.id,
  b.code,
  b.title,
  b.author,
  b.subject,
  b.publisher,
  b.publish_year,
  b.page_count,
  b.shelf,
  b.keywords,
  b.summary,
  count(c.id)::int                          as total_copies,
  count(c.id) filter (where l.id is null)::int as available_copies
from public.books b
left join public.book_copies c on c.book_id = b.id
left join public.loans l
  on l.copy_id = c.id and l.returned_on is null
group by b.id;

-- ---------------------------------------------------------------------------
-- 5. RLS: chỉ thủ thư đã đăng nhập mới được truy cập
--    Tài khoản thường (đọc tại chỗ) không có quyền.
-- ---------------------------------------------------------------------------

alter table public.members          enable row level security;
alter table public.books            enable row level security;
alter table public.book_copies      enable row level security;
alter table public.loans            enable row level security;
alter table public.reservations     enable row level security;
alter table public.fines            enable row level security;
alter table public.audit_log        enable row level security;
alter table public.library_settings enable row level security;

create or replace function public.is_librarian()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and raw_app_meta_data ->> 'role' = 'librarian'
  )
$$;

grant execute on function public.is_librarian() to authenticated;

-- Thủ thư: toàn quyền trên bảng nghiệp vụ.
do $$
declare t text;
begin
  foreach t in array array[
    'members', 'books', 'book_copies', 'loans',
    'reservations', 'fines', 'audit_log', 'library_settings'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_librarian_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_librarian()) with check (public.is_librarian())',
      t || '_librarian_all', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Nối backend Supabase (REST), bảng cần đưa vào publication
-- ---------------------------------------------------------------------------

-- Cho phép chạy lại script nhiều lần mà không báo lỗi publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'loans'
  ) then
    alter publication supabase_realtime add table public.loans;
  end if;
end $$;


-- ===========================================================================
-- PHầN 2: DḎ LIệU MẪU (sách, bản vật lý, hội viên, phiếu mượn)
-- ===========================================================================

-- ===========================================================================
-- Dữ liệu mẫu, khớp với mock data ở prototype/
-- Chạy sau 202611150001_init_library.sql
-- ===========================================================================

-- --- Cấu hình ---
update public.library_settings
set name = 'Thư viện Trung tâm',
    loan_days = 14,
    fine_per_day = 17000,
    max_renewals = 1
where id = true;

-- --- Sách ---
insert into public.books (id, code, title, author, subject, publisher, publish_year, page_count, shelf, keywords, summary)
values
('11111111-1111-4111-8111-000000000001', '8432-B', 'Bên kia sông', 'Nguyễn Quang Thiều', 'Văn học', 'NXB Văn học', 1987, 312, 'Khoang 3, tầng 2', 'chiến tranh, nông thôn, đời thường',
 'Câu chuyện bắt đầu từ một ngôi làng ven sông, nơi người dân sống bằng nghề làm ruộng và đánh cá. Tác giả đưa người đọc đi qua mùa lũ, mùa đói, và những đổi thay của một gia đình bình thường trong ba thế hệ. Văn phong giản dị, giàu chất thơ, với những đoạn tả cảnh sông và đồng lúa được viết bằng ngôn ngữ miền trung. Đây là tác phẩm tiêu biểu của dòng văn học miền Nam thập niên 1980.'),

('11111111-1111-4111-8111-000000000002', '1913-D', 'Nhà giả kim', 'Paulo Coelho', 'Văn học', 'NXB Lao động', 1994, 208, 'Khoang 3, tầng 2', 'hành trình, giấc mơ, số phận',
 'Cậu bé Santiago nghề nghiệp trẻ tìm được một cuốn sách cổ, trong đó có bí mật về vận mệnh. Cuốn sách dẫn cậu đi qua Tây Ban Nha, chợ tang, sa mạc Sahara, nơi cậu gặp những người thay đổi cách nhìn về cuộc đời. Tác phẩm được dịch ra hơn 80 ngôn ngữ, nằm trong nhóm bán chạy nhất mọi thời đại.'),

('11111111-1111-4111-8111-000000000003', '2001-A', 'Vườn thu', 'Nguyễn Ngọc Tư', 'Văn học', 'NXB Văn học', 1965, 186, 'Khoang 1, tầng 1', 'nông thôn, tình yêu, xã hội',
 'Truyện ngắn về cuộc đời của cô Hà, một nữ công nhân ở nông trường. Cả tác phẩm được viết bằng giọng văn trong trẻ o, tràn đầy sự tử tế, với những mối quan hệ giản dị mà sâu lắng giữa người lao động nông nghiệp và cán bộ công nhân.'),

('11111111-1111-4111-8111-000000000004', '4471-E', 'Chuyện của thiên tài', 'Hector Malot', 'Thiếu nhi', 'NXB Kim Đồng', 1984, 340, 'Khoang 7, tầng 3', 'trẻ em, nghèo khó, hy vọng',
 'Cậu bé Rémi bị bỏ rơi ở ngoại ô Paris, phải tự kiếm ăn và học cách sống giữa những người xa lạ. Câu chuyện xoay quanh tình yêu thương gia đình, tình bạn và sự kiên trì trong những hoàn cảnh khắc nghiệt.'),

('11111111-1111-4111-8111-000000000005', '1556-C', 'Sơn Tặng', 'Vũ Hoàng Chương', 'Văn học', 'NXB Văn học', 1989, 224, 'Khoang 3, tầng 2', 'đô thị, văn minh, xung đột',
 'Một tác phẩm về không gian đô thị Hà Nội những năm 1980, nơi những giá trị truyền thống va chạm với nhịp sống mới. Văn phong sắc bén, giàu chất thơ và đầy tính thời sự.'),

('11111111-1111-4111-8111-000000000006', '7412-F', 'Tôi thấy hoa vàng trên cỏ xanh', 'Nguyễn Ngọc Tư', 'Văn học', 'NXB Văn học', 1976, 272, 'Khoang 1, tầng 1', 'học sinh, tình bạn, thành phố',
 'Chuyện của những đứa học sinh làng quê vào thành phố học, xa nhà lần đầu tiên. Những nỗi nhớ, nỗi buồn tách lìa và những tình bạn mới nối lên từ năm tháng thành phố.'),

('11111111-1111-4111-8111-000000000007', '5120-B', 'Lề thơ', 'Trần Dần', 'Văn học', 'NXB Văn học', 1991, 198, 'Khoang 3, tầng 2', 'hiện đại, trải nghiệm, đời sống',
 'Tập truyện ngắn về những nhân vật đang tìm chỗ đứng trong đời sống đô thị mới. Văn phong gọn, nhiều chi tiết bất ngờ, đôi khi gay gắt.'),

('11111111-1111-4111-8111-000000000008', '6308-A', 'Đại vệ chí dịch', 'Hà Giang', 'Lịch sử', 'NXB Đại học Quốc gia', 1998, 420, 'Khoang 7, tầng 3', 'lịch sử, ngoại giao, thế kỷ 19',
 'Ghi chép về hoạt động ngoại giao Việt Nam trong bối cảnh thế giới thế kỷ 19, khi mọi thứ đang định hình lại. Cuốn sách dựa trên nhiều tư liệu lưu trữ chưa được công bố.'),

('11111111-1111-4111-8111-000000000009', '3087-C', 'Cho tôi mượn một lần', 'Hà Giang', 'Văn học', 'NXB Văn học', 2001, 176, 'Khoang 3, tầng 2', 'đô thị, cô đơn, ký ức',
 'Những mảnh trải rời về cuộc sống của những người trẻ ở một thành phố đang thay đổi nhanh. Mỗi chuyện là một khoảnh khắc nhỏ soi ra một đời sống lớn.'),

('11111111-1111-4111-8111-000000000010', '9215-D', 'Tắt đèn', 'Nguyễn Quang Thiều', 'Văn học', 'NXB Văn học', 1992, 158, 'Khoang 1, tầng 1', 'làng quê, đời sống, thay đổi',
 'Trong một đêm mất điện ở ngôi làng, mười mấy người kể lại những chuyện của cuộc đời mình. Cuốn sách nhỏ nhưng nặng trĩu tình.')
on conflict (id) do nothing;

-- --- Bản vật lý ---
-- Số bản mỗi đầu sách chọn để "số bản sẵn có" khớp với prototype:
--   Bên kia sông 1 (0 sẵn có), Nhà giả kim 2 (1), Vườn thu 8 (7),
--   Chuyện của thiên tài 4 (3), Sơn Tặng 3 (2), Tôi thấy hoa vàng 5 (4),
--   Lề thơ 7 (6), Đại vệ chí dịch 6 (5), Cho tôi mượn 2 (1), Tắt đèn 10 (9).
insert into public.book_copies (id, book_id, copy_label, acquired_on, condition)
select
  (('22222222-2222-4222-8222-' || lpad((row_number() over ())::text, 12, '0'))::uuid),
  c.book_id,
  'A' || g.n,
  date '2024-01-15',
  'Tốt'
from (values
  ('11111111-1111-4111-8111-000000000001'::uuid, 1),
  ('11111111-1111-4111-8111-000000000002'::uuid, 2),
  ('11111111-1111-4111-8111-000000000003'::uuid, 8),
  ('11111111-1111-4111-8111-000000000004'::uuid, 4),
  ('11111111-1111-4111-8111-000000000005'::uuid, 3),
  ('11111111-1111-4111-8111-000000000006'::uuid, 5),
  ('11111111-1111-4111-8111-000000000007'::uuid, 7),
  ('11111111-1111-4111-8111-000000000008'::uuid, 6),
  ('11111111-1111-4111-8111-000000000009'::uuid, 2),
  ('11111111-1111-4111-8111-000000000010'::uuid, 10)
) as c(book_id, copies)
cross join lateral generate_series(1, c.copies) as g(n)
on conflict do nothing;

-- --- Hội viên ---
insert into public.members (id, card_code, full_name, email, phone, tier, max_books, joined_on, expires_on, status)
values
('55555555-5555-4555-8555-000000000001', '0382', 'Trần Minh Quân', 'quan.tm@example.com', '090 214 5566', 'Thường', 5, date '2024-04-30', date '2027-04-30', 'active'),
('55555555-5555-4555-8555-000000000002', '1904', 'Nguyễn Thị Lan', 'lan.nt@example.com', '091 883 2210', 'Thường', 5, date '2023-11-30', date '2026-11-30', 'active'),
('55555555-5555-4555-8555-000000000003', '0557', 'Lê Thu Hà', 'ha.lt@example.com', '098 445 1102', 'Vàng', 8, date '2024-08-12', date '2027-08-12', 'active'),
('55555555-5555-4555-8555-000000000004', '2011', 'Phạm Anh Khoa', 'khoa.pa@example.com', '093 776 8890', 'Thường', 5, date '2024-12-08', date '2026-12-08', 'active'),
('55555555-5555-4555-8555-000000000005', '1663', 'Vũ Mai Chi', 'chi.vm@example.com', '035 220 7714', 'Đọc tại chỗ', 0, date '2025-01-22', date '2027-01-22', 'active'),
('55555555-5555-4555-8555-000000000006', '2448', 'Hoàng Gia Bảo', 'bao.hg@example.com', '089 112 3345', 'Thường', 5, date '2025-03-05', date '2027-03-05', 'active'),
('55555555-5555-4555-8555-000000000007', '0876', 'Nguyễn Văn Hùng', 'hung.nv@example.com', '096 634 5521', 'Thường', 5, date '2024-09-17', date '2026-09-17', 'active'),
('55555555-5555-4555-8555-000000000008', '1229', 'Đỗ Thu Trang', 'trang.dt@example.com', '090 998 4471', 'Vàng', 8, date '2024-12-14', date '2026-12-14', 'active')
on conflict (id) do nothing;

-- --- Phiếu mượn ---
-- Bản vật lý được tham chiếu bằng (book_id, copy_label).
insert into public.loans (id, receipt_code, book_id, copy_id, member_id, borrowed_on, due_on, returned_on, fine_amount)
select
  (('66666666-6666-4666-8666-' || lpad((row_number() over ())::text, 12, '0'))::uuid),
  v.receipt_code,
  v.book_id,
  (select c.id from public.book_copies c
     where c.book_id = v.book_id and c.copy_label = v.copy_label),
  v.member_id,
  v.borrowed_on,
  v.due_on,
  v.returned_on,
  v.fine_amount
from (values
  -- Đang mượn, trễ hạn
  ('PM-2026-1026-084', '11111111-1111-4111-8111-000000000002'::uuid, 'A1', '55555555-5555-4555-8555-000000000001'::uuid, date '2026-10-26', date '2026-11-09', null::date, 102000),
  ('PM-2026-1021-117', '11111111-1111-4111-8111-000000000001'::uuid, 'A1', '55555555-5555-4555-8555-000000000007'::uuid, date '2026-10-21', date '2026-11-04', null::date, 187000),
  -- Đang mượn, còn hạn
  ('PM-2026-1108-203', '11111111-1111-4111-8111-000000000003'::uuid, 'A2', '55555555-5555-4555-8555-000000000004'::uuid, date '2026-11-04', date '2026-11-18', null::date, 0),
  ('PM-2026-1106-244', '11111111-1111-4111-8111-000000000004'::uuid, 'A3', '55555555-5555-4555-8555-000000000008'::uuid, date '2026-11-06', date '2026-11-24', null::date, 0),
  ('PM-2026-1108-271', '11111111-1111-4111-8111-000000000005'::uuid, 'A1', '55555555-5555-4555-8555-000000000002'::uuid, date '2026-11-08', date '2026-11-26', null::date, 0),
  ('PM-2026-1109-289', '11111111-1111-4111-8111-000000000006'::uuid, 'A4', '55555555-5555-4555-8555-000000000006'::uuid, date '2026-11-09', date '2026-11-27', null::date, 0),
  ('PM-2026-1105-302', '11111111-1111-4111-8111-000000000007'::uuid, 'A1', '55555555-5555-4555-8555-000000000003'::uuid, date '2026-11-05', date '2026-11-19', null::date, 0),
  ('PM-2026-1110-310', '11111111-1111-4111-8111-000000000008'::uuid, 'A1', '55555555-5555-4555-8555-000000000003'::uuid, date '2026-11-10', date '2026-11-24', null::date, 0),
  ('PM-2026-1106-322', '11111111-1111-4111-8111-000000000010'::uuid, 'A1', '55555555-5555-4555-8555-000000000007'::uuid, date '2026-11-06', date '2026-11-20', null::date, 0),
  ('PM-2026-1109-330', '11111111-1111-4111-8111-000000000009'::uuid, 'A1', '55555555-5555-4555-8555-000000000008'::uuid, date '2026-11-09', date '2026-11-23', null::date, 0),
  -- Đã trả
  ('PM-2026-1101-215', '11111111-1111-4111-8111-000000000003'::uuid, 'A1', '55555555-5555-4555-8555-000000000002'::uuid, date '2026-11-01', date '2026-11-15', date '2026-11-12', 0),
  ('PM-2026-1028-176', '11111111-1111-4111-8111-000000000002'::uuid, 'A2', '55555555-5555-4555-8555-000000000008'::uuid, date '2026-10-28', date '2026-11-11', date '2026-11-13', 34000)
) as v(receipt_code, book_id, copy_label, member_id, borrowed_on, due_on, returned_on, fine_amount)
on conflict do nothing;

-- --- Đặt trước ---
insert into public.reservations (id, book_id, member_id, reserved_on, status)
values
('88888888-8888-4888-8888-000000000001', '11111111-1111-4111-8111-000000000001', '55555555-5555-4555-8555-000000000004', date '2026-11-10', 'waiting'),
('88888888-8888-4888-8888-000000000002', '11111111-1111-4111-8111-000000000002', '55555555-5555-4555-8555-000000000008', date '2026-11-11', 'waiting'),
('88888888-8888-4888-8888-000000000003', '11111111-1111-4111-8111-000000000001', '55555555-5555-4555-8555-000000000002', date '2026-11-12', 'waiting')
on conflict (id) do nothing;

-- --- Phí trễ hạn ---
-- Dùng id cố định để chạy lại script không nhân bản dòng.
-- Gắn loan_id với phiếu tương ứng để thủ thư thu phí đúng khoản nợ.
insert into public.fines (id, loan_id, member_id, days_late, amount, paid)
select f.id, l.id, f.member_id, f.days_late, f.amount, f.paid
from (values
  ('77777777-7777-4777-8777-000000000001'::uuid, 'PM-2026-1021-117', '55555555-5555-4555-8555-000000000007'::uuid, 11, 187000, false),
  ('77777777-7777-4777-8777-000000000002'::uuid, 'PM-2026-1026-084', '55555555-5555-4555-8555-000000000001'::uuid, 6, 102000, false),
  ('77777777-7777-4777-8777-000000000003'::uuid, 'PM-2026-1028-176', '55555555-5555-4555-8555-000000000008'::uuid, 2, 34000, false)
) as f(id, receipt_code, member_id, days_late, amount, paid)
join public.loans l on l.receipt_code = f.receipt_code
on conflict (id) do nothing;

-- Gắn lại các dòng phí đã có từ lần chạy script trước (loan_id còn null),
-- để không tính trùng với khoản nợ của phiếu đang mượn.
update public.fines f
set loan_id = l.id
from public.loans l
where f.loan_id is null
  and l.receipt_code = case f.amount
    when 187000 then 'PM-2026-1021-117'
    when 102000 then 'PM-2026-1026-084'
    when 34000  then 'PM-2026-1028-176'
  end;
