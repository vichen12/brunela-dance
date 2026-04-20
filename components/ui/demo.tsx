import { ModernPricingPage, PricingCardProps } from "@/components/ui/animated-glassy-pricing";

const myPricingPlans: PricingCardProps[] = [
  {
    planName: "Corps de Ballet",
    description: "Entrada ideal para una practica constante y bien ordenada.",
    price: "19",
    features: ["Biblioteca base", "Filtros por foco", "Continuidad de clase"],
    buttonText: "Elegir Corps",
    buttonVariant: "secondary",
    href: "/sign-in"
  },
  {
    planName: "Solista",
    description: "La opcion mas equilibrada para entrenar con programas y mas guia.",
    price: "39",
    features: ["Todo lo de Corps", "Programas guiados", "Checkpoints de progreso", "Mas profundidad tecnica"],
    buttonText: "Elegir Solista",
    isPopular: true,
    buttonVariant: "primary",
    href: "/sign-in"
  },
  {
    planName: "Principal",
    description: "La capa mas completa para vivir el studio con mas cercania.",
    price: "69",
    features: ["Todo lo de Solista", "Clases en vivo", "Acceso prioritario", "Acompanamiento premium"],
    buttonText: "Elegir Principal",
    buttonVariant: "primary",
    href: "/sign-in"
  }
];

const Default = () => {
  return (
    <ModernPricingPage
      title={
        <>
          Encontra el <span className="text-[rgb(var(--brand-accent))]">plan</span> que mejor acompana tu entrenamiento
        </>
      }
      subtitle="Una estructura de membresias mas clara para entender rapido que incluye cada nivel."
      plans={myPricingPlans}
      showAnimatedBackground={false}
    />
  );
};

export { Default };
