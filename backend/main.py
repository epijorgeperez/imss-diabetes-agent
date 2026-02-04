"""
IMSS Diabetes Agent - FastAPI Server

Exposes the epidemiology_agent via REST API endpoints:
- POST /imss-diabetes/get_response - Synchronous response
- POST /imss-diabetes/get_response_stream - SSE streaming
- GET /imss-diabetes/get_metadata - Agent metadata
- POST /imss-diabetes/generate_package - Generate directive package

See API_DOCUMENTATION.md for full details.

Infrastructure Notes (Ubuntu 22.04 On-Premise):
- OPENSSL_CONF must point to legacy SSL config for SQL Server connection
- Extended timeouts (600s) for large queries (1M+ records)
- Dual network: Internet (192.168.1.66) for OpenAI, Intranet (11.124.14.201) for DB
"""
"""
IMSS Diabetes Agent - FastAPI Server
CORREGIDO: 'app' ahora es global para que Gunicorn/Uvicorn/Systemd puedan verlo.
"""
import logging
import os
import json
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv
import threading
import contextvars
import inspect
from fastapi.staticfiles import StaticFiles
from fastapi import HTTPException
from pydantic import BaseModel

load_dotenv()

# --- 1. CONFIGURACIÓN CRÍTICA SSL (LEGACY) ---
openssl_conf = os.getenv("OPENSSL_CONF", "/etc/shiny-server/openssl.cnf")
if os.path.exists(openssl_conf):
    os.environ["OPENSSL_CONF"] = openssl_conf

# --- 2. LOGGING ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from agency import create_agency, load_threads_for_chat, save_threads_for_chat
from agency_swarm import run_fastapi

# Context variable for request-scoped chat_id (safe for async concurrency)
# Usar contextvars en lugar de threading.local() para soporte multi-usuario concurrente
_chat_id_context: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar('chat_id', default=None)

# Thread-local storage (legacy, kept for asyncio.to_thread compatibility)
_thread_local = threading.local()

# --- 3. DEFINICIÓN DE FUNCIONES Y MIDDLEWARE ---

def create_agency_with_persistence(load_threads_callback=None, save_threads_callback=None):
    """Wrapper para persistencia basada en chat_id.
    
    IMPORTANTE: Este wrapper inyecta el chat_id en tres lugares:
    1. load_threads_callback - para cargar historial de conversación
    2. save_threads_callback - para guardar historial de conversación
    3. user_context - para que las herramientas accedan al chat_id y persistan datos
    """
    captured_chat_id = None
    if load_threads_callback:
        try:
            closure_vars = inspect.getclosurevars(load_threads_callback)
            for key, value in closure_vars.nonlocals.items():
                if isinstance(value, str) and len(value) > 20:
                    captured_chat_id = value
                    break
        except Exception as e:
            logger.debug(f"PERSISTENCE: Could not inspect closure: {e}")

    if captured_chat_id:
        logger.info(f"PERSISTENCE: Using captured chat_id from closure: {captured_chat_id[:8]}...")
        return create_agency(
            load_threads_callback=lambda: load_threads_for_chat(captured_chat_id),
            save_threads_callback=lambda messages: save_threads_for_chat(messages, captured_chat_id),
            user_context={"chat_id": captured_chat_id}  # ← Inyectar al contexto de herramientas
        )

    def _get_current_chat_id():
        """Obtiene chat_id de contextvars (async) o thread_local (sync)."""
        # Primero intentar contextvars (seguro para async concurrente)
        chat_id = _chat_id_context.get()
        if chat_id:
            return chat_id
        # Fallback a thread_local (para asyncio.to_thread o llamadas sync)
        return getattr(_thread_local, 'chat_id', None)

    def load_wrapper():
        chat_id = _get_current_chat_id()
        return load_threads_for_chat(chat_id) if chat_id else (load_threads_callback() if load_threads_callback else [])

    def save_wrapper(messages):
        chat_id = _get_current_chat_id()
        if chat_id:
            save_threads_for_chat(messages, chat_id)
        elif save_threads_callback:
            save_threads_callback(messages)

    # Obtener chat_id para pasarlo al user_context
    current_chat_id = _get_current_chat_id()
    if current_chat_id:
        logger.info(f"PERSISTENCE: Using chat_id: {current_chat_id[:8]}...")
    
    return create_agency(
        load_threads_callback=load_wrapper, 
        save_threads_callback=save_wrapper,
        user_context={"chat_id": current_chat_id} if current_chat_id else {}
    )

try:
    from fastapi import Request
    from starlette.middleware.base import BaseHTTPMiddleware

    class ChatIdCaptureMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            # Capturar chat_id para requests de streaming de Agency Swarm
            # NOTA: /generate_package maneja su propio chat_id directamente
            # 
            # IMPORTANTE para MULTI-USUARIO:
            # - Usamos contextvars (request-scoped) para el contexto async
            # - Usamos thread_local como backup para asyncio.to_thread()
            path = str(request.url.path)
            if "/get_response" in path and "/generate_package" not in path:
                try:
                    body = await request.body()
                    payload = json.loads(body)
                    chat_id = payload.get("chat_id")
                    if chat_id:
                        # Establecer en contextvars (seguro para async concurrente)
                        _chat_id_context.set(chat_id)
                        # También en thread_local (para compatibilidad con asyncio.to_thread)
                        _thread_local.chat_id = chat_id
                        logger.debug(f"MIDDLEWARE: Captured chat_id: {chat_id[:8]}...")
                except Exception as e:
                    logger.debug(f"MIDDLEWARE: Could not extract chat_id: {e}")
            return await call_next(request)

except Exception as e:
    logger.warning(f"PERSISTENCE: Could not setup middleware: {e}")
    ChatIdCaptureMiddleware = None

# --- 4. CREACIÓN DE LA APP (GLOBAL) ---
# Esto ahora se ejecuta SIEMPRE al importar el archivo, solucionando el error de Systemd.

port = int(os.getenv("PORT", 8001))
frontend_origin = os.getenv("FRONTEND_ORIGIN", "*")
app_token_env = os.getenv("APP_TOKEN")

if frontend_origin == "*":
    cors_origins = ["*"]
else:
    cors_origins = [origin.strip() for origin in frontend_origin.split(",")]

logger.info(f"Initializing API Config - Port: {port}")

fastapi_kwargs = {
    "agencies": {"imss-diabetes": create_agency_with_persistence},
    "port": port,
    "cors_origins": cors_origins,
    "enable_logging": True,
    "return_app": True,
}

if app_token_env:
    fastapi_kwargs["app_token_env"] = "APP_TOKEN"

# ¡AQUÍ ESTÁ LA CORRECCIÓN! 
# 'app' ahora es una variable global accesible para 'uvicorn main:app'
app = run_fastapi(**fastapi_kwargs)

if ChatIdCaptureMiddleware:
    app.add_middleware(ChatIdCaptureMiddleware)
    logger.info("PERSISTENCE: ✅ ChatIdCaptureMiddleware installed")

# --- STATIC FILES: Serve generated files (graphs, reports) ---
files_path = os.path.join(os.path.dirname(__file__), "epidemiology_agent", "files")
os.makedirs(os.path.join(files_path, "outputs"), exist_ok=True)
app.mount("/files", StaticFiles(directory=files_path), name="files")
logger.info(f"STATIC FILES: ✅ Serving files from {files_path}")

# --- CUSTOM STREAMING WITH EVENT QUEUE ---
from fastapi.responses import StreamingResponse
from pydantic import BaseModel as PydanticBaseModel
import asyncio
import queue
from concurrent.futures import ThreadPoolExecutor

# Global event queues for streaming (thread-safe Queue)
_streaming_queues: dict[str, queue.Queue] = {}
_streaming_locks: dict[str, threading.Lock] = {}

# Initialize streaming events module with our queues
try:
    from epidemiology_agent.tools.streaming_events import set_streaming_queues
    set_streaming_queues(_streaming_queues)
except Exception as e:
    logger.warning(f"STREAMING: Could not initialize streaming events: {e}")

class ChatRequest(PydanticBaseModel):
    message: str
    chat_id: str

# Note: emit_tool_event is now in epidemiology_agent/tools/streaming_events.py

# Note: Tool event emission is now handled directly in each tool
# (QueryDatabase, IPythonInterpreter, SaveOutputFile) using the
# streaming_events module.

async def stream_agency_response(message: str, chat_id: str):
    """
    Custom streaming with real-time tool events.
    Uses thread-safe queue and non-blocking reads.
    """
    import json
    
    def emit_sse(event_type: str, data: dict) -> str:
        """Format SSE event"""
        return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    
    # Create queue for this chat BEFORE starting anything
    event_queue: queue.Queue = queue.Queue()
    _streaming_queues[chat_id] = event_queue
    
    # Set chat_id context for this async context
    _chat_id_context.set(chat_id)
    
    # Flag to track if agency is done
    agency_done = threading.Event()
    agency_result = {"result": None, "error": None}
    
    def run_agency_sync():
        """Run agency in worker thread"""
        try:
            _thread_local.chat_id = chat_id
            agency = create_agency_with_persistence()
            result = agency.get_response_sync(message, context_override={"chat_id": chat_id})
            
            if hasattr(result, 'final_output'):
                agency_result["result"] = result.final_output
            else:
                agency_result["result"] = str(result)
            
        except Exception as e:
            logger.error(f"STREAMING: Error in agency: {e}")
            agency_result["error"] = str(e)
        finally:
            agency_done.set()
    
    # Start agency in background thread
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(run_agency_sync)
    
    try:
        # Stream events as they arrive
        while True:
            try:
                event_type, data = event_queue.get_nowait()
            except queue.Empty:
                if agency_done.is_set():
                    # Agency finished, drain remaining events
                    try:
                        while True:
                            event_type, data = event_queue.get_nowait()
                            yield emit_sse(event_type, data)
                    except queue.Empty:
                        pass
                    break
                await asyncio.sleep(0.05)
                continue
            
            yield emit_sse(event_type, data)
        
        if agency_result["error"]:
            yield emit_sse("error", {"message": agency_result["error"]})
        else:
            final_output = agency_result["result"] or ""
            
            # Load messages to send complete context
            thread_messages = load_threads_for_chat(chat_id)
            new_messages = []
            
            # Find the index of the last matching user message
            message_normalized = message.strip().lower()
            last_user_idx = -1
            for idx, msg in enumerate(thread_messages):
                if msg.get("role") == "user":
                    msg_content = msg.get("content", "")
                    if isinstance(msg_content, list):
                        msg_content = " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in msg_content])
                    if msg_content.strip().lower() == message_normalized:
                        last_user_idx = idx
            
            if last_user_idx >= 0:
                new_messages = thread_messages[last_user_idx + 1:]
            else:
                for idx in range(len(thread_messages) - 1, -1, -1):
                    if thread_messages[idx].get("role") == "user":
                        new_messages = thread_messages[idx + 1:]
                        break
            
            yield emit_sse("messages", {
                "new_messages": new_messages,
                "final_output": final_output
            })
            yield emit_sse("done", {})
        
    except Exception as e:
        logger.error(f"STREAMING: Error in stream: {e}")
        yield emit_sse("error", {"message": str(e)})
        
    finally:
        executor.shutdown(wait=False)
        if chat_id in _streaming_queues:
            del _streaming_queues[chat_id]

@app.post("/imss-diabetes/stream_response")
async def stream_response_endpoint(request: ChatRequest):
    """Custom SSE streaming endpoint with real-time tool events."""
    return StreamingResponse(
        stream_agency_response(request.message, request.chat_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

# --- 6. PACKAGE GENERATION ENDPOINT ---

# Load templates catalog
templates_path = os.path.join(os.path.dirname(__file__), "templates", "catalog.json")
try:
    with open(templates_path, 'r', encoding='utf-8') as f:
        TEMPLATES_CATALOG = json.load(f)
    logger.info(f"TEMPLATES: ✅ Loaded {len(TEMPLATES_CATALOG.get('templates', []))} templates")
except Exception as e:
    logger.warning(f"TEMPLATES: ⚠️ Could not load templates catalog: {e}")
    TEMPLATES_CATALOG = {"version": "1.0.0", "templates": []}


class GeographicParams(BaseModel):
    levels: List[str]
    ooadFilter: Optional[str] = None
    unidadFilter: Optional[str] = None


class PackageParams(BaseModel):
    templateId: str
    indicators: List[str]
    geographic: GeographicParams
    periodStart: int
    periodEnd: int
    granularity: str


class GeneratePackageRequest(BaseModel):
    params: PackageParams
    chatId: str


class KPIItem(BaseModel):
    label: str
    value: str
    unit: Optional[str] = None
    trend: Optional[str] = None
    trendValue: Optional[str] = None
    icon: Optional[str] = None


class ChartItem(BaseModel):
    title: str
    src: str
    alt: Optional[str] = None


class TableItem(BaseModel):
    title: str
    headers: List[str]
    rows: List[List[str]]
    footer: Optional[str] = None


class DownloadItem(BaseModel):
    label: str
    href: str
    format: str


class EmailDraft(BaseModel):
    subject: str
    body: str


class ActionItem(BaseModel):
    """Recommended action based on data findings."""
    priority: str  # "alta", "media", "baja"
    action: str
    rationale: str
    deadline: str
    owner: str


class PackagePayload(BaseModel):
    type: str = "package"
    title: str
    templateId: str
    templateName: str
    params: PackageParams
    executiveSummary: List[str]
    kpis: List[KPIItem]
    recommendedActions: List[ActionItem]  # NEW: Actions based on findings
    emailDraft: EmailDraft
    charts: List[ChartItem]
    tables: List[TableItem]
    downloads: List[DownloadItem]
    methodologyNotes: List[str]
    generatedAt: str


def get_template_by_id(template_id: str) -> Optional[dict]:
    """Find template by ID in catalog."""
    for template in TEMPLATES_CATALOG.get("templates", []):
        if template.get("id") == template_id:
            return template
    return None


def build_package_prompt(template: dict, params: PackageParams) -> str:
    """Build a structured prompt for the agent to generate package data in markdown format."""
    indicators_str = ", ".join(params.indicators) if params.indicators else "perfil integral"
    levels_str = ", ".join(params.geographic.levels)
    period_str = f"{params.periodStart}" if params.periodStart == params.periodEnd else f"{params.periodStart}-{params.periodEnd}"
    
    ooad_filter = f"\n- OOADs específicas: {params.geographic.ooadFilter}" if params.geographic.ooadFilter else ""
    unidad_filter = f"\n- Unidades específicas: {params.geographic.unidadFilter}" if params.geographic.unidadFilter else ""
    
    prompt = f"""[PACKAGE_MODE]

Genera un paquete directivo para: {template.get('name', 'Reporte')}

PARÁMETROS:
- Indicadores: {indicators_str}
- Ámbito geográfico: {levels_str}{ooad_filter}{unidad_filter}
- Periodo: {period_str}
- Granularidad: {params.granularity}

FLUJO:
1. QueryDatabase → obtener datos según los parámetros
2. IPythonInterpreter → generar gráfica(s) y guardarlas con plt.savefig()
3. SaveOutputFile → exportar datos a CSV

IMPORTANTE - Tu respuesta DEBE incluir estas secciones:
1. **Resumen Ejecutivo** - 5 puntos numerados con hallazgos clave
2. **KPIs** - Indicadores con Valor, Unidad y Tendencia (up/down/stable)
3. **Borrador de Correo** - Asunto y cuerpo completo con "Estimados..." y acciones requeridas
4. **Acciones Recomendadas** - Con prioridad [ALTA], [MEDIA] o [BAJA]
5. **Gráficas** - Links markdown: ![Desc](/files/outputs/archivo.png)
6. **Archivos** - Links: [Descargar](/files/outputs/archivo.csv)
7. **Notas Metodológicas** - Fuentes y supuestos"""
    
    return prompt


def extract_markdown_content(response_text: str, template: dict, params: PackageParams) -> dict:
    """Extract structured data from markdown response using regex patterns."""
    import re
    
    result = {
        "executive_summary": [],
        "kpis": [],
        "recommended_actions": [],
        "email_draft": {"subject": "", "body": ""},
        "charts": [],
        "tables": [],
        "downloads": [],
        "methodology_notes": []
    }
    
    # 1. Extract executive summary (numbered list items after "resumen" header)
    summary_pattern = r'(?:resumen ejecutivo|puntos clave).*?\n((?:\d+\.\s+.+\n?)+)'
    summary_match = re.search(summary_pattern, response_text, re.IGNORECASE | re.DOTALL)
    if summary_match:
        items = re.findall(r'\d+\.\s+(.+?)(?=\n\d+\.|\n\n|$)', summary_match.group(1), re.DOTALL)
        result["executive_summary"] = [item.strip().replace('**', '').replace('\n', ' ')[:500] for item in items[:5]]
    
    # 2. Extract KPIs - Multiple formats supported
    kpis_found = []
    
    # Pattern 1: Structured format "**1) Label** or **Label**\n- Valor: **X**\n- Unidad: **Y**\n- Tendencia: **Z**"
    # Updated to handle: **1) Label** or 1. **Label** or just **Label**
    kpi_block_pattern = r'\*\*(?:\d+\)\s*)?([^*]+?)\*\*\s*(?:\n|\r\n)?[-•]\s*Valor:\s*\*\*([^*]+)\*\*\s*(?:\n|\r\n)?[-•]\s*Unidad:\s*\*\*([^*]+)\*\*(?:\s*(?:\n|\r\n)?[-•]\s*Tendencia:\s*\*\*(\w+)\*\*)?'
    pattern1_matches = re.findall(kpi_block_pattern, response_text, re.IGNORECASE | re.DOTALL)
    for match in pattern1_matches:
        label, value, unit = match[0].strip(), match[1].strip(), match[2].strip()
        trend = match[3].lower() if len(match) > 3 and match[3] else "stable"
        if trend not in ["up", "down", "stable"]:
            trend = "stable"
        kpis_found.append({"label": label[:100], "value": value, "unit": unit[:50], "trend": trend})
    
    # Pattern 2: Inline format "**Label**: X unidad" or "**Label** – X unidad"  
    if not kpis_found:
        inline_pattern = r'\*\*([^*]{5,60})\*\*[:\s\-–]+([0-9][0-9,\.%]+)\s*([a-záéíóúñ%/\s]{0,30}?)(?:\s*[-–]\s*|$|\n)'
        pattern2_matches = re.findall(inline_pattern, response_text, re.IGNORECASE)
        for match in pattern2_matches:
            label, value, unit = match[0].strip(), match[1].strip(), match[2].strip()
            # Skip if label looks like a year or is too short
            if len(label) < 5 or re.match(r'^(19|20)\d{2}$', label):
                continue
            kpis_found.append({"label": label[:100], "value": value, "unit": unit[:50], "trend": "stable"})
    
    # Pattern 3: Look in KPIs section specifically
    # Updated to handle: ### 2. KPIs Clave or ## KPIs or just KPIs
    if not kpis_found:
        kpi_section = re.search(r'(?:#{1,3}\s*\d*\.?\s*)?(?:KPIs?\s*(?:Clave)?|indicadores\s*clave)[:\s]*\n([\s\S]+?)(?=\n#{2,3}\s+\d|\n---|\Z)', response_text, re.IGNORECASE)
        if kpi_section:
            section_text = kpi_section.group(1)
            # Pattern 3a: New structured format with **1) Label** and - Valor: **X**
            structured_kpis = re.findall(
                r'\*\*(?:\d+\)\s*)?([^*]+?)\*\*\s*[-•]\s*Valor:\s*\*\*([^*]+)\*\*\s*[-•]\s*Unidad:\s*\*\*([^*]+)\*\*(?:\s*[-•]\s*Tendencia:\s*\*\*(\w+)\*\*)?',
                section_text, re.IGNORECASE | re.DOTALL
            )
            for match in structured_kpis[:5]:
                label, value, unit = match[0].strip(), match[1].strip(), match[2].strip()
                trend = match[3].lower() if len(match) > 3 and match[3] else "stable"
                if trend not in ["up", "down", "stable"]:
                    trend = "stable"
                kpis_found.append({"label": label[:100], "value": value, "unit": unit[:50], "trend": trend})
            
            # Pattern 3b: Fallback - numbered items with inline values
            if not kpis_found:
                items = re.findall(r'\d+\.\s*\*?\*?([^*\n:]+)\*?\*?[:\s\-–]*([0-9][0-9,\.%]+)\s*([^\n]{0,30})', section_text)
                for label, value, rest in items[:5]:
                    unit = re.sub(r'\*\*.*', '', rest).strip()[:30]
                    kpis_found.append({"label": label.strip()[:100], "value": value.strip(), "unit": unit, "trend": "stable"})
    
    result["kpis"] = kpis_found[:5]
    
    # 3. Extract email (look for subject/body patterns)
    email_subject_match = re.search(r'(?:asunto|subject)[:\s]*["\']?([^\n"\']+)', response_text, re.IGNORECASE)
    if email_subject_match:
        result["email_draft"]["subject"] = email_subject_match.group(1).strip()[:200]
    else:
        result["email_draft"]["subject"] = f"[IMSS-Diabetes] {template.get('name', 'Reporte')}"
    
    # Look for email body (text after "cuerpo" or "body" or "Estimados")
    # Increased limit to 8000 chars to capture full email with ACCIONES REQUERIDAS
    email_body_match = re.search(r'(?:cuerpo del correo|borrador|email body)[:\s]*\n?((?:Estimados|Estimadas)[\s\S]+?)(?=\n##[^#]|\n---\n|\Z)', response_text, re.IGNORECASE)
    if email_body_match:
        result["email_draft"]["body"] = email_body_match.group(1).strip()[:8000]
    else:
        # Try to find any "Estimados" section - look for complete email including signatures
        estimados_match = re.search(r'(Estimados[/as]*[\s\S]+?(?:Saludos\s*(?:cordiales)?|Atentamente|Quedo\s+(?:a|al))[^\n]*)', response_text, re.IGNORECASE)
        if estimados_match:
            result["email_draft"]["body"] = estimados_match.group(1).strip()[:8000]
    
    # 4. Extract chart/image paths
    image_matches = re.findall(r'!\[[^\]]*\]\((/files/outputs/[^\)]+\.png)\)', response_text)
    for img in image_matches[:3]:
        result["charts"].append({"title": "", "src": img, "alt": "Gráfica generada"})
    
    # 5. Extract download links
    download_matches = re.findall(r'\[([^\]]+)\]\((/files/outputs/[^\)]+\.(csv|xlsx|pdf))\)', response_text, re.IGNORECASE)
    for label, href, fmt in download_matches[:5]:
        result["downloads"].append({"label": label, "href": href, "format": fmt.lower()})
    
    # 6. Extract methodology notes
    methodology_match = re.search(r'(?:notas metodol[oó]gicas|metodolog[ií]a)[:\s]*\n((?:\d+\.\s+.+\n?)+|(?:[-•]\s+.+\n?)+)', response_text, re.IGNORECASE)
    if methodology_match:
        notes = re.findall(r'(?:\d+\.|-|•)\s+(.+)', methodology_match.group(1))
        result["methodology_notes"] = [n.strip()[:200] for n in notes[:5]]
    
    # 7. Extract recommended actions
    actions_match = re.search(r'(?:acciones recomendadas|acciones requeridas|próximos pasos)[:\s]*\n((?:\d+\.\s+.+\n?)+|(?:[-•]\s+.+\n?)+|(?:\[(?:ALTA|MEDIA|BAJA)\].+\n?)+)', response_text, re.IGNORECASE)
    if actions_match:
        action_items = re.findall(r'(?:\[?(ALTA|MEDIA|BAJA)\]?\s*)?(?:\d+\.|-|•)?\s*(.+?)(?=\n|$)', actions_match.group(1), re.IGNORECASE)
        for priority, action_text in action_items[:4]:
            if action_text.strip():
                result["recommended_actions"].append({
                    "priority": (priority or "media").lower(),
                    "action": action_text.strip()[:200],
                    "rationale": "Basado en hallazgos del análisis",
                    "deadline": "Por definir",
                    "owner": "Responsable designado"
                })
    
    return result


def parse_package_response(response_text: str, template: dict, params: PackageParams) -> PackagePayload:
    """Parse agent response and extract structured package data.
    
    Supports multiple formats:
    1. JSON markers: PACKAGE_JSON_START...PACKAGE_JSON_END (legacy)
    2. JSON block: ```json ... ```
    3. Markdown content: Extract using regex patterns (primary method)
    """
    json_data = None
    
    # Method 1: Look for JSON markers (legacy support)
    if "PACKAGE_JSON_START" in response_text and "PACKAGE_JSON_END" in response_text:
        try:
            start = response_text.find("PACKAGE_JSON_START") + len("PACKAGE_JSON_START")
            end = response_text.find("PACKAGE_JSON_END")
            if end > start:
                json_str = response_text[start:end].strip()
                json_data = json.loads(json_str)
                logger.info("PACKAGE: Parsed JSON from markers")
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON from markers: {e}")
    
    # Method 2: Look for ```json block
    if not json_data and "```json" in response_text:
        try:
            start = response_text.find("```json") + 7
            end = response_text.find("```", start)
            if end > start:
                json_str = response_text[start:end].strip()
                json_data = json.loads(json_str)
                logger.info("PACKAGE: Parsed JSON from markdown block")
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON from markdown block: {e}")
    
    # Method 3: Extract from markdown content (most flexible approach)
    if not json_data:
        logger.info("PACKAGE: Extracting data from markdown content")
        json_data = extract_markdown_content(response_text, template, params)
    
    # Ensure all required fields have values
    if not json_data.get("executive_summary"):
        json_data["executive_summary"] = ["Análisis completado - revise los datos generados"]
    if not json_data.get("email_draft") or not json_data["email_draft"].get("body"):
        json_data["email_draft"] = {
            "subject": f"[IMSS-Diabetes] {template.get('name', 'Reporte')}",
            "body": f"Estimados,\n\nAdjunto el reporte de {template.get('name', 'análisis')}.\n\nSaludos cordiales"
        }
    if not json_data.get("methodology_notes"):
        json_data["methodology_notes"] = ["Generado automáticamente"]
    
    # Extract title (use from JSON or build from template)
    title = json_data.get("title") or f"{template.get('name', 'Reporte')} - {params.periodStart if params.periodStart == params.periodEnd else f'{params.periodStart}-{params.periodEnd}'}"
    
    # Build package payload
    return PackagePayload(
        type="package",
        title=title,
        templateId=params.templateId,
        templateName=template.get('name', 'Reporte'),
        params=params,
        executiveSummary=json_data.get("executive_summary", []),
        kpis=[KPIItem(**kpi) for kpi in json_data.get("kpis", [])],
        recommendedActions=[ActionItem(**action) for action in json_data.get("recommended_actions", [])],
        emailDraft=EmailDraft(**json_data.get("email_draft", {"subject": "", "body": ""})),
        charts=[ChartItem(**chart) for chart in json_data.get("charts", [])],
        tables=[TableItem(**table) for table in json_data.get("tables", [])],
        downloads=[DownloadItem(**dl) for dl in json_data.get("downloads", [])],
        methodologyNotes=json_data.get("methodology_notes", []),
        generatedAt=json_data.get("generated_at") or datetime.now().isoformat()
    )


@app.get("/imss-diabetes/templates")
async def get_templates():
    """Return available templates catalog."""
    return TEMPLATES_CATALOG


@app.post("/imss-diabetes/generate_package")
async def generate_package(request: GeneratePackageRequest):
    """Generate a directive package based on template and parameters."""
    logger.info(f"PACKAGE: Generating package for template {request.params.templateId}")
    
    # Find template
    template = get_template_by_id(request.params.templateId)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template not found: {request.params.templateId}")
    
    # Build prompt
    prompt = build_package_prompt(template, request.params)
    
    # Set chat_id for persistence
    _thread_local.chat_id = request.chatId
    
    try:
        # Create agency and get response
        # Use asyncio.to_thread to run sync function from async context
        # (get_response_sync internally uses asyncio.run which can't be called from running loop)
        import asyncio
        
        # IMPORTANTE para MULTI-USUARIO:
        # 1. Capturar chatId en variable local (closure capture)
        # 2. Establecer en contextvars (para código async antes del thread)
        # 3. Establecer en thread_local DENTRO del thread worker
        captured_chat_id = request.chatId
        _chat_id_context.set(captured_chat_id)  # Para código async
        
        def run_agency_sync():
            # Establecer el chat_id en el thread worker (thread_local no se hereda)
            _thread_local.chat_id = captured_chat_id
            logger.info(f"PACKAGE: Thread-local chat_id set to {captured_chat_id[:8]}...")
            
            agency = create_agency_with_persistence()
            # Pasar context_override con chat_id para que las herramientas lo usen
            return agency.get_response_sync(
                prompt, 
                context_override={"chat_id": captured_chat_id}
            )
        
        result = await asyncio.to_thread(run_agency_sync)
        
        # Extract string from RunResult object
        if hasattr(result, 'final_output'):
            response_text = result.final_output
        elif hasattr(result, 'output'):
            response_text = result.output
        elif isinstance(result, str):
            response_text = result
        else:
            response_text = str(result)
        
        logger.info(f"PACKAGE: Got response of length {len(response_text)}")
        
        # Parse response into structured package
        package = parse_package_response(response_text, template, request.params)
        
        logger.info(f"PACKAGE: Successfully generated package: {package.title}")
        return {"success": True, "package": package.model_dump()}
        
    except Exception as e:
        logger.error(f"PACKAGE: Error generating package: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- 5. EJECUCIÓN MANUAL (SOLO PARA DEBUG) ---
if __name__ == "__main__":
    import uvicorn
    # Ya no creamos 'app' aquí, usamos la global
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        timeout_keep_alive=600,
    )