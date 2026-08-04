"use client";

import { useFormStatus } from "react-dom";

/**
 * Boton de envio que avisa que esta trabajando.
 *
 * POR QUE useFormStatus Y NO useTransition
 *   Estos formularios usan `<form action={serverAction}>`. useFormStatus lee el
 *   estado del formulario padre sin que la action cambie ni una linea y sin
 *   convertir la pagina en cliente. useTransition obligaria a envolver cada
 *   envio a mano en los 45 formularios.
 *
 *   La unica regla es que este componente tiene que estar DENTRO del <form>:
 *   el hook lee el contexto del formulario que lo contiene. Puesto afuera
 *   devuelve pending=false para siempre y no avisa nunca -- falla en silencio.
 *
 * POR QUE IMPORTA
 *   Sin esto, entre que se hace clic y que el servidor contesta no pasa
 *   absolutamente nada en pantalla. Con una conexion lenta eso se lee como que
 *   el boton no anduvo, y la reaccion natural es volver a apretarlo: dos salas
 *   creadas, dos anuncios publicados.
 *
 *   `disabled` mientras esta pendiente es la mitad importante de este
 *   componente, no un detalle estetico.
 */
export function BotonEnviar({
  children,
  pendingLabel,
  style,
  className,
  formAction,
  name,
  value,
}: {
  children: React.ReactNode;
  /** Que decir mientras trabaja. Por defecto, "Guardando...". */
  pendingLabel?: string;
  style?: React.CSSProperties;
  className?: string;
  /**
   * Otra action distinta a la del <form>. Es como estan hechos los botones de
   * ELIMINAR: el formulario guarda y el boton borra. `useFormStatus` igual
   * reporta pendiente, porque el estado es del formulario y no del boton.
   */
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      formAction={formAction}
      name={name}
      value={value}
      style={{
        cursor: pending ? "progress" : "pointer",
        opacity: pending ? 0.65 : 1,
        transition: "opacity 140ms ease",
        ...style,
      }}
    >
      {pending ? (pendingLabel ?? "Guardando…") : children}
    </button>
  );
}
