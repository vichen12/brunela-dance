import Link from "next/link";
import { ArrowRight, CalendarDays, User, Video } from "lucide-react";
import { cargarCalendarioAdmin } from "@/src/features/admin/calendario-datos";
import {
  AVISO_SIN_SESIONES_PRIVADAS, agruparPorDia, claveDia, diasDeLaSemana, horaMadrid, nombreDiaCorto,
  rangoConsultaSemana,
} from "@/src/features/admin/calendario";

const MAX_FILAS = 6;

/**
 * "Esta semana" en el resumen de /admin: hoy y los seis dias siguientes, clases
 * en vivo y sesiones privadas juntas, hasta seis filas. Es un componente de
 * SERVIDOR que se carga solo (cargarCalendarioAdmin llama a requireAdmin).
 */
export async function AdminEstaSemana() {
  const hoy = claveDia(Date.now());
  const dias = new Set(diasDeLaSemana(hoy));
  const { desde, hasta } = rangoConsultaSemana(hoy);
  const { eventos, faltaMigracionPrivadas } = await cargarCalendarioAdmin(desde, hasta);

  // Lo cancelado no ocupa lugar en un resumen de siete dias.
  const porDia = agruparPorDia(eventos.filter((e) => e.estado !== "cancelada"), (k) => dias.has(k));
  const filas = [...porDia.entries()].flatMap(([k, lista]) => lista.map((e) => ({ k, e })));
  const visibles = filas.slice(0, MAX_FILAS);
  const resto = filas.length - visibles.length;

  return (
    <section className="aes" aria-label="Esta semana">
      <style>{CSS}</style>
      <header className="aes-cab">
        <span className="aes-ico" aria-hidden="true"><CalendarDays size={18} strokeWidth={2} /></span>
        <h2 className="aes-titulo">Esta semana</h2>
        <Link href={"/admin/calendario" as never} className="aes-ver">
          Ver calendario <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      </header>

      {visibles.length === 0 ? (
        <p className="aes-vacio">Nada agendado en los próximos siete días.</p>
      ) : (
        <ul className="aes-lista">
          {visibles.map(({ k, e }) => (
            <li key={e.tipo + e.id}>
              <Link href={e.href as never} className={"aes-fila es-" + e.tipo + (e.estado ? " es-" + e.estado : "")}>
                <span className="aes-cuando">
                  <span className="aes-dia">{k === hoy ? "Hoy" : nombreDiaCorto(k)}</span>
                  <span className="aes-hora">{horaMadrid(e.inicio)}</span>
                </span>
                <span className="aes-fila-ico" aria-hidden="true">
                  {e.tipo === "privada" ? <User size={15} strokeWidth={2.3} /> : <Video size={15} strokeWidth={2.3} />}
                </span>
                <span className="aes-cuerpo">
                  <span className="aes-nombre">{e.titulo}</span>
                  <span className={"aes-detalle" + (e.alerta ? " es-alerta" : "")}>
                    {e.estado === "borrador" ? "Borrador · " : ""}{e.detalle}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {resto > 0 && (
        <Link href={"/admin/calendario?vista=agenda" as never} className="aes-mas">+{resto} más esta semana</Link>
      )}
      {faltaMigracionPrivadas && <p className="aes-aviso">{AVISO_SIN_SESIONES_PRIVADAS}</p>}
    </section>
  );
}

const CSS = `
.aes { margin-top: 22px; border: 1px solid var(--linea); border-radius: 28px; background: linear-gradient(160deg, #FFF7F3, #fff 50%); box-shadow: var(--sombra); padding: 18px 20px; }
.aes-cab { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.aes-ico { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); flex-shrink: 0; }
.aes-titulo { margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.aes-ver { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 13px; font-weight: 800; text-decoration: none; transition: gap .25s var(--curva), background .2s; }
.aes-ver:hover { gap: 9px; background: var(--melocoton); }
.aes-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.aes-fila { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 16px; background: #fff; border: 1px solid #F6EAE4; border-left: 4px solid var(--pink); color: var(--ink); text-decoration: none; transition: box-shadow .3s, transform .3s var(--curva); }
.aes-fila:hover { box-shadow: var(--sombra); transform: translateY(-1px); }
.aes-fila.es-privada { border-left-color: var(--melocoton-deep); background: linear-gradient(120deg, #FFF4EC, #fff 60%); }
.aes-fila.es-borrador { border-left-style: dashed; }
.aes-fila.es-hecha { opacity: .7; }
.aes-cuando { width: 64px; flex-shrink: 0; display: flex; flex-direction: column; line-height: 1.2; }
.aes-dia { font-size: 11.5px; font-weight: 800; color: var(--muted); text-transform: capitalize; }
.aes-hora { font-size: 14px; font-weight: 900; font-variant-numeric: tabular-nums; }
.aes-fila-ico { width: 30px; height: 30px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center; background: var(--pink-wash); color: var(--pink-deep); }
.aes-fila.es-privada .aes-fila-ico { background: var(--melocoton); color: var(--melocoton-deep); }
.aes-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.aes-nombre { font-size: 14px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aes-detalle { font-size: 12px; font-weight: 600; color: var(--muted); }
.aes-detalle.es-alerta { color: var(--pink-deep); font-weight: 800; }
.aes-vacio { margin: 0; padding: 18px; border-radius: 16px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); font-size: 13.5px; font-weight: 600; color: var(--muted); text-align: center; }
.aes-mas { display: inline-block; margin-top: 10px; font-size: 12.5px; font-weight: 800; color: var(--pink-deep); text-decoration: none; }
.aes-mas:hover { text-decoration: underline; }
.aes-aviso { margin: 10px 0 0; font-size: 12px; font-weight: 600; color: var(--muted); }
@media (max-width: 560px) { .aes { padding: 14px; border-radius: 22px; } .aes-fila-ico { display: none; } }
`;
