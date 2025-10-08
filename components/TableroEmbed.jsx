export default function TableroEmbed({tablero_id}) {

  const TABLERO_LINKS = {
    masivos: 'https://1drv.ms/x/c/e002e7d72e5a47f0/IQSPXYYii_MfT7suRmt4WcMZAV4h5idlbYrFKU5NJr8DDbY?em=2&wdHideGridlines=True&wdHideHeaders=True&wdDownloadButton=True&wdInConfigurator=True&wdInConfigurator=True',
    refrigerados: '',
    chaco: 'https://1drv.ms/x/c/e002e7d72e5a47f0/IQSwRGxyNCSPQKeIrsOi4rUwAY6xCEk1Of1ZUvtkNxxgILA?em=2&wdHideGridlines=True&wdHideHeaders=True&wdDownloadButton=True&wdInConfigurator=True&wdInConfigurator=True',
    misiones: 'https://1drv.ms/x/c/e002e7d72e5a47f0/IQQRI-bVVQpwRLxG8sAZCVwPAXH0rGkY_y6XRxy6IL7DpEY?em=2&wdHideGridlines=True&wdHideHeaders=True&wdDownloadButton=True&wdInConfigurator=True&wdInConfigurator=True',
    obera: 'https://1drv.ms/x/c/e002e7d72e5a47f0/IQQ1MzA4uAspQpdF3KpiNYu8AYnQPG8QsrflDtSFX6l1kNY?em=2&wdHideGridlines=True&wdHideHeaders=True&wdDownloadButton=True&wdInConfigurator=True&wdInConfigurator=True'
  }


  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      {/* <h2 className="mb-4 text-4xl font-bold">Dashboard de Ventas</h2> */}

      {/* contenedor responsive 16:9 */}
      <div className="relative w-full h-[1000px] rounded-2xl overflow-hidden shadow-2xl">
        <iframe
          title="Dashboard Ventas Redcom"
          src={TABLERO_LINKS[tablero_id]}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          allowFullScreen
        />
      </div>
    </section>
  );
}
