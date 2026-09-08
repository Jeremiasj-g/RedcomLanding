import ClientesCalificadosPage from "./ClientesCalificadosPage";
import CccExportAllBrandsFix from "./CccExportAllBrandsFix";
import CccSelectEnhancer from "./CccSelectEnhancer";
import CccSnapshotFeature from "./CccSnapshotFeature";

export default function Page({
  searchParams,
}: {
  searchParams?: { ccc_snapshot?: string | string[] };
}) {
  const rawSnapshot = Array.isArray(searchParams?.ccc_snapshot)
    ? searchParams?.ccc_snapshot[0]
    : searchParams?.ccc_snapshot;
  const snapshotKey = rawSnapshot || "live";

  return (
    <>
      <CccExportAllBrandsFix />
      <CccSnapshotFeature />
      <CccSelectEnhancer />
      <ClientesCalificadosPage key={`ccc-dashboard:${snapshotKey}`} />
    </>
  );
}
