# Especificaciones Técnicas y Contexto de Infraestructura
**Proyecto:** Agente Analítico de Diabetes IMSS (Backend Python + Frontend Next.js)
**Entorno:** Servidor Físico "On-Premise" (Ubuntu 22.04 LTS)

## 1. Topología de Red y Conectividad
[cite_start]El servidor opera en una arquitectura de red dual que el software debe respetar estrictamente para el enrutamiento de tráfico[cite: 78].

* [cite_start]**Sistema Operativo:** Ubuntu 22.04 LTS[cite: 73].
* **Interfaz de Internet (`enp27s0`):** IP `192.168.1.66`. [cite_start]Esta interfaz debe usarse para la salida hacia la API de OpenAI[cite: 82].
* **Interfaz Intranet IMSS (`enx00e04c680190`):** IP `11.124.14.201`. [cite_start]Esta interfaz es la **única** ruta física hacia la base de datos SQL Server[cite: 83].
* [cite_start]**Restricción de Acceso:** El servidor no es accesible públicamente desde internet; solo desde la VPN o red institucional[cite: 66, 67]. [cite_start]El despliegue depende de actualizaciones tipo "Pull" desde el servidor[cite: 17].

## 2. Conexión a Base de Datos (Punto Crítico)
La conexión a la base de datos es el desafío técnico principal debido a la antigüedad del servidor SQL del IMSS y la modernidad de Ubuntu 22.04.

* [cite_start]**Motor de Base de Datos:** SQL Server (Legacy) ubicado en la IP **11.33.41.96**[cite: 76, 84].
* [cite_start]**Driver Instalado:** El servidor ya cuenta con `Microsoft ODBC Driver 17 for SQL Server` instalado y funcional[cite: 94, 292].
* **Conflicto SSL/TLS (CRÍTICO):** Ubuntu 22.04 usa OpenSSL 3.0, el cual bloquea por defecto los protocolos de seguridad antiguos que usa el servidor SQL del IMSS.
    * [cite_start]*Síntoma previo:* Error `SSL routines::unsupported protocol`[cite: 348].
    * [cite_start]*Solución previa aplicada:* Se requirió configurar OpenSSL con `SECLEVEL=0` y permitir `UnsafeLegacyRenegotiation`[cite: 317, 318].
    * *Instrucción para Python/Agency Swarm:* El string de conexión (Connection String) de `pyodbc` o `sqlalchemy` debe configurarse explícitamente para confiar en el certificado del servidor y no requerir encriptación estricta si el handshake falla.
    * *Parámetros sugeridos:* `TrustServerCertificate=yes`, `Encrypt=no`.

Desafío Crítico de Conectividad SSL (Legacy): Existe una incompatibilidad nativa entre Ubuntu 22.04 (OpenSSL 3.0) y el SQL Server Institucional (Legacy 2008/2012) que provoca el error SSL routines::unsupported protocol durante el handshake, independientemente de la configuración del driver ODBC. Solución Implementada: La conexión requiere inyectar una configuración OpenSSL permisiva (SECLEVEL=0, UnsafeLegacyRenegotiation) ubicada en /etc/shiny-server/openssl.cnf. Nota de Implementación: Es imperativo que la variable de entorno OPENSSL_CONF apunte a este archivo antes de que inicie el proceso de Python. Además, se verificó que el archivo de configuración debe tener permisos de lectura global (chmod 644); si el archivo es solo legible por root, OpenSSL fallará silenciosamente y bloqueará la conexión. La variable ya ha sido configurada en el script activate del entorno virtual para desarrollo local.

## 3. Manejo de Datos y Rendimiento
El agente debe operar bajo reglas estrictas de consumo de datos para evitar colapsar la memoria del servidor o sufrir timeouts.

* [cite_start]**Volumen:** Las tablas contienen más de **1 millón de registros**[cite: 208].
* [cite_start]**Latencia Histórica:** La carga de datos crudos en la aplicación anterior tomaba entre **5 a 8 minutos**, provocando timeouts en la inicialización[cite: 195, 353].
* **Regla de Oro para el Agente:**
    * PROHIBIDO: `SELECT * FROM tabla`.
    * MANDATORIO: El agente solo debe ejecutar consultas de agregación (`COUNT`, `SUM`, `AVG`, `GROUP BY`) o filtrar por `TOP N`.
* [cite_start]**Timeouts:** Se deben configurar timeouts extendidos en el servidor web (FastAPI/Uvicorn), similares a los **600 segundos** configurados previamente en Shiny Server, para dar tiempo a consultas complejas[cite: 333].

## 4. Seguridad y Gestión de Credenciales
* **Variables de Entorno:** Las credenciales (`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `OPENAI_API_KEY`) deben residir exclusivamente en un archivo `.env` en el servidor. [cite_start]**Nunca** en el repositorio[cite: 87, 214].
* **Permisos de Archivos:** Históricamente, hubo problemas donde el usuario del servicio no podía leer los archivos o librerías.
    * [cite_start]Se debe asegurar que el usuario que ejecute el backend (ej. `www-data` o un usuario `agent`) tenga propiedad (`chown`) sobre la carpeta del proyecto y acceso de lectura al `.env`[cite: 8, 197].
    * [cite_start]Si se usan entornos virtuales (`venv`), asegurarse de que el usuario del servicio tenga permisos de ejecución sobre los binarios de Python[cite: 9].

## 5. Estrategia de Despliegue (CI/CD Manual)
[cite_start]Debido a que el servidor no recibe webhooks de GitHub, se debe replicar el flujo de trabajo funcional existente[cite: 101].

* **Repositorio:** GitHub (Monorepo).
* [cite_start]**Método de Actualización:** Script de shell (`deploy.sh`) ejecutado manualmente vía SSH[cite: 18].
* **Requisitos del Script de Despliegue:**
    1.  [cite_start]`git pull origin main`[cite: 119].
    2.  Actualización de dependencias (Python `pip` y Node `npm`).
    3.  Reconstrucción del frontend (`npm run build`).
    4.  [cite_start]Gestión de logs: Redireccionar logs de error estándar a archivos en `/var/log/` para depuración[cite: 27, 170].
    5.  [cite_start]Reinicio de servicios (`systemctl restart ...`)[cite: 31, 39].

## Resumen de Ficheros de Configuración Críticos Existentes
El desarrollador puede consultar estos archivos en el servidor actual como referencia de una configuración funcional:
1.  [cite_start]`/etc/odbcinst.ini`: Configuración del Driver ODBC[cite: 300].
2.  [cite_start]`/etc/shiny-server/openssl.cnf`: Configuración SSL permisiva (útil para entender qué parámetros de seguridad requiere la DB)[cite: 307].
3.  [cite_start]`/srv/shiny-server/update.sh`: Script de referencia para la lógica de actualización[cite: 14].