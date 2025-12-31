# Assets - Logotipos Institucionales

Este directorio contiene el logotipo institucional utilizado en los reportes PDF generados por el agente.

## Archivo requerido

### `logo_imss.png`
- **Ubicación en reporte**: Encabezado (esquina superior izquierda)
- **Tamaño actual**: 780 x 191 px (ratio 4:1)
- **Formato**: PNG
- **Descripción**: Logotipo principal del IMSS con símbolo institucional

## Diseño del encabezado

El sistema genera un encabezado con:
- Fondo blanco (para que el símbolo verde del logo sea visible)
- Logo IMSS en la esquina superior izquierda
- Leyenda institucional a la derecha (3 líneas):
  * Dirección de Prestaciones Médicas
  * Unidad de Planeación e Innovación en Salud
  * Coordinación de Vigilancia Epidemiológica
- Línea separadora verde institucional
- Título del reporte centrado debajo de la línea (en negro)

## Notas técnicas

- El logo debe estar en formato PNG
- Fondo transparente permite mejor integración
- El sistema es tolerante a fallos: si no encuentra el logo, genera el reporte sin él
- La altura se ajusta automáticamente en el PDF (12mm)
- El ancho se calcula proporcionalmente según el ratio del logo

## Dónde conseguir el logo oficial

El logotipo institucional oficial del IMSS se puede solicitar al departamento de comunicación institucional o descargar desde la intranet institucional.

