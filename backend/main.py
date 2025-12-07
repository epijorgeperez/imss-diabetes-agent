"""
IMSS Diabetes Agent - FastAPI Server

Exposes the epidemiology_agent via REST API endpoints:
- POST /imss-diabetes/get_response - Synchronous response
- POST /imss-diabetes/get_response_stream - SSE streaming
- GET /imss-diabetes/get_metadata - Agent metadata

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
from dotenv import load_dotenv
import threading
import inspect

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

# Thread-local storage
_thread_local = threading.local()

# --- 3. DEFINICIÓN DE FUNCIONES Y MIDDLEWARE ---

def create_agency_with_persistence(load_threads_callback=None, save_threads_callback=None):
    """Wrapper para persistencia basada en chat_id."""
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
        return create_agency(
            load_threads_callback=lambda: load_threads_for_chat(captured_chat_id),
            save_threads_callback=lambda messages: save_threads_for_chat(messages, captured_chat_id)
        )

    def load_wrapper():
        chat_id = getattr(_thread_local, 'chat_id', None)
        return load_threads_for_chat(chat_id) if chat_id else (load_threads_callback() if load_threads_callback else [])

    def save_wrapper(messages):
        chat_id = getattr(_thread_local, 'chat_id', None)
        if chat_id:
            save_threads_for_chat(messages, chat_id)
        elif save_threads_callback:
            save_threads_callback(messages)

    return create_agency(load_threads_callback=load_wrapper, save_threads_callback=save_wrapper)

try:
    from fastapi import Request
    from starlette.middleware.base import BaseHTTPMiddleware

    class ChatIdCaptureMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            if "/get_response" in str(request.url.path):
                try:
                    payload = await request.json()
                    chat_id = payload.get("chat_id")
                    if chat_id: _thread_local.chat_id = chat_id
                except Exception:
                    pass
            return await call_next(request)

except Exception as e:
    logger.warning(f"PERSISTENCE: Could not setup middleware: {e}")
    ChatIdCaptureMiddleware = None

# --- 4. CREACIÓN DE LA APP (GLOBAL) ---
# Esto ahora se ejecuta SIEMPRE al importar el archivo, solucionando el error de Systemd.

port = int(os.getenv("PORT", 8080))
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