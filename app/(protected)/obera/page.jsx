"use client";

import { useMemo } from "react";
import { BarChart3, Flame, Table } from "lucide-react";
import BranchResourcesSection from "@/components/BranchResourcesSection";
import Container from "@/components/Container";
import FullScreenEmbedCard from "@/components/FullScreenEmbedCard";
import LookerEmbed from "@/components/LookerEmbed";
import LookerTabs from "@/components/LookerTabs";
import { RequireAuth } from "@/components/RouteGuards";
import { useMe } from "@/hooks/useMe";
import { oberaProducts, urls } from "@/lib/data";
import PageHeader from '@/components/PageHeader';

export default function Obera() {
  const { me } = useMe();
  const tableroObera = urls.tableros[5].obera;
  const role = me?.role ?? "vendedor";

  const visibleProducts = oberaProducts.filter((product) =>
    (product.roles ?? []).includes(role),
  );

  const canSeeAnalytics = ["admin", "supervisor", "jdv"].includes(role);

  const lookerTabs = useMemo(
    () => [
      {
        key: "dashboard",
        label: "Dashboard",
        icon: <BarChart3 className="h-4 w-4" />,
        bgImage: "dash_obera.webp",
      },
      {
        key: "heatmap",
        label: "Mapa de calor",
        icon: <Flame className="h-4 w-4" />,
        bgImage: "heatmap_obera.webp",
      },
    ],
    [],
  );

  return (
    <RequireAuth
      roles={["admin", "supervisor", "jdv", "vendedor", "rrhh"]}
      branches={["obera"]}
    >

      <PageHeader
        title="Oberá"
        bg="bg-gradient-to-tl from-purple-900 to-transparent to-[55%]"
        bg2='bg-gradient-to-bl from-pink-400/90 from-0% via-[20%] to-transparent to-[35%]'
        bgImage="/mapa-obera.png"
      />

      <div className="min-h-screen bg-white">
        <BranchResourcesSection branchName="Oberá" products={visibleProducts} />

        {canSeeAnalytics && (
          <>
            <section className="bg-white py-12 sm:py-14">
              <Container>
                <FullScreenEmbedCard {...tableroObera} icon={<Table />} />
              </Container>
            </section>

            <LookerTabs
              tabs={lookerTabs}
              defaultTab="dashboard"
              className="mt-14"
              eyebrow="Inteligencia comercial · Oberá"
              title="Ventas y mapa de calor"
              description="Revisá el desempeño comercial de Oberá desde las vistas oficiales: tablero de ventas y lectura territorial por zona."
            >
              {({ activeTab }) => (
                <LookerEmbed
                  looker_id="obera"
                  type={activeTab.key}
                  bgImage={activeTab.bgImage}
                />
              )}
            </LookerTabs>
          </>
        )}
      </div>
    </RequireAuth>
  );
}
