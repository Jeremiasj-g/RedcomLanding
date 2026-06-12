"use client";

import { useMemo } from "react";
import { BarChart3, Flame, Table } from "lucide-react";
import BranchResourcesSection from "@/components/BranchResourcesSection";
import CategoryBannerLink from "@/components/categoria/CategoryBannerLink";
import Container from "@/components/Container";
import FullScreenEmbedCard from "@/components/FullScreenEmbedCard";
import LookerEmbed from "@/components/LookerEmbed";
import LookerTabs from "@/components/LookerTabs";
import { RequireAuth } from "@/components/RouteGuards";
import { useMe } from "@/hooks/useMe";
import { misionesProducts, urls } from "@/lib/data";
import PageHeader from "@/components/PageHeader";

export default function Misiones() {
  const { me } = useMe();
  const tableroMisiones = urls.tableros[3].misiones;
  const role = me?.role ?? "vendedor";

  const visibleProducts = misionesProducts.filter((product) =>
    (product.roles ?? []).includes(role),
  );

  const canSeeAnalytics = ["admin", "supervisor", "jdv"].includes(role);

  const lookerTabs = useMemo(
    () => [
      {
        key: "dashboard",
        label: "Dashboard",
        icon: <BarChart3 className="h-4 w-4" />,
        bgImage: "dash_mnes.webp",
      },
      {
        key: "heatmap",
        label: "Mapa de calor",
        icon: <Flame className="h-4 w-4" />,
        bgImage: "heatmap_mnes.webp",
      },
    ],
    [],
  );

  return (
    <RequireAuth
      roles={["admin", "supervisor", "jdv", "vendedor", "rrhh"]}
      branches={["misiones"]}
    >

      <PageHeader
          title="Misiones"
          bg="bg-gradient-to-tl from-emerald-900 to-transparent to-[55%]"
          bg2='bg-gradient-to-bl from-lime-400/90 from-0% via-[20%] to-transparent to-[35%]'
          bgImage='/mapa-misiones.png'
        />

      <div className="min-h-screen bg-white">
        <BranchResourcesSection
          branchName="Misiones"
          products={visibleProducts}
        />

        <section className="bg-white py-12 sm:py-14">
          <Container>
            <CategoryBannerLink
              branchLabel="Misiones"
              href="/misiones/categorias"
              title="Categorías"
              description="Ranking por vendedor, puntajes y comparación por criterios."
              buttonLabel="Abrir"
            />

            {canSeeAnalytics && (
              <div className="mt-8">
                <FullScreenEmbedCard {...tableroMisiones} icon={<Table />} />
              </div>
            )}
          </Container>
        </section>

        {canSeeAnalytics && (
          <LookerTabs
            tabs={lookerTabs}
            defaultTab="dashboard"
            className="mt-14"
          >
            {({ activeTab }) => (
              <LookerEmbed
                looker_id="misiones"
                type={activeTab.key}
                bgImage={activeTab.bgImage}
              />
            )}
          </LookerTabs>
        )}
      </div>
    </RequireAuth>
  );
}
