import Link from "next/link";
import Image from "next/image";

/**
 * "No encontrado" con la marca y en castellano (2026-11-12). Antes salia la
 * pagina por defecto de Next: blanca y en ingles ("This page could not be
 * found"), justo la que ve quien abre un link viejo o mal copiado.
 */
export default function NoEncontrado() {
  return (
    <main className="ne">
      <style>{CSS}</style>
      <Link href="/" aria-label="Brunela Dance Trainer, inicio">
        <Image src="/brand/isologo-color.png" alt="" width={72} height={72} priority />
      </Link>
      <p className="ne-eti">Página no encontrada</p>
      <h1 className="ne-tit">Esta página no existe</h1>
      <p className="ne-sub">Puede que el enlace esté mal copiado o que ya no esté disponible. Desde acá seguís sin perderte nada.</p>
      <div className="ne-acciones">
        <Link href="/dashboard" className="ne-btn">Ir a mis clases</Link>
        <Link href="/" className="ne-btn ne-btn--suave">Ir al inicio</Link>
      </div>
    </main>
  );
}

const CSS = `
.ne { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 32px 20px; text-align: center; background: radial-gradient(700px 360px at 50% 0%, #FFE9E3, transparent 70%), #FFFCFA; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #2D1520; }
.ne-eti { margin: 10px 0 0; padding: 5px 14px; border-radius: 99px; background: #fff; box-shadow: 0 10px 24px -16px rgba(139,26,46,.4); font-size: 12.5px; font-weight: 800; color: #C8384D; }
.ne-tit { margin: 0; font-family: "Cormorant Garamond", Georgia, serif; font-weight: 500; font-size: clamp(34px, 6vw, 52px); line-height: 1.05; }
.ne-sub { margin: 0; max-width: 440px; font-size: 15.5px; line-height: 1.6; color: #7D5060; }
.ne-acciones { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 10px; }
.ne-btn { min-height: 48px; padding: 0 24px; display: inline-flex; align-items: center; border-radius: 99px; background: #E64F55; color: #fff; font-weight: 800; font-size: 15px; text-decoration: none; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.ne-btn--suave { background: #fff; color: #C8384D; border: 1.5px solid #F0C9C9; box-shadow: none; }
`;
