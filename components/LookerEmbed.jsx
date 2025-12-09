export default function LookerEmbed({looker_id}) {

  const LOOKER_LINKS = {
    masivos: 'https://lookerstudio.google.com/embed/reporting/ad82bc6b-d9d2-4c2e-b5a7-b761ecbdf7f3/page/zlJiF',
    refrigerados: 'https://lookerstudio.google.com/embed/reporting/c5ac5605-9848-4fa9-9433-0afa6cfc867c/page/p_f38jghr7xd',
    chaco: 'https://lookerstudio.google.com/embed/reporting/711d1e14-c3f5-4463-868b-346acfd1c035/page/CUieF',
    misiones: 'https://lookerstudio.google.com/embed/reporting/2be5fc5a-2f9e-49cf-88da-0978009acafa/page/kAmeF',
    obera: 'https://lookerstudio.google.com/embed/reporting/bc58724b-a8a7-4b85-a94b-f0df229e289a/page/6WmeF',
    gerencia: 'https://lookerstudio.google.com/embed/reporting/cef0180a-7960-4a53-9866-f390ec75f579/page/yLQfF'
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
