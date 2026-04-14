import { upsertSiteSettingAction } from "@/src/features/admin/actions";
import { getAdminDictionary } from "@/src/features/admin/dictionary";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const copy = getAdminDictionary("es");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type SiteSetting = {
  setting_key: string;
  category: string;
  description: string | null;
  is_public: boolean;
  value: unknown;
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

export default async function AdminSettingsPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  const { data } = await supabase.from("site_settings").select("setting_key, category, description, is_public, value").order("category");
  const settings = (data ?? []) as SiteSetting[];

  return (
    <main className="space-y-6">
      <header className="panel rounded-[36px] p-8 md:p-10">
        <h1 className="display text-4xl">{copy.settings.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">{copy.settings.description}</p>
      </header>

      <Flash message={success} tone="success" />
      <Flash message={error} tone="error" />

      <section className="panel rounded-[32px] p-8">
        <p className="eyebrow mb-4">{copy.settings.newTitle}</p>
        <SettingForm actionLabel={copy.settings.form.submitCreate} />
      </section>

      <section className="panel rounded-[32px] p-8">
        <p className="eyebrow mb-4">{copy.settings.listTitle}</p>
        <div className="space-y-6">
          {settings.length === 0 ? <p className="text-sm text-ink/65">{copy.labels.empty}</p> : null}
          {settings.map((setting) => (
            <div key={setting.setting_key} className="rounded-[28px] border border-black/6 bg-white/76 p-6">
              <SettingForm actionLabel={copy.settings.form.submitUpdate} setting={setting} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function SettingForm({ actionLabel, setting }: { actionLabel: string; setting?: SiteSetting }) {
  return (
    <form action={upsertSiteSettingAction} className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-semibold text-ink">
        {copy.settings.form.key}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={setting?.setting_key ?? ""} name="settingKey" required />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.settings.form.category}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={setting?.category ?? ""} name="category" required />
      </label>

      <label className="text-sm font-semibold text-ink md:col-span-2">
        {copy.settings.form.description}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={setting?.description ?? ""} name="description" />
      </label>

      <label className="flex items-center gap-3 text-sm font-semibold text-ink md:col-span-2">
        <input defaultChecked={setting?.is_public ?? false} name="isPublic" type="checkbox" />
        {copy.settings.form.public}
      </label>

      <label className="text-sm font-semibold text-ink md:col-span-2">
        {copy.settings.form.value}
        <textarea className="mt-2 min-h-40 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 font-mono text-sm" defaultValue={JSON.stringify(setting?.value ?? {}, null, 2)} name="value" required />
      </label>

      <div className="md:col-span-2">
        <button className="button-primary" type="submit">
          {actionLabel}
        </button>
      </div>
    </form>
  );
}
