// Mock data para todas las páginas

// Categorías principales para la home

const URl_ALTA_VENDO = 'https://script.google.com/macros/s/AKfycbzJTnNUStL47OL8nSBI4l5nMQRro36glOkMFRDsFWGTFBkntKg9jD0hr4b_ge5kXs6W1A/exec'

export const homeCategories = [
  {
    id: 1,
    title: 'Masivos',
    description: 'Distribución de productos de consumo masivo para toda la región',
    image: 'ctes.png',
    category: 'Masivos',
    link: '/corrientes/masivos'
  },
  {
    id: 2,
    title: 'Refrigerados',
    description: 'Cadena de frío garantizada para productos perecederos',
    image: 'refrigerados.png',
    category: 'Refrigerados',
    link: '/corrientes/refrigerados'
  },
  {
    id: 3,
    title: 'Chaco',
    description: 'Distribución especializada en la provincia del Chaco',
    image: 'chaco.png',
    category: 'Regional',
    link: '/chaco'
  },
  {
    id: 4,
    title: 'Misiones',
    description: 'Red de distribución en todo Misiones',
    image: 'misiones.png',
    category: 'Regional',
    link: '/misiones'
  },
  {
    id: 5,
    title: 'Oberá',
    description: 'Servicios especializados para Oberá',
    image: 'obera.png',
    category: 'Local',
    link: '/obera'
  },
];

// Productos Corrientes Masivos
export const corrientesMasivos = [
  {
    id: 1,
    title: 'Categorías',
    description: 'Un resumen de los KPIs de los vendedores y sus categorías alcanzadas.',
    image: '../categorias.png',
    category: 'Categoría',
    link: 'https://docs.google.com/spreadsheets/d/1fNBe9Y0ySwgYo94AYAdp-oUBeNrkyPvDUUXA_-WqFaM/edit?pli=1&gid=358286494#gid=358286494'
  },
  {
    id: 2,
    title: 'Alta de vendo',
    description: 'Completar un formulario para informar la alta o baja de un dispositivo.',
    image: '../alta.png',
    category: 'Vendo',
    link: URl_ALTA_VENDO
  },
  {
    id: 3,
    title: 'Horarios SIGO',
    description: 'Planilla para ver y corregir los horarios del dia a dia de los vendedores.',
    image: '../sigo.png',
    category: 'Sigo',
    link: 'https://docs.google.com/spreadsheets/d/16ni5z2doOVwqknbmjmURxQtsmJKngrZYri5egsOhJ6E/edit?gid=1100128416#gid=1100128416'
  },
  {
    id: 4,
    title: 'Dashboard de vendedores',
    description: 'Página web para visualizar de manera mas limpia la categoría alcanzada por cada vendedor.',
    image: '../dashboardvendedores.png',
    category: 'Venta',
    link: 'https://redcomcategorias.netlify.app/'
  },
  {
    id: 5,
    title: 'Planilla de compradores',
    description: 'Planilla para consultar vendedor y su ruta asignada, para asi ver los clientes compradores del mismo',
    image: '../compradores.png',
    category: 'Cobertura',
    link: 'https://docs.google.com/spreadsheets/d/1XjZHq0JH5mOrR8rp7jJNRggfSeGREDC5il1yAOrVqtk/edit?gid=1803835403#gid=1803835403'
  },
  {
    id: 6,
    title: 'Coberturas',
    description: 'Planilla para calcular las coberturas del mes que tienen que alcanzar los vendedores',
    image: '../coberturas.png',
    category: 'Cobertura',
    link: 'https://docs.google.com/spreadsheets/d/1UvBqzTKR77-qFukvrugEUps9O2_-Ic1x_mozfWERNHk/edit?gid=520020627#gid=520020627'
  },
  {
    id: 7,
    title: 'Facturación',
    description: 'Planilla para actualizar la facturación diara de los vendedores',
    image: '../facturacion.png',
    category: 'Venta',
    link: 'https://docs.google.com/spreadsheets/d/1-AqbScFSrIQzZ6AHnFDvXkXTSmfd--2yl4S4wIyFR7M/edit?gid=527281989#gid=527281989'
  },
  {
    id: 8,
    title: 'Avance objetivos',
    description: 'Planilla para visualizar el avance de objetivos de cada vendedor, tanto de volumen como de cobertura.',
    image: '..avance.png',
    category: 'Objetivos',
    link: 'https://docs.google.com/spreadsheets/d/11e7JvFaTVEpwk69cdQm40kwTTRevNklOceAxjGm3wzk/edit?gid=2062260391#gid=2062260391'
  },
];

// Productos Corrientes Refrigerados
export const corrientesRefrigerados = [
  {
    id: 1,
    title: 'Categorías',
    description: 'Un resumen de los KPIs de los vendedores y sus categorías alcanzadas.',
    image: '../categorias.png',
    category: 'Categoría',
    link: 'https://docs.google.com/spreadsheets/d/1g6WuEmj-XQ7k0u656lWT_E7cAd1qRXYJl3or3m_jbAI/edit?pli=1&gid=1444142030#gid=1444142030'
  },
  {
    id: 2,
    title: 'Alta de vendo',
    description: 'Completar un formulario para informar la alta o baja de un dispositivo.',
    image: '../alta.png',
    category: 'Vendo',
    link: URl_ALTA_VENDO
  },
  {
    id: 3,
    title: 'Horarios SIGO',
    description: 'Planilla para ver y corregir los horarios del dia a dia de los vendedores.',
    image: '../sigo.png',
    category: 'Sigo',
    link: 'https://docs.google.com/spreadsheets/d/1fv6LDF2BY8upnqBBeFQUoOlfIoWxQij5OsOKp-7AIy4/edit?gid=1543460534#gid=1543460534'
  },
  {
    id: 4,
    title: 'Planilla de compradores',
    description: 'Planilla para consultar vendedor y su ruta asignada, para asi ver los clientes compradores del mismo',
    image: '../compradores.png',
    category: 'Cobertura',
    link: 'https://docs.google.com/spreadsheets/d/1PJ-uACUjUk43ZQeHl59xmR0XLPSPaxHzHIe1y-Iy-UA/edit?gid=1803835403#gid=1803835403'
  },
  {
    id: 5,
    title: 'Coberturas',
    description: 'Planilla para calcular las coberturas del mes que tienen que alcanzar los vendedores',
    image: '../coberturas.png',
    category: 'Cobertura',
    link: 'https://docs.google.com/spreadsheets/d/1UvBqzTKR77-qFukvrugEUps9O2_-Ic1x_mozfWERNHk/edit?gid=1447212779#gid=1447212779'
  },
  {
    id: 6,
    title: 'Facturación',
    description: 'Planilla para actualizar la facturación diara de los vendedores',
    image: '../facturacion.png',
    category: 'Venta',
    link: 'https://docs.google.com/spreadsheets/d/1IG4XyjeLfPWUEkyyfsehR8v-fB6x6JNvs3S7NxIRLlk/edit?gid=770930045#gid=770930045'
  },
  {
    id: 7,
    title: 'Avance objetivos',
    description: 'Planilla para visualizar el avance de objetivos de cada vendedor, tanto de volumen como de cobertura.',
    image: '../avance_refri.png',
    category: 'Objetivos',
    link: 'https://docs.google.com/spreadsheets/d/1lNXRli30Cip4Heqx5JlVeuiOrJXIutnJBzyxsiOfenw/edit?gid=0#gid=0'
  },
];

// Productos Corrientes Refrigerados
export const corrientesRefrigeradosKilosBultos = [
  {
    id: 1,
    title: 'Análisis KGs',
    description: 'Calcular objetivo en bultos según porcentaje.',
    image: '../analisiskgs.png',
    category: 'Kilogramos',
    link: 'https://docs.google.com/spreadsheets/d/16X2mjK4Y0RnJbxJALET6xJd9C6TyOvkAj_S2kuHdvFk/edit?gid=0#gid=0'
  },
  {
    id: 2,
    title: 'Objetivos bultos',
    description: 'Planilla para sensibilizar bultos.',
    image: '../sensibilizacionbultos.png',
    category: 'Bultos',
    link: 'https://docs.google.com/spreadsheets/d/14RP9gisSK6Mfj_VYRhPVmBkOO-vQGbKe/edit?gid=266180071#gid=266180071'
  },
  {
    id: 3,
    title: 'Objetivos kilos',
    description: 'Planilla para sensibilizar bultos.',
    image: '../sensibilizacionkilos.png',
    category: 'Kilogramos',
    link: 'https://docs.google.com/spreadsheets/d/19QAA3rmYxzCjw-HYTYibXi6KZlljUs8L/edit?gid=353554848#gid=353554848'
  },
];

// Productos Chaco
export const chacoProducts = [
  {
    id: 1,
    title: 'Categorías',
    description: 'Un resumen de los KPIs de los vendedores y sus categorías alcanzadas.',
    image: 'categorias.png',
    category: 'Categoría',
    link: 'https://docs.google.com/spreadsheets/d/1P1im-XJJgwY3ldvyZP71mUM55_q252OAmVqpp6clBGw/edit?pli=1&gid=403677321#gid=403677321'
  },
  {
    id: 2,
    title: 'Alta de vendo',
    description: 'Completar un formulario para informar la alta o baja de un dispositivo.',
    image: 'alta.png',
    category: 'Vendo',
    link: URl_ALTA_VENDO
  },
  {
    id: 3,
    title: 'Horarios SIGO',
    description: 'Planilla para ver y corregir los horarios del dia a dia de los vendedores.',
    image: 'sigo.png',
    category: 'Sigo',
    link: 'https://docs.google.com/spreadsheets/d/1tDL4WxUMb6rNo2A3wQMSuMd5ybBD-1hHE1N5vFHP19Q/edit?gid=839825465#gid=839825465'
  },
  {
    id: 4,
    title: 'Planilla de compradores',
    description: 'Planilla para consultar vendedor y su ruta asignada, para asi ver los clientes compradores del mismo',
    image: 'compradores.png',
    category: 'Cobertura',
    link: 'https://docs.google.com/spreadsheets/d/1B3ASO_OCrx8eOfGxAujMWrndocBWy7eEq3r1FAofeWk/edit?gid=1726135858#gid=1726135858'
  },
  {
    id: 5,
    title: 'Coberturas',
    description: 'Planilla para calcular las coberturas del mes que tienen que alcanzar los vendedores',
    image: 'coberturas.png',
    category: 'Cobertura',
    link: 'https://docs.google.com/spreadsheets/d/1l3EIRnn8_kU5qjj8slrC-hoxVi3BIrbR40SIN_RqMjE/edit?gid=140953631#gid=140953631'
  },
  {
    id: 6,
    title: 'Facturación',
    description: 'Planilla para actualizar la facturación diara de los vendedores',
    image: 'facturacion.png',
    category: 'Venta',
    link: 'https://docs.google.com/spreadsheets/d/1dXHSLV4o6aXrEyA3cLu6zOurH8qerqoRxfDSoGGxf5E/edit?gid=935995601#gid=935995601'
  },
];

// Productos Misiones
export const misionesProducts = [
  {
    id: 1,
    title: 'Categorías',
    description: 'Un resumen de los KPIs de los vendedores y sus categorías alcanzadas.',
    image: 'categorias.png',
    category: 'Categoría',
    link: 'https://docs.google.com/spreadsheets/d/1iiN_n3Cerbi8bBpwZNSGAyx6q7XJ35MV_orGkHOT5Ko/edit?pli=1&gid=285772381#gid=285772381'
  },
  {
    id: 2,
    title: 'Alta de vendo',
    description: 'Completar un formulario para informar la alta o baja de un dispositivo.',
    image: 'alta.png',
    category: 'Vendo',
    link: URl_ALTA_VENDO
  },
  {
    id: 3,
    title: 'Horarios SIGO',
    description: 'Planilla para ver y corregir los horarios del dia a dia de los vendedores.',
    image: 'sigo.png',
    category: 'Sigo',
    link: 'https://docs.google.com/spreadsheets/d/19x4WMn78V3qDRB1rpPPokyx3uBZ8P9XL3ZYqA2nsnCk/edit?gid=1525126502#gid=1525126502'
  },
  {
    id: 4,
    title: 'Planilla de compradores',
    description: 'Planilla para consultar vendedor y su ruta asignada, para asi ver los clientes compradores del mismo',
    image: 'compradores.png',
    category: 'Cobertura',
    link: 'https://docs.google.com/spreadsheets/d/17gA5No9S1UUpoLTtLtPerHD7Aoh_7efMUFs4n12MIQs/edit?gid=1803835403#gid=1803835403'
  },
  {
    id: 5,
    title: 'Coberturas',
    description: 'Planilla para calcular las coberturas del mes que tienen que alcanzar los vendedores',
    image: 'coberturas.png',
    category: 'Cobertura',
    link: 'https://docs.google.com/spreadsheets/d/1B3AU8bFBbSPCxRsGZiHaj8TlkBnTrxVIYMlDpKHLbF4/edit?gid=1020537555#gid=1020537555'
  },
  {
    id: 6,
    title: 'Facturación',
    description: 'Planilla para actualizar la facturación diara de los vendedores',
    image: 'facturacion.png',
    category: 'Venta',
    link: 'https://docs.google.com/spreadsheets/d/1T50beHRDwLKyadY5T0yg4D8cI3DwVDVxKULKd-k3xX8/edit?gid=127290544#gid=127290544'
  },
];

// Productos Oberá
export const oberaProducts = [
  {
    id: 1,
    title: 'Categorías',
    description: 'Un resumen de los KPIs de los vendedores y sus categorías alcanzadas.',
    image: 'categorias.png',
    category: 'Categoría',
    link: 'https://docs.google.com/spreadsheets/d/1g_dpt5OIVkxw7XLBfbWjX0oc4FUG5s-k1FlZAP4x2PM/edit?gid=1425288306#gid=1425288306'
  },
  {
    id: 2,
    title: 'Alta de vendo',
    description: 'Completar un formulario para informar la alta o baja de un dispositivo.',
    image: 'alta.png',
    category: 'Vendo',
    link: URl_ALTA_VENDO,
  },
  {
    id: 3,
    title: 'Horarios SIGO',
    description: 'Planilla para ver y corregir los horarios del dia a dia de los vendedores.',
    image: 'sigo.png',
    category: 'Sigo',
    link: 'https://docs.google.com/spreadsheets/d/1Jpl_Mnqkdn8tc2hcUGhsEgPvkRuwInYSvbtdkTIPQBY/edit?gid=1100128416#gid=1100128416'
  },
  {
    id: 4,
    title: 'Planilla de compradores',
    description: 'Planilla para consultar vendedor y su ruta asignada, para asi ver los clientes compradores del mismo',
    image: 'compradores.png',
    category: 'Cobertura',
    link: 'https://docs.google.com/spreadsheets/d/1LyEhb5LBixTgXVYwB95CzM8R_P2LdHJgMWTEr0aBp8g/edit?gid=1803835403#gid=1803835403'
  },
  {
    id: 5,
    title: 'Coberturas',
    description: 'Planilla para calcular las coberturas del mes que tienen que alcanzar los vendedores',
    image: 'coberturas.png',
    category: 'Cobertura',
    link: 'https://docs.google.com/spreadsheets/d/1b9LN9CkrKIjSq_EC0bmsXDD8oBn6axDh3STcAebsI2k/edit?gid=520020627#gid=520020627'
  },
  {
    id: 6,
    title: 'Facturación',
    description: 'Planilla para actualizar la facturación diara de los vendedores',
    image: 'facturacion.png',
    category: 'Venta',
    link: 'https://docs.google.com/spreadsheets/d/1WNdFuufw7mUXuVaxJsByEJgtdNcoN5TyrcqXBzPmgEU/edit?gid=1725998745#gid=1725998745'
  },
  {
    id: 7,
    title: 'Avance objetivos',
    description: 'Planilla para visualizar el avance de objetivos de cada vendedor, tanto de volumen como de cobertura.',
    image: 'avance.png',
    category: 'Objetivos',
    link: 'https://docs.google.com/spreadsheets/d/1e9PxQr4_QTkljNy-X-MqUQxmX0iCDAC5z2FZRzflPJc/edit?gid=2062260391#gid=2062260391'
  },
];