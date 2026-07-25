import { Suspense } from "react";
import CatalogPrototype from "./catalog-prototype";

// PROTOTYPE — Three customer-catalog directions, switchable via ?variant=, on the existing / route.
export default function Home() {
  return (
    <Suspense fallback={<div className="prototype-loading">Loading catalog prototype…</div>}>
      <CatalogPrototype />
    </Suspense>
  );
}
