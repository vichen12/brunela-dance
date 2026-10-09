import { ArrowRight, Lock, MessageCircleHeart } from "lucide-react";
import { requireUser } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { AdminBoton, AdminCabecera } from "@/components/admin-ui";
import { CSS_SESION_PRIVADA, FilaSesionPrivada, TarjetaSesionPrivada } from "@/components/sesion-privada-tarjeta";
import { getMisSesionesPrivadas } from "@/src/features/studio/sesiones-privadas";
import { CUPO_MENSUAL, claveMes, contarDelMes, estadoVisible, proximaDe } from "@/src/features/studio/sesiones-privadas-reglas";

export const dynamic = "force-dynamic";

/**
 * Sus sesiones privadas con Brunela: la proxima en grande, las que siguen, y
 * las anteriores. El plan Principal trae 2 por mes.
 *
 * Sin la migracion 20261009_2 la lista llega vacia (`disponible: false`) y la
 * pantalla muestra el estado vacio: no hay nada roto que explicarle a ella.
 */
export default async function MisSesionesPrivadasPage() {
  const { user } = await requireUser();
  const [profile, { sesiones }] = await Promise.all([getCurrentProfile(user.id), getMisSesionesPrivadas(user.id)]);
  const ahora = Date.now();
  const esPrincipal = profile?.membership_tier === "principal";

  const proxima = proximaDe(sesiones, ahora);
  const siguientes = sesiones.filter((s) => s.id !== proxima?.id && estadoVisible(s, ahora) === "agendada");
  const anteriores = sesiones.filter((s) => estadoVisible(s, ahora) !== "agendada").reverse().slice(0, 20);
  const delMes = contarDelMes(sesiones, claveMes(ahora));

  return (
    <main>
      <style>{CSS_SESION_PRIVADA + CSS}</style>
      <section className="spm">
        <AdminCabecera
          eyebrow="Tu práctica"
          titulo="Sesiones privadas"
          lede={esPrincipal
            ? <>Tu plan Principal trae {CUPO_MENSUAL} sesiones privadas por mes con Brunela, uno a uno. Este mes: <b>{delMes} de {CUPO_MENSUAL}</b>.</>
            : "Tus sesiones uno a uno con Brunela, por Meet o Zoom."}
          acciones={<AdminBoton href="/dashboard/chat"><MessageCircleHeart size={16} strokeWidth={2.2} aria-hidden="true" /> Escribirle a Brunela</AdminBoton>}
        />

        {proxima ? (
          <TarjetaSesionPrivada s={proxima} ahora={ahora} />
        ) : (
          <div className="spm-vacio">
            <span className="spm-vacio-ico" aria-hidden="true"><Lock size={20} strokeWidth={2.2} /></span>
            <div>
              <p className="spm-vacio-titulo">No tenés ninguna sesión privada agendada.</p>
              <p className="spm-vacio-txt">
                {esPrincipal
                  ? "Escribile a Brunela por tu chat para coordinar el día. Cuando la agende, aparece acá con el botón para unirte."
                  : "Cuando Brunela te agende una, aparece acá con el botón para unirte."}
              </p>
            </div>
            <a href="/dashboard/chat" className="spm-vacio-btn">Ir a mi chat <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" /></a>
          </div>
        )}

        {siguientes.length > 0 && (
          <section aria-labelledby="spm-sig" className="spm-bloque">
            <h2 id="spm-sig" className="spm-h2">Después</h2>
            <ul className="spt-lista">
              {siguientes.map((s) => <FilaSesionPrivada key={s.id} s={s} estado="agendada" ahora={ahora} />)}
            </ul>
          </section>
        )}

        {anteriores.length > 0 && (
          <section aria-labelledby="spm-ant" className="spm-bloque">
            <h2 id="spm-ant" className="spm-h2">Anteriores</h2>
            <ul className="spt-lista">
              {anteriores.map((s) => <FilaSesionPrivada key={s.id} s={s} estado={estadoVisible(s, ahora)} ahora={ahora} />)}
            </ul>
          </section>
        )}
      </section>
    </main>
  );
}

const CSS = `
.spm { max-width: 1100px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 80px; display: flex; flex-direction: column; gap: 20px; }
.spm-bloque { display: flex; flex-direction: column; gap: 10px; }
.spm-h2 { font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.spm-vacio { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 20px; border-radius: 26px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); }
.spm-vacio-ico { width: 44px; height: 44px; border-radius: 15px; display: grid; place-items: center; background: #FFF4E8; color: var(--melocoton-deep); flex-shrink: 0; }
.spm-vacio > div { flex: 1 1 240px; }
.spm-vacio-titulo { font-size: 16px; font-weight: 900; color: var(--ink); }
.spm-vacio-txt { margin-top: 2px; font-size: 13.5px; line-height: 1.55; color: var(--muted); }
.spm-vacio-btn { display: inline-flex; align-items: center; gap: 6px; height: 42px; padding: 0 16px; border-radius: 99px; background: #fff; border: 1.5px solid var(--linea-fuerte); color: var(--ink); font-size: 13.5px; font-weight: 800; text-decoration: none; }
.spm-vacio-btn:hover { background: var(--rubor); border-color: var(--pink-line); }
`;
