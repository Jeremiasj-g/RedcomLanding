export default function LookerEmbed({looker_id}) {

  const LOOKER_LINKS = {
    masivos: 'https://lookerstudio.google.com/embed/reporting/060a7873-f0fd-4c6b-a47c-8309fad5feb2/page/yUXeF',
    refrigerados: 'https://lookerstudio.google.com/embed/reporting/f0a5a6bd-81c9-4520-9064-d0288fa5340a/page/OQ6XF',
    chaco: 'https://lookerstudio.google.com/embed/reporting/711d1e14-c3f5-4463-868b-346acfd1c035/page/CUieF',
    misiones: 'https://lookerstudio.google.com/embed/reporting/2be5fc5a-2f9e-49cf-88da-0978009acafa/page/kAmeF',
    obera: 'https://lookerstudio.google.com/embed/reporting/bc58724b-a8a7-4b85-a94b-f0df229e289a/page/6WmeF',
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
