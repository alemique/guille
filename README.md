Trello JSON -> Tablero de Juicios (HTML)

Archivos:
- `index.html` - Interfaz y estructura.
- `styles.css` - Estilos y layout del tablero.
- `app.js` - Lógica de carga, render y persistencia.

Uso:
1. Abre `index.html` en tu navegador (doble clic).
2. Auto-carga: la página intenta cargar automáticamente `Q7vCIwzd - guille.json` desde la misma carpeta. Si el navegador bloquea el acceso a archivos locales, usa el botón "Cargar JSON" o arrastra el archivo al recuadro.
3. Se renderiza el tablero con columnas de Categorías (LABORAL, CIVIL/CONTENCIOSO ADM., COBRADO) y debajo las columnas originales por lista.
4. En cada tarjeta:
   - Completa "Importe a Percibir".
   - Marca "Cobrado" si corresponde.
5. El monto total cobrado aparece arriba a la derecha y se actualiza al marcar/desmarcar.
6. Botón "Exportar": descarga un CSV con columnas Juicio; Importe a Percibir; Cobrado; Lista; Categoría.

Detalles:
- Se usa `card.name` como título de la tarjeta; se ignoran listas o tarjetas con `closed: true`.
- Los datos (importe y cobrado por tarjeta) se guardan en `localStorage` por `boardId`.
- Búsqueda: filtra tarjetas por texto del nombre.
- Si el JSON incluye un Custom Field llamado "Importe a Percibir", se precompleta el importe cuando sea posible.
- Categorías: 
  - LABORAL: tarjetas cuyo nombre contiene "laboral" (y no cobradas).
  - CIVIL/CONTENCIOSO ADM.: tarjetas cuyo nombre contiene "civil" o "contencioso" (y no cobradas).
  - COBRADO: cualquier tarjeta marcada como cobrada.

Notas:
- No se necesita servidor para la carga manual (arrastrar/seleccionar) gracias a `FileReader`.
- La auto-carga del JSON puede requerir servir los archivos con un servidor local (por ejemplo, VSCode Live Server). En algunos navegadores, abrir `index.html` con `file://` impide `fetch` del archivo local.
- Para borrar datos guardados, limpia el `localStorage` del sitio desde el navegador.
- Formato de moneda: el total se formatea como ARS; el input acepta `.` o `,` como separador decimal.
 - Exportación: usa separador `;` para compatibilidad con Excel en español; el importe se exporta con coma decimal.

Opcional (no implementado aún):
- Exportar/Importar estados a un archivo JSON externo.
- Totales por columna.
