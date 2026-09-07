import ClientesCalificadosPage from "./ClientesCalificadosPage";
import CccExportAllBrandsFix from "./CccExportAllBrandsFix";
import CccSnapshotFeature from "./CccSnapshotFeature";

export default function Page(){
  return (
    <>
      <CccExportAllBrandsFix />
      <CccSnapshotFeature />
      <ClientesCalificadosPage />
    </>
  );
}
