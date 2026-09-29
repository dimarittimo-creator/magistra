import { MenuArea } from "@/components/MenuArea";
import { richiediFarmacia } from "@/lib/auth";

export default async function LayoutFarmacia({ children }: { children: React.ReactNode }) {
  await richiediFarmacia();
  return (
    <>
      <MenuArea
        etichetta="Area farmacia"
        voci={[
          { href: "/farmacia", testo: "Area riservata", esatta: true },
          { href: "/farmacia/profilo", testo: "Il mio profilo" },
        ]}
      />
      {children}
    </>
  );
}
