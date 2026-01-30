# 📖 Developer Handbook - Agente Analítico de Diabetes IMSS

> Guía rápida para desarrolladores que necesiten modificar, extender o mantener el sistema.

---

## 1. Descripción General del Sistema

### ¿Qué es?
Un **agente de IA autónomo** que permite a usuarios del IMSS consultar datos epidemiológicos de diabetes usando lenguaje natural. El sistema genera análisis estadísticos, gráficos, reportes PDF y "paquetes directivos" estructurados.

### Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO                                  │
│                    (Red IMSS/Intranet)                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP
┌─────────────────────▼───────────────────────────────────────────┐
│                    FRONTEND (Next.js)                            │
│  • Chat UI (streaming)                                          │
│  • Biblioteca de Plantillas                                     │
│  • Renderizado de Paquetes (PackageCard)                        │
│  Puerto: 3000                                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ REST API / SSE Stream
┌─────────────────────▼───────────────────────────────────────────┐
│                    BACKEND (FastAPI + Python)                    │
│  • Endpoints: /get_response_stream, /generate_package           │
│  • Agency Swarm Framework (orquestación de agentes)             │
│  Puerto: 8001                                                   │
└──────────┬─────────────────────────────────┬────────────────────┘
           │                                 │
           ▼                                 ▼
┌──────────────────────┐         ┌────────────────────────────────┐
│    SQL Server IMSS   │         │        OpenAI API              │
│  (Datos reales)      │         │  (Solo razonamiento)           │
│  Red Intranet        │         │  Red Internet                  │
└──────────────────────┘         └────────────────────────────────┘
```

### Flujo de Datos Simplificado

```
Usuario pregunta → Frontend → Backend → Agente IA decide:
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
            QueryDatabase             IPythonInterpreter          GenerateReport
            (consulta SQL)            (análisis + gráficas)       (PDF)
                    │                         │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              ▼
                                    Respuesta estructurada
                                              │
                                              ▼
                              Frontend renderiza (chat o PackageCard)
```

---

## 2. Estructura de Directorios

```
imss-diabetes-agent/
├── backend/                          # Servidor Python
│   ├── main.py                       # ⭐ API Gateway (FastAPI)
│   ├── agency.py                     # ⭐ Configuración de Agency Swarm
│   ├── requirements.txt              # Dependencias Python
│   ├── templates/
│   │   └── catalog.json              # ⭐ Catálogo de plantillas
│   ├── epidemiology_agent/           # El agente especializado
│   │   ├── epidemiology_agent.py     # Definición del agente
│   │   ├── instructions.md           # ⭐ Prompt del sistema (comportamiento)
│   │   ├── tools/                    # Herramientas del agente
│   │   │   ├── QueryDatabase.py      # Consultas SQL
│   │   │   ├── IPythonInterpreter.py # Código Python/gráficas
│   │   │   ├── SaveOutputFile.py     # Guardar CSV/Excel
│   │   │   ├── GenerateReportTool.py # ⭐ Generar PDFs
│   │   │   └── LoadImages.py         # Ver gráficas generadas
│   │   └── files/
│   │       └── outputs/              # Archivos generados (.png, .csv, .pdf)
│   └── files/
│       └── thread_state/             # Historial de conversaciones
│
├── frontend/                         # Cliente Next.js
│   ├── app/
│   │   └── page.tsx                  # Página principal
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatInterface.tsx     # ⭐ Orquestador principal UI
│   │   │   ├── MessageList.tsx       # Lista de mensajes
│   │   │   └── ModeToggle.tsx        # Toggle Paquetes/Exploración
│   │   ├── packages/
│   │   │   ├── PackageCard.tsx       # ⭐ Tarjeta de paquete directivo
│   │   │   ├── KPIDisplay.tsx        # Renderizado de KPIs
│   │   │   ├── EmailDraft.tsx        # Borrador de correo
│   │   │   └── ActionItems.tsx       # Acciones recomendadas
│   │   ├── templates/
│   │   │   ├── TemplateLibrary.tsx   # ⭐ Catálogo visual de plantillas
│   │   │   └── TemplateConfigPanel.tsx # Configurador de parámetros
│   │   └── studio/                   # Selectores de parámetros
│   ├── hooks/
│   │   ├── useAgencyStream.ts        # ⭐ Streaming de respuestas
│   │   └── usePackageGenerator.ts    # Generación de paquetes
│   ├── lib/
│   │   └── api-client.ts             # ⭐ Configuración de endpoints
│   └── types/
│       ├── package.ts                # ⭐ Tipos de paquetes y plantillas
│       └── chat.ts                   # Tipos de mensajes
```

---

## 3. Archivos Clave y Qué Modificar

### 🎯 Cambios de Comportamiento del Agente

| Quiero cambiar... | Archivo a modificar |
|-------------------|---------------------|
| Cómo responde el agente, su personalidad, reglas | `backend/epidemiology_agent/instructions.md` |
| Qué modelo de IA usa (GPT-4, etc.) | `backend/epidemiology_agent/epidemiology_agent.py` |
| Consultas SQL permitidas/bloqueadas | `backend/epidemiology_agent/tools/QueryDatabase.py` |
| Formato de gráficas (colores, estilos) | `backend/epidemiology_agent/tools/IPythonInterpreter.py` |
| Diseño del PDF (logos, colores IMSS) | `backend/epidemiology_agent/tools/GenerateReportTool.py` |

### 📦 Cambios en Paquetes Directivos

| Quiero cambiar... | Archivo a modificar |
|-------------------|---------------------|
| Agregar/modificar plantillas | `backend/templates/catalog.json` |
| Prompt que genera el paquete | `backend/main.py` → función `build_package_prompt()` |
| Cómo se parsea la respuesta del agente | `backend/main.py` → función `parse_package_response()` |
| Estructura del paquete (tipos) | `frontend/types/package.ts` |
| Cómo se ve la tarjeta del paquete | `frontend/components/packages/PackageCard.tsx` |
| KPIs, correo, acciones | `frontend/components/packages/*.tsx` |

### 🖥️ Cambios en UI/Frontend

| Quiero cambiar... | Archivo a modificar |
|-------------------|---------------------|
| Endpoint del backend | `frontend/lib/api-client.ts` |
| Flujo principal de la app | `frontend/components/chat/ChatInterface.tsx` |
| Renderizado de markdown/texto | `frontend/components/chat/MarkdownRenderer.tsx` |
| Colores institucionales (UI) | `frontend/components/templates/TemplateLibrary.tsx` |
| Selectores de parámetros | `frontend/components/studio/*.tsx` |

---

## 4. Guías de Modificación Comunes

### 4.1 Agregar una Nueva Plantilla

**Paso 1:** Editar `backend/templates/catalog.json`

```json
{
  "id": "mi-nueva-plantilla",
  "name": "Nombre visible para usuario",
  "description": "Descripción que aparece en la tarjeta",
  "category": "incidencia",  // incidencia|prevalencia|mortalidad|hospitalizacion|integral|comparativo
  "audience": ["ooad", "central"],  // quién puede usarla
  "requiredParams": ["ambito", "periodo"],
  "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
  "defaultIndicators": ["incidencia"],
  "constraints": {
    "granularity": "mensual",
    "minPeriodMonths": 12,
    "allowedLevels": ["OOAD"]
  },
  "icon": "activity"  // Lucide icon name
}
```

**Paso 2:** El frontend lo cargará automáticamente desde el endpoint `/templates`.

---

### 4.2 Modificar el Comportamiento del Agente

Editar `backend/epidemiology_agent/instructions.md`:

```markdown
# Role
Eres un **Epidemiólogo Experto**...

# Modo Paquete Directivo [PACKAGE_MODE]
Cuando recibas `[PACKAGE_MODE]`, genera un paquete con esta estructura:
...

# Reglas Importantes
- SIEMPRE usa agregaciones (COUNT, SUM, AVG)
- NUNCA expongas datos individuales de pacientes
...
```

**Tip:** Este archivo es el "system prompt" del agente. Cambios aquí afectan TODAS las respuestas.

---

### 4.3 Cambiar el Diseño del PDF

Editar `backend/epidemiology_agent/tools/GenerateReportTool.py`:

```python
class EstiloInstitucional:
    """Colores institucionales en RGB"""
    NEGRO = (34, 34, 35)
    VERDE_IMSS = (0, 89, 76)       # Encabezados
    ROJO_GOB = (155, 34, 66)       # Títulos
    DORADO_IMSS = (173, 132, 31)   # Subtítulos
```

Para cambiar el logo: reemplazar `backend/epidemiology_agent/files/assets/logo_imss.png`

---

### 4.4 Agregar un Campo al Paquete

**Paso 1:** Frontend - Agregar tipo en `frontend/types/package.ts`:

```typescript
export interface PackagePayload {
  // ... campos existentes
  miNuevoCampo: string[]  // Nuevo campo
}
```

**Paso 2:** Frontend - Renderizar en `frontend/components/packages/PackageCard.tsx`:

```tsx
{packageData.miNuevoCampo && (
  <section>
    <h4>Mi Nuevo Campo</h4>
    {packageData.miNuevoCampo.map((item, i) => (
      <p key={i}>{item}</p>
    ))}
  </section>
)}
```

**Paso 3:** Backend - Agregar al parser en `backend/main.py`:

```python
# En parse_package_response() o extract_markdown_content()
result["mi_nuevo_campo"] = [...]  # Extraer del markdown
```

**Paso 4:** Backend - Actualizar el modelo Pydantic en `backend/main.py`:

```python
class PackagePayload(BaseModel):
    # ... campos existentes
    miNuevoCampo: List[str] = []
```

---

### 4.5 Modificar Cómo se Extraen Datos del Markdown

El agente genera respuestas en markdown. El parser las convierte a JSON estructurado.

Editar `backend/main.py` → función `extract_markdown_content()`:

```python
def extract_markdown_content(response_text: str, template: dict, params: PackageParams) -> dict:
    import re
    
    # Extraer resumen ejecutivo (lista numerada)
    summary_pattern = r'(?:resumen ejecutivo).*?\n((?:\d+\.\s+.+\n?)+)'
    summary_match = re.search(summary_pattern, response_text, re.IGNORECASE)
    
    # Extraer KPIs
    kpi_patterns = [
        r'\*\*([^*]+)\*\*\s*[-–:]\s*(?:Valor:?\s*)?(\d+[\d,\.]*)',
    ]
    
    # ... más patrones regex
```

---

## 5. API Endpoints

### Backend (FastAPI) - Puerto 8001

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/imss-diabetes/get_response_stream` | POST | Chat con streaming (SSE) |
| `/imss-diabetes/generate_package` | POST | Genera paquete directivo |
| `/imss-diabetes/templates` | GET | Catálogo de plantillas |
| `/files/outputs/*` | GET | Archivos estáticos (gráficas, CSV) |

### Ejemplo de Request para Paquete

```javascript
POST /imss-diabetes/generate_package
{
  "templateId": "comite-incidencia-ooad",
  "params": {
    "indicators": ["incidencia"],
    "geographic": {
      "levels": ["OOAD"],
      "ooadFilter": "Jalisco"
    },
    "periodStart": 2024,
    "periodEnd": 2025,
    "granularity": "mensual"
  },
  "chatId": "uuid-de-sesion"
}
```

---

## 6. Herramientas del Agente (Tools)

El agente tiene acceso a estas herramientas que puede invocar autónomamente:

| Herramienta | Archivo | Función |
|-------------|---------|---------|
| `QueryDatabase` | `tools/QueryDatabase.py` | Ejecuta SELECT en SQL Server |
| `GetDatabaseSchema` | `tools/GetDatabaseSchema.py` | Obtiene estructura de tablas |
| `IPythonInterpreter` | `tools/IPythonInterpreter.py` | Ejecuta código Python (análisis, gráficas) |
| `SaveOutputFile` | `tools/SaveOutputFile.py` | Guarda CSV/Excel |
| `GenerateReportTool` | `tools/GenerateReportTool.py` | Genera PDF institucional |
| `LoadImages` | `tools/LoadImages.py` | Carga imágenes generadas |

### Agregar Nueva Herramienta

1. Crear archivo en `backend/epidemiology_agent/tools/MiNuevaHerramienta.py`
2. Heredar de `BaseTool` (Agency Swarm)

```python
from agency_swarm.tools import BaseTool
from pydantic import Field

class MiNuevaHerramienta(BaseTool):
    """
    Descripción que el agente usará para decidir cuándo usar esta herramienta.
    """
    parametro1: str = Field(..., description="Descripción del parámetro")
    parametro2: int = Field(default=10, description="Parámetro opcional")

    def run(self):
        # Lógica de la herramienta
        resultado = hacer_algo(self.parametro1, self.parametro2)
        return f"Resultado: {resultado}"
```

3. Agency Swarm auto-descubre herramientas en la carpeta `tools/`

---

## 7. Variables de Entorno

### Backend (`.env`)

```env
# Base de datos
DB_SERVER=11.33.41.96
DB_NAME=DAS_DM
DB_USER=usuario_lectura
DB_PASSWORD=contraseña_segura

# OpenAI
OPENAI_API_KEY=sk-...

# SSL para SQL Server Legacy
OPENSSL_CONF=/etc/shiny-server/openssl.cnf
```

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_API_TOKEN=opcional
```

---

## 8. Comandos de Desarrollo

### Backend

```bash
cd backend

# Activar entorno virtual
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor
python main.py
# o
uvicorn main:app --reload --port 8001
```

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build producción
npm run build
npm start
```

---

## 9. Debugging Tips

### Ver qué está haciendo el agente

```python
# En backend/main.py, agregar logs:
logger.info(f"Prompt enviado: {prompt[:500]}")
logger.info(f"Respuesta del agente: {response_text[:1000]}")
```

### Ver herramientas disponibles

```python
# En agency.py o main.py
agent = agency.get_agents()[0]
print([t.__name__ for t in agent.tools])
```

### Probar herramienta individualmente

```bash
python backend/epidemiology_agent/tools/QueryDatabase.py
# Cada herramienta tiene un if __name__ == "__main__" para testing
```

### Logs del frontend

- Abrir DevTools (F12) → Console
- Network tab para ver requests/responses

---

## 10. Flujo de Generación de Paquete (Detallado)

```
1. Usuario selecciona plantilla en TemplateLibrary
                    │
2. TemplateConfigPanel muestra formulario con parámetros
                    │
3. Click "Generar Paquete"
                    │
4. usePackageGenerator.ts → POST /generate_package
                    │
5. main.py recibe request
   │
   ├── build_package_prompt() → Construye prompt con [PACKAGE_MODE]
   │
   └── agency.get_response_sync(prompt)
       │
       ├── Agente ejecuta QueryDatabase (datos)
       ├── Agente ejecuta IPythonInterpreter (gráficas)
       ├── Agente ejecuta SaveOutputFile (CSV)
       └── Agente responde en markdown estructurado
                    │
6. parse_package_response() → Extrae datos del markdown
                    │
7. Retorna PackagePayload (JSON estructurado)
                    │
8. Frontend recibe respuesta
                    │
9. ChatInterface agrega mensaje con packageData
                    │
10. PackageCard renderiza el paquete completo
```

---

## 11. Persistencia, Contexto y Memoria

### Arquitectura de Persistencia

El sistema tiene **tres niveles de persistencia**, cada uno con un propósito diferente:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NIVELES DE PERSISTENCIA                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. THREAD STATE (Historial de conversación)                        │
│     📁 backend/files/thread_state/messages_{chat_id}.json           │
│     • Mensajes de usuario y asistente                               │
│     • Tool calls y tool outputs (resultados de herramientas)        │
│     • Se guarda/carga por chat_id                                   │
│                                                                     │
│  2. QUERY CACHE (Resultados de SQL)                                 │
│     📁 backend/epidemiology_agent/files/query_cache/                │
│     • results_{chat_id}.json                                        │
│     • Última consulta SQL ejecutada                                 │
│     • Usado por IPythonInterpreter para acceder a `query_results`   │
│                                                                     │
│  3. NAMESPACE CACHE (Variables Python)                              │
│     📁 backend/epidemiology_agent/files/namespace_cache/            │
│     • namespace_{chat_id}.pkl                                       │
│     • DataFrames, variables calculadas, etc.                        │
│     • Permite continuidad entre mensajes (ej: usar `df` que ya      │
│       se creó en mensaje anterior)                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Flujo del `chat_id`

El `chat_id` es **crítico** para aislar conversaciones. Así fluye por el sistema:

```
Frontend (useChatId hook)
    │
    │ localStorage.getItem('imss_diabetes_chat_id')
    │
    ▼
Request HTTP
    │ body: { message, chat_id: "abc-123-..." }
    │
    ▼
Middleware (ChatIdCaptureMiddleware)
    │ _thread_local.chat_id = payload.get("chat_id")
    │
    ▼
create_agency_with_persistence()
    │ • Lee _thread_local.chat_id
    │ • Crea Agency con user_context={"chat_id": chat_id}
    │ • Configura load/save callbacks por chat_id
    │
    ▼
Herramientas (QueryDatabase, IPythonInterpreter)
    │ chat_id = self.context.get("chat_id")
    │ • Guardan/cargan de results_{chat_id}.json
    │ • Guardan/cargan de namespace_{chat_id}.pkl
    │
    ▼
Thread State
    │ Se guarda en messages_{chat_id}.json
```

### Archivos Clave de Persistencia

| Archivo | Propósito | Qué contiene |
|---------|-----------|--------------|
| `backend/main.py` | Middleware y wrappers | `ChatIdCaptureMiddleware`, `create_agency_with_persistence()` |
| `backend/agency.py` | Callbacks de persistencia | `load_threads_for_chat()`, `save_threads_for_chat()` |
| `tools/QueryDatabase.py` | Cache de queries | `_get_chat_id()`, `_persist_results()` |
| `tools/IPythonInterpreter.py` | Cache de namespace | `_get_chat_id()`, `_load_namespace_from_cache()`, `_save_namespace_to_cache()` |

### Cómo el Agente "Recuerda" Conversaciones Previas

1. **Historial de mensajes:** Agency Swarm carga `messages_{chat_id}.json` al inicio de cada request
2. **Tool outputs:** Los resultados de herramientas se incluyen en el historial como `function_call_output`
3. **Datos raw:** Si el agente necesita re-procesar datos (nuevo código Python), los carga del cache

**Ejemplo de thread state con tool outputs:**

```json
[
  {"role": "user", "content": "Dame incidencia de Jalisco 2024"},
  {
    "type": "function_call",
    "name": "QueryDatabase",
    "arguments": "{\"sql_query\": \"SELECT ...\"}"
  },
  {
    "type": "function_call_output",
    "output": "[OK] Query executed (35 filas).\n\n| OOAD | Casos | Tasa |..."
  },
  {"role": "assistant", "content": "La incidencia en Jalisco..."}
]
```

### ✅ Soporte Multi-Usuario Concurrente

El sistema soporta múltiples usuarios con múltiples conversaciones simultáneas usando una combinación de:

1. **`contextvars.ContextVar`** - Para código async (request-scoped, seguro para concurrencia)
2. **`threading.local`** - Para código sync en `asyncio.to_thread()` (thread-scoped)

```python
# main.py
from contextvars import ContextVar

# Context variable (seguro para async concurrente)
_chat_id_context: ContextVar[Optional[str]] = ContextVar('chat_id', default=None)

# Thread-local (para asyncio.to_thread)
_thread_local = threading.local()
```

**¿Por qué ambos?**
- `contextvars` mantiene el valor por request en código async
- `threading.local` es necesario porque `asyncio.to_thread()` ejecuta en un thread pool separado

### ⚠️ Gotcha: Thread-Local y `asyncio.to_thread`

**Problema:** `_thread_local` NO se comparte entre threads, y `contextvars` NO se propaga a threads nuevos por defecto.

```python
# ❌ INCORRECTO - chat_id no estará disponible en run_agency_sync
_thread_local.chat_id = request.chatId  # Thread del event loop

def run_agency_sync():
    # Este código corre en OTRO THREAD del pool
    agency = create_agency_with_persistence()  # chat_id será None!
    return agency.get_response_sync(prompt)

result = await asyncio.to_thread(run_agency_sync)
```

```python
# ✅ CORRECTO - capturar antes, establecer dentro del thread
captured_chat_id = request.chatId
_chat_id_context.set(captured_chat_id)  # Para código async antes del thread

def run_agency_sync():
    _thread_local.chat_id = captured_chat_id  # Establecer en ESTE thread
    agency = create_agency_with_persistence()
    return agency.get_response_sync(prompt, context_override={"chat_id": captured_chat_id})

result = await asyncio.to_thread(run_agency_sync)
```

### Cómo se obtiene el chat_id

```python
def _get_current_chat_id():
    """Obtiene chat_id de contextvars (async) o thread_local (sync)."""
    # 1. Intentar contextvars (request-scoped, seguro para async)
    chat_id = _chat_id_context.get()
    if chat_id:
        return chat_id
    # 2. Fallback a thread_local (para asyncio.to_thread)
    return getattr(_thread_local, 'chat_id', None)
```

### Debugging de Persistencia

**1. Ver qué chat_id se está usando:**

```python
# En QueryDatabase.py o IPythonInterpreter.py
def _get_chat_id(self) -> str:
    chat_id = self.context.get("chat_id")
    print(f"[DEBUG] chat_id = {chat_id}")  # Debería ser UUID, no "default"
    return chat_id or "default"
```

**2. Verificar archivos de cache:**

```bash
# ¿Hay archivos por chat_id o solo "default"?
ls backend/epidemiology_agent/files/query_cache/
# Esperado: results_abc123.json, results_def456.json, ...
# Problema: Solo results_default.json

ls backend/files/thread_state/
# Esperado: messages_abc123.json, messages_def456.json, ...
```

**3. Inspeccionar thread state:**

```bash
# Ver historial de una conversación
cat backend/files/thread_state/messages_{chat_id}.json | jq '.'

# Buscar tool outputs
cat backend/files/thread_state/messages_{chat_id}.json | jq '.[] | select(.type == "function_call_output")'
```

**4. Logs en tiempo real:**

```python
# En main.py
logger.info(f"MIDDLEWARE: chat_id = {chat_id}")
logger.info(f"PERSISTENCE: Loading thread for {chat_id}")
```

### Limpiar Cache (Para Testing)

```bash
# Eliminar todos los caches (reinicia todas las conversaciones)
rm -rf backend/epidemiology_agent/files/query_cache/*
rm -rf backend/epidemiology_agent/files/namespace_cache/*
rm -rf backend/files/thread_state/*
```

### Extender la Persistencia

Para agregar nuevos datos persistentes por conversación:

1. **Usar el patrón existente:**

```python
# En tu herramienta
def _get_chat_id(self) -> str:
    if not hasattr(self, 'context') or self.context is None:
        return "default"
    return self.context.get("chat_id") or "default"

def _save_my_data(self, data):
    chat_id = self._get_chat_id()
    cache_file = MY_CACHE_DIR / f"mydata_{chat_id}.json"
    with open(cache_file, "w") as f:
        json.dump(data, f)
```

2. **O usar el MasterContext directamente:**

```python
# Guardar en memoria compartida (solo durante la sesión)
self.context.set("mi_variable", valor)

# Leer
valor = self.context.get("mi_variable", default=None)
```

---

## 12. Consideraciones de Seguridad

1. **Datos sensibles NUNCA salen a Internet** - El LLM solo recibe esquemas y preguntas
2. **Solo consultas SELECT** - El agente está instruido para solo leer datos
3. **Agregaciones obligatorias** - No se extraen registros individuales
4. **Credenciales en `.env`** - Nunca en código fuente
5. **Red dual** - Intranet para BD, Internet solo para API de IA

---

## 13. Contacto y Recursos

- **Framework de Agentes:** [Agency Swarm Docs](https://agency-swarm.ai)
- **UI Components:** [Shadcn/UI](https://ui.shadcn.com)
- **Iconos:** [Lucide Icons](https://lucide.dev/icons)
