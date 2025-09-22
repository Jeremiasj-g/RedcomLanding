export default function MapsEmbed({map_id}) {

  const MAP_LINKS = {
    masivos: 'https://www.google.com/maps/d/u/0/embed?mid=1dswZoPN46Tw75GZOd2latT9AdKe0y8M&ehbc=2E312F',
    refrigerados: '',
    chaco: '',
    misiones: 'https://www.google.com/maps/d/u/0/embed?mid=1h1E8r7uu-jsySRjaEHpERx72CpNIISg&ehbc=2E312F',
    obera: ''
  }


  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      {/* <h2 className="mb-4 text-4xl font-bold">Dashboard de Ventas</h2> */}

      {/* contenedor responsive 16:9 */}
      <div className="relative w-full h-[600px] rounded-2xl overflow-hidden shadow-2xl">
        <iframe
          title="Dashboard Ventas Redcom"
          src={MAP_LINKS[map_id]}
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
