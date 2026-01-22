export default function LookerEmbed({looker_id}) {

  const LOOKER_LINKS = {
    masivos: 'https://lookerstudio.google.com/embed/reporting/b37f7c00-c237-404d-9cc3-34c568658ee6/page/zWgkF',
    refrigerados: 'https://lookerstudio.google.com/embed/reporting/b1165fcb-7d52-4856-9c09-04dfdfe1acf2/page/1f9lF',
    refrigeradosKilos: 'https://lookerstudio.google.com/embed/reporting/c8441ded-1073-41a0-ba7c-6b5826637c41/page/yy9lF',
    chaco: 'https://lookerstudio.google.com/embed/reporting/95f84fe1-d5b8-4b6d-b877-fe5c4015c135/page/3eLiF',
    misiones: 'https://lookerstudio.google.com/embed/reporting/535423b7-c192-49b3-a2bf-a1d03f070110/page/iSnkF',
    obera: 'https://lookerstudio.google.com/embed/reporting/02da7063-7bb9-4398-b53a-da040bc4355e/page/p1nkF',
    gerencia: 'https://lookerstudio.google.com/embed/reporting/27614a4d-463e-485f-a9c6-b229948be202/page/OzFlF'
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
