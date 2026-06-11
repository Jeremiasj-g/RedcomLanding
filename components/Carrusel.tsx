interface Sponsor {
  name: string;
  logo: string;
}

const sponsors: Sponsor[] = [
  {
    name: "Baggio",
    logo: "/marcas/logobaggio.png",
  },
  {
    name: "TypeScript",
    logo: "/marcas/logobio.png",
  },
  {
    name: "Tailwind CSS",
    logo: "/marcas/logobranca.png",
  },
  {
    name: "Node.js",
    logo: "/marcas/logocasaprimavera.png",
  },
  {
    name: "Vite",
    logo: "/marcas/logocremigal.png",
  },
  {
    name: "GitHub",
    logo: "/marcas/logodilema.png",
  },
];

export default function Carrusel() {
  const duplicatedSponsors = [...sponsors, ...sponsors];

  return (
    <section className="w-[55%] overflow-hidden py-2">
      <div>
        <div className="flex w-max animate-infinite-scroll hover:[animation-play-state:paused]">
          {duplicatedSponsors.map((sponsor, index) => (
            <div
              key={`${sponsor.name}-${index}`}
              className="flex w-44 shrink-0 items-center justify-center px-6"
              aria-hidden={index >= sponsors.length}
            >
              <img
                src={sponsor.logo}
                alt={index < sponsors.length ? sponsor.name : ""}
                className="
                  w-20 object-contain
                  transition duration-300
                  hover:scale-110
                "
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}