// solo esta sección
localStorage.removeItem('gate:masivos');

// eliminar cache de todas (ajustá la lista)
['masivos','refrigerados','chaco','misiones','obera']
  .forEach(a => localStorage.removeItem(`gate:${a}`));