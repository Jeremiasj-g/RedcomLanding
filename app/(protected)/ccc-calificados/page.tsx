import ClientesCalificadosPage from "./ClientesCalificadosPage";
import CccAlfajoresCompetition from "./CccAlfajoresCompetition";
import CccExportAllBrandsFix from "./CccExportAllBrandsFix";
import CccMixAlfajoresFeature from "./CccMixAlfajoresFeature";
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
      <CccAlfajoresCompetition />
      <CccMixAlfajoresFeature />
      <CccSelectEnhancer />
      <ClientesCalificadosPage key={`ccc-dashboard:${snapshotKey}`} />
    </>
  );
}
