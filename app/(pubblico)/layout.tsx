import { Intestazione } from "@/components/Intestazione";
import { PiePagina } from "@/components/PiePagina";

export default function LayoutPubblico({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Intestazione />
      <main className="flex-1">{children}</main>
      <PiePagina />
    </>
  );
}
