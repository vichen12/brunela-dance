import { updateProfileAdminAction } from "@/src/features/admin/actions";
import { getAdminDictionary } from "@/src/features/admin/dictionary";
import { membershipTierOptions, technicalLevelOptions } from "@/src/features/admin/options";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const copy = getAdminDictionary("es");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ProfileRow = {
  id: string;
  email: string;
  membership_tier: "none" | "corps_de_ballet" | "solista" | "principal";
  technical_level: "principiante" | "intermedio" | "avanzado" | "profesional" | "maestro";
  onboarding_completed: boolean;
  is_admin: boolean;
};

function Flash({ message, tone }: { message: string | null; tone: "success" | "error" }) {
  if (!message) return null;
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

export default async function AdminUsersPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, membership_tier, technical_level, onboarding_completed, is_admin")
    .order("created_at", { ascending: false });

  const profiles = (data ?? []) as ProfileRow[];

  return (
    <main className="space-y-6">
      <header className="panel rounded-[36px] p-8 md:p-10">
        <h1 className="display text-4xl">{copy.users.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">{copy.users.description}</p>
      </header>

      <Flash message={success} tone="success" />
      <Flash message={error} tone="error" />

      <section className="panel rounded-[32px] p-8">
        <p className="eyebrow mb-4">{copy.users.listTitle}</p>
        <div className="space-y-6">
          {profiles.length === 0 ? <p className="text-sm text-ink/65">{copy.labels.empty}</p> : null}
          {profiles.map((profile) => (
            <form key={profile.id} action={updateProfileAdminAction} className="grid gap-4 rounded-[28px] border border-black/6 bg-white/76 p-6 md:grid-cols-2">
              <input name="profileId" type="hidden" value={profile.id} />

              <div className="md:col-span-2">
                <p className="font-semibold">{profile.email}</p>
              </div>

              <label className="text-sm font-semibold text-ink">
                {copy.users.form.tier}
                <select className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={profile.membership_tier} name="membershipTier">
                  {membershipTierOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-ink">
                {copy.users.form.level}
                <select className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={profile.technical_level} name="technicalLevel">
                  {technicalLevelOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 text-sm font-semibold text-ink">
                <input defaultChecked={profile.onboarding_completed} name="onboardingCompleted" type="checkbox" />
                {copy.users.form.onboarding}
              </label>

              <label className="flex items-center gap-3 text-sm font-semibold text-ink">
                <input defaultChecked={profile.is_admin} name="isAdmin" type="checkbox" />
                {copy.users.form.admin}
              </label>

              <div className="md:col-span-2">
                <button className="button-primary" type="submit">
                  {copy.users.form.submit}
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
