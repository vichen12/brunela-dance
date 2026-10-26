import { FinDeOferta } from "@/components/fin-de-oferta";
import { porcentajeDeDescuento, type OfertaPack } from "@/src/features/studio/ofertas";

/**
 * El precio de un pack, con la oferta si hay: el normal tachado, el de oferta,
 * el porcentaje y la cuenta regresiva. Sin oferta, el precio a secas.
 *
 * Sin "use client" a proposito: lo usan pantallas de servidor (tienda, ficha
 * del pack, portada) y de cliente (Mi plan). La cuenta regresiva, que si
 * necesita el navegador, es su propio componente.
 * Estilos en globals.css (.po-*).
 */
function formato(centimos: number, moneda: string) {
  return `${(centimos / 100).toLocaleString("es-ES", { minimumFractionDigits: centimos % 100 === 0 ? 0 : 2 })} ${moneda.toUpperCase() === "EUR" ? "€" : moneda.toUpperCase()}`;
}

export function PrecioConOferta({
  centimos, moneda, oferta, conCuenta = true,
}: {
  centimos: number;
  moneda: string;
  oferta?: OfertaPack | null;
  conCuenta?: boolean;
}) {
  if (!oferta) return <>{formato(centimos, moneda)}</>;
  return (
    <span className="po">
      <span className="po-fila">
        <s className="po-antes" aria-label={`Antes ${formato(centimos, moneda)}`}>{formato(centimos, moneda)}</s>
        <span className="po-ahora">{formato(oferta.precioCentimos, moneda)}</span>
        <span className="po-pct">-{porcentajeDeDescuento(centimos, oferta.precioCentimos)}%</span>
      </span>
      {conCuenta && <FinDeOferta hasta={oferta.hasta} className="po-fin" />}
    </span>
  );
}
