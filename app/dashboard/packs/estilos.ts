/** Estilos de la tienda de packs y de la pagina de cada pack. */
export const CSS_PACKS = `
.pk-shell { max-width: 1320px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 80px; display: flex; flex-direction: column; gap: 20px; }
.pk-grilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); gap: 22px; }
.pk-card { position: relative; display: flex; flex-direction: column; height: 100%; border-radius: 28px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); text-decoration: none; color: inherit; overflow: hidden; transition: transform .35s var(--curva), box-shadow .35s, border-color .25s; }
.pk-card:hover { transform: translateY(-4px); box-shadow: var(--sombra-alta); border-color: var(--pink-line); }
.pk-portada { position: relative; margin: 10px 10px 0; aspect-ratio: 16 / 10; border-radius: 20px; overflow: hidden; background: linear-gradient(135deg, #FFE9DE, #FFDADA); }
.pk-portada img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s var(--curva); }
.pk-card:hover .pk-portada img { transform: scale(1.05); }
.pk-cinta { position: absolute; top: 12px; left: 12px; padding: 5px 12px; border-radius: 99px; font-size: 12px; font-weight: 800; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }
.pk-cinta.es-tuyo { background: var(--pink); color: #fff; }
.pk-cuantas { position: absolute; bottom: 12px; left: 12px; padding: 5px 12px; border-radius: 99px; font-size: 12.5px; font-weight: 800; background: rgba(255,255,255,.94); color: var(--ink); }
.pk-cuerpo { display: flex; flex-direction: column; gap: 8px; padding: 16px 20px 20px; flex: 1; }
.pk-nombre { font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.pk-desc { font-size: 14px; line-height: 1.55; color: var(--muted); flex: 1; }
.pk-pie { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 6px; }
.pk-precio { font-size: 26px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.pk-precio small { font-size: 12.5px; font-weight: 700; color: var(--muted); margin-left: 4px; }
.pk-ver { display: inline-flex; align-items: center; gap: 6px; height: 42px; padding: 0 18px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 13.5px; font-weight: 800; box-shadow: 0 10px 20px -12px rgba(230,79,85,.9); }
.pk-ver.es-suave { background: var(--rubor); color: var(--pink-deep); box-shadow: none; }
.pk-volver { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px 8px 11px; border-radius: 99px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); font-size: 13px; font-weight: 800; color: var(--pink-deep); text-decoration: none; }
.pk-hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 28px; align-items: center; padding: clamp(18px, 2.6vw, 30px); border-radius: 32px; background: linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%); border: 1px solid var(--linea); }
.pk-hero-foto { aspect-ratio: 4 / 3; border-radius: 26px; overflow: hidden; background: linear-gradient(135deg, #FFE9DE, #FFDADA); box-shadow: 0 0 0 6px #fff, var(--sombra-alta); }
.pk-hero-foto img { width: 100%; height: 100%; object-fit: cover; }
.pk-hero-txt { display: flex; flex-direction: column; gap: 12px; }
.pk-eyebrow { align-self: flex-start; padding: 6px 13px; border-radius: 99px; background: #fff; box-shadow: var(--sombra); font-size: 12px; font-weight: 800; color: var(--pink-deep); }
.pk-titulo { margin: 0; font-size: clamp(30px, 4vw, 48px); font-weight: 900; letter-spacing: -0.03em; line-height: 1.05; color: var(--ink); }
.pk-lede { font-size: 15.5px; line-height: 1.65; color: var(--muted); }
.pk-datos { display: flex; flex-wrap: wrap; gap: 8px; }
.pk-dato { padding: 7px 13px; border-radius: 99px; background: #fff; border: 1px solid var(--linea); font-size: 13px; font-weight: 800; color: var(--ink); }
.pk-compra { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; margin-top: 6px; }
.pk-compra .pk-precio { font-size: 36px; }
.pk-tuyo { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; border-radius: 99px; background: var(--pink); color: #fff; font-weight: 800; font-size: 14px; }
.pk-nota { font-size: 12.5px; color: var(--muted); }
.pk-h2 { margin: 6px 0 0; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
.pk-clases { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); gap: 12px; }
.pk-clase { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 20px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); text-decoration: none; color: inherit; transition: transform .3s var(--curva); }
a.pk-clase:hover { transform: translateY(-2px); }
.pk-clase-foto { width: 84px; height: 60px; border-radius: 14px; overflow: hidden; flex-shrink: 0; background: var(--rubor); position: relative; }
.pk-clase-foto img { width: 100%; height: 100%; object-fit: cover; }
.pk-clase-num { position: absolute; top: 5px; left: 5px; width: 22px; height: 22px; border-radius: 50%; background: #fff; color: var(--pink-deep); font-size: 11px; font-weight: 900; display: grid; place-items: center; }
.pk-clase-txt { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.pk-clase-titulo { font-size: 14px; font-weight: 800; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pk-clase-meta { font-size: 12px; color: var(--muted); }
.pk-candado { color: var(--pink-deep); }
.cpk { display: flex; flex-direction: column; gap: 6px; }
.cpk-btn { display: inline-flex; align-items: center; gap: 9px; height: 54px; padding: 0 28px; border-radius: 99px; border: 0; cursor: pointer; font: inherit; font-size: 15.5px; font-weight: 800; background: var(--pink); color: #fff; box-shadow: 0 16px 30px -14px rgba(230,79,85,.9); transition: transform .3s var(--curva), background .2s; }
.cpk-btn:hover { transform: translateY(-2px); background: var(--pink-mid); }
.cpk-btn:disabled { opacity: .7; cursor: default; transform: none; }
.cpk-gira { animation: cpk-gira 1s linear infinite; }
@keyframes cpk-gira { to { transform: rotate(360deg); } }
.cpk-error { font-size: 13px; font-weight: 700; color: var(--pink-deep); }
.pk-sobre { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 14px 32px; padding: 24px 28px; border-radius: 28px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); }
.pk-sobre .pk-h2 { grid-column: 1 / -1; margin: 0; }
.pk-sobre-txt { display: flex; flex-direction: column; gap: 10px; font-size: 15px; line-height: 1.7; color: #5A4440; }
.pk-sobre-datos { list-style: none; margin: 0; padding: 16px 18px; border-radius: 20px; background: var(--crema); display: flex; flex-direction: column; gap: 10px; font-size: 14px; color: var(--muted); }
.pk-sobre-datos li { padding-left: 22px; position: relative; }
.pk-sobre-datos li::before { content: ""; position: absolute; left: 0; top: 6px; width: 10px; height: 10px; border-radius: 50%; background: var(--pink); }
.pk-sobre-datos b { color: var(--ink); }
.pk-clase { align-items: flex-start; }
.pk-clase-titulo { white-space: normal; }
.pk-clase-desc { font-size: 12.5px; line-height: 1.45; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
/* Pack solo para algunos planes (20261009_4). Melocoton y no rojo: no es un
   error, es una condicion; y se ve antes de tocar nada. */
.pk-solo { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 99px; background: #FFF4E8; border: 1px solid #FFE2D3; color: #7A3E24; font-size: 12px; font-weight: 800; }
.pk-solo svg { color: #C25E3A; flex-shrink: 0; }
.pk-cinta.es-candado { display: inline-flex; align-items: center; gap: 5px; background: #FFF4E8; color: #7A3E24; }
.pk-ver.es-plan { background: #fff; color: var(--pink-deep); border: 1.5px solid var(--pink-line); box-shadow: none; }
.pk-bloqueado { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 20px; background: #FFF4E8; border: 1px solid #FFE2D3; }
.pk-bloqueado-txt { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; font-weight: 700; line-height: 1.5; color: #7A3E24; }
.pk-bloqueado-txt svg { flex-shrink: 0; margin-top: 2px; color: #C25E3A; }
.pk-bloqueado-btn { align-self: flex-start; display: inline-flex; align-items: center; gap: 7px; height: 46px; padding: 0 22px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 14.5px; font-weight: 800; text-decoration: none; box-shadow: 0 12px 24px -14px rgba(230,79,85,.9); transition: transform .3s var(--curva), background .2s; }
.pk-bloqueado-btn:hover { transform: translateY(-2px); background: var(--pink-mid); }
@media (max-width: 860px) { .pk-sobre { grid-template-columns: 1fr; padding: 20px; } }
@media (max-width: 860px) { .pk-hero { grid-template-columns: 1fr; } }
`;
