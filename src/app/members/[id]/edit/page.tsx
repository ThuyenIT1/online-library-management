import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { getMember } from "@/lib/api";
import { MemberForm } from "@/app/members/new/member-form";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const member = await getMember(id);
  if (!member) notFound();

  return (
    <AppShell>
      <PageHead
        title={`Sửa hồ sơ — ${member.name}`}
        meta={`Thẻ ${member.code} · ${member.tier}`}
      />
      <MemberForm member={member} mode="edit" />
    </AppShell>
  );
}
