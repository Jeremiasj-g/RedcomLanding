export default function LookerEmbed({looker_id}) {

  const LOOKER_LINKS = {
    masivos: 'https://lookerstudio.google.com/embed/reporting/060a7873-f0fd-4c6b-a47c-8309fad5feb2/page/yUXeF',
    refrigerados: 'https://lookerstudio.google.com/embed/reporting/f0a5a6bd-81c9-4520-9064-d0288fa5340a/page/OQ6XF',
    chaco: 'https://lookerstudio.google.com/embed/reporting/0d3a616b-9622-4510-9f96-0bfc2f3dce25/page/sKSXF',
    misiones: 'https://lookerstudio.google.com/embed/reporting/130950d7-ccf0-4b69-857f-322a721d836a/page/3LWWF',
    obera: 'https://lookerstudio.google.com/embed/reporting/32609a9b-183e-442f-b43f-232c7134a8fa/page/YVQYF',
    gerencia: 'https://lookerstudio.google.com/embed/reporting/16637405-5918-45b5-97d2-73315342ca20/page/I87aF'
  }


  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      {/* <h2 className="mb-4 text-4xl font-bold">Dashboard de Ventas</h2> */}

      {/* contenedor responsive 16:9 */}
      <div className="relative w-full h-[1000px] rounded-2xl overflow-hidden shadow-2xl">
        <iframe
          title="Dashboard Ventas Redcom"
          src={LOOKER_LINKS[looker_id]}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          allowFullScreen
        />
      </div>

      {/* CTA opcional */}
      {/* <a
        href="https://lookerstudio.google.com/embed/reporting/130950d7-ccf0-4b69-857f-322a721d836a/page/3LWWF"
        target="_blank" rel="noreferrer"
        className="mt-4 inline-block text-sm text-rose-400 hover:text-rose-300"
      >
        Ver en Looker Studio →
      </a> */}
    </section>
  );
}
