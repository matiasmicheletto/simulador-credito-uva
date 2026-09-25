# Simulador de cambio de vivienda - Crédito UVA

Aplicación web estática para comparar distintos momentos de venta de una vivienda y compra de otra mientras se mantiene un crédito hipotecario UVA.

La simulación proyecta la evolución mensual del crédito, la vivienda actual, la vivienda objetivo, los ingresos, los gastos, el tipo de cambio y los ahorros. Para cada mes muestra si el capital disponible alcanza para comprar la vivienda objetivo, incluyendo los gastos de compra y la reserva mínima configurada.

> **Importante:** es una herramienta de simulación y planificación. Los resultados dependen de los supuestos ingresados y no constituyen una recomendación financiera, una cotización bancaria ni una garantía de resultados futuros.

## Funcionalidades

- Carga del crédito mediante dos alternativas:
  - saldo de capital actual en UVA;
  - datos del crédito original para reconstruir el saldo estimado.
- Cálculo de cuota y saldo con sistema de amortización francés.
- Proyección mensual hasta la última cuota del crédito.
- Proyección de UVA a partir de la inflación mensual esperada.
- Proyección independiente del tipo de cambio, ingresos, gastos y valores de ambas viviendas.
- Interpretación de la tasa del crédito como TEA o TNA.
- Cálculo de penalización por cancelación anticipada hasta una cuota determinada.
- Inclusión de costos de venta, costos de compra, reserva mínima en USD y costos notariales/registrales de cancelación.
- Configuración de spread cambiario entre puntas compradora y vendedora.
- Proyección de ahorros en dólares, considerando rendimiento anual, carga impositiva y flujo mensual positivo.
- Acumulación de deuda operativa en pesos cuando el flujo mensual negativo agota los ahorros, con tasa anual independiente.
- Alerta de relación cuota/ingreso (RCI) mediante umbral configurable.
- Indicadores principales:
  - mes con mayor excedente;
  - primer mes que cubre la compra y la reserva;
  - costo de cancelación hoy;
  - costo de cancelación en 24 meses;
  - primer mes que supera el umbral RCI;
  - primer mes con deuda acumulada.
- Gráfico interactivo de faltante o excedente por mes.
- Gráfico interactivo de ahorro y deuda acumulados por mes.
- Tabla detallada con el escenario completo.
- Exportación de parámetros a JSON.
- Importación de parámetros desde JSON.
- Exportación de la tabla de resultados a CSV.
- Persistencia automática de los valores del formulario en `localStorage`.
- Carga automática del dólar oficial y de la UVA desde APIs públicas.

## Uso

No requiere instalación ni servidor web.

1. Cloná o descargá este repositorio.
2. Abrí `index.html` en un navegador moderno.
3. Completá los parámetros del crédito, la dinámica económica y la operación inmobiliaria.
4. Revisá los indicadores, el gráfico y la tabla de escenarios.
5. Usá `Exportar JSON` para guardar los parámetros o `Exportar tabla` para descargar los resultados en CSV.

También puede ejecutarse desde cualquier servidor estático local. Por ejemplo:

```bash
python3 -m http.server
```

Después, abrí `http://localhost:8000` en el navegador.

## Generar una versión única

Para generar una versión compactada y autocontenida en `dist/index.html`, ejecutá:

```bash
node minify.js
```

El proceso inserta `index.css` e `index.js` dentro del HTML resultante, por lo que la carpeta `dist` puede publicarse como sitio estático sin los archivos fuente separados.

## Datos actualizados

Al abrir la aplicación por primera vez, se consultan:

- [Dólar oficial de DolarAPI](https://dolarapi.com/v1/dolares/oficial), usando el valor de venta.
- [Histórico de UVA de ArgentinaDatos](https://api.argentinadatos.com/v1/finanzas/indices/uva), usando el último valor válido disponible.

La consulta tiene un tiempo máximo de espera de cinco segundos. Si una API no responde, devuelve un formato inesperado o no hay conexión, se mantiene el valor que ya figura en el formulario. Cuando existen parámetros guardados previamente en el navegador, se respetan para no sobrescribir la configuración del usuario.

## Parámetros principales

### Crédito UVA

- **Conozco el saldo actual:** requiere la cuota actual, el total de cuotas, la tasa efectiva anual, el saldo de capital en UVA y el valor actual de la UVA.
- **Conozco el crédito original:** reconstruye el capital original a partir del valor de la vivienda, el tipo de cambio, el porcentaje financiado y el valor original de la UVA. Luego estima la cuota y el saldo actual.
- La tasa puede interpretarse como TEA, con capitalización compuesta anual, o como TNA, calculada como tasa mensual nominal dividida por 12.
- Penalización por cancelación anticipada y cuota hasta la que aplica.
- Otros costos mensuales asociados al crédito.
- Umbral configurable de relación cuota/ingreso (RCI).

### Dinámica económica

- Inflación mensual esperada.
- Tipo de cambio actual y variación mensual esperada.
- Ingresos y gastos mensuales actuales.
- Crecimiento mensual esperado de ingresos y gastos.
- Rendimiento anual estimado de los ahorros en dólares.
- Carga impositiva estimada sobre el rendimiento de los ahorros.
- Tasa anual de la deuda acumulada, independiente de la tasa del crédito.

### Vivienda y operación

- Valor y variación esperada de la vivienda actual.
- Valor y variación esperada de la vivienda objetivo.
- Costos de venta y de compra.
- Reserva mínima a conservar después de la operación.
- Ahorros actuales invertidos en dólares.

### Configuración avanzada

- Costos notariales y registrales estimados de cancelación de hipoteca.
- Spread cambiario entre punta compradora y vendedora.
- Tasa anual de la deuda acumulada.

## Supuestos del modelo

- El crédito se mantiene internamente en UVA.
- La amortización utiliza el sistema francés.
- La tasa del crédito se interpreta como TEA o TNA según la selección: la TEA se convierte mediante capitalización compuesta y la TNA se divide linealmente por 12.
- La UVA crece al mismo ritmo que la inflación mensual esperada. Es una aproximación del modelo, no una identidad matemática exacta.
- El tipo de cambio, los ingresos, los gastos y los valores inmobiliarios se proyectan aplicando sus respectivas variaciones mensuales.
- La cuota en pesos se calcula como cuota en UVA por valor proyectado de la UVA, más los otros costos mensuales configurados.
- El saldo del crédito se cancela en pesos y se convierte a dólares usando el tipo de cambio del mes correspondiente.
- La cancelación incluye la penalización aplicable y los costos notariales/registrales extra configurados.
- La venta neta descuenta los costos de venta.
- La compra total incluye el precio de la vivienda objetivo y los costos de compra.
- El flujo mensual se calcula como ingresos menos gastos menos cuota. Si es positivo, se convierte a dólares y se suma a los ahorros.
- Los ahorros en dólares se actualizan con el rendimiento mensual equivalente neto de impuestos y el flujo positivo convertido usando la punta vendedora superior.
- Si el flujo mensual es negativo, primero se utilizan los ahorros disponibles, liquidados a la punta compradora inferior. El faltante restante se acumula como deuda en pesos y se capitaliza con la tasa de deuda, independiente de la tasa hipotecaria.
- La deuda acumulada se capitaliza en pesos y se convierte a dólares únicamente al calcular el capital disponible; su valor se descuenta usando la punta compradora.
- El indicador de faltante/excedente es el capital disponible después de vender y cancelar el crédito, menos el costo total de compra, expresado en dólares.
- Un mes es considerado alcanzable cuando el excedente es positivo o cero y también permite conservar la reserva mínima.
- La RCI de cada mes es la cuota en pesos dividida por los ingresos de ese mes; se marca cuando supera el umbral configurado.
- El gráfico adicional muestra simultáneamente la evolución del ahorro acumulado y la deuda acumulada en dólares.

## Estructura del repositorio

- [`index.html`](index.html): estructura de la interfaz y campos de entrada.
- [`index.js`](index.js): modelo financiero, validaciones, proyecciones, gráfico y exportaciones.
- [`index.css`](index.css): estilos de la aplicación.
- [`minify.js`](minify.js): genera la versión autocontenida y compactada en `dist/index.html`.
- [`LICENCE`](LICENCE): licencia del proyecto.

## Tecnologías

- HTML5
- CSS3
- JavaScript moderno del lado del cliente
- Canvas API para el gráfico
- `localStorage`, `FileReader` y `Blob` para persistencia e importación/exportación

No utiliza frameworks ni dependencias externas.
