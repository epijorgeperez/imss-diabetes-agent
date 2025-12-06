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
import logging
import os
from dotenv import load_dotenv

load_dotenv()

# CRITICAL: Configure OpenSSL for legacy SQL Server BEFORE any imports that use SSL
# Ubuntu 22.04 (OpenSSL 3.0) blocks legacy protocols by default
# The config file must have SECLEVEL=0 and UnsafeLegacyRenegotiation=yes
openssl_conf = os.getenv("OPENSSL_CONF", "/etc/shiny-server/openssl.cnf")
if os.path.exists(openssl_conf):
    os.environ["OPENSSL_CONF"] = openssl_conf
    
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from agency import create_agency, load_threads_for_chat, save_threads_for_chat
from agency_swarm import run_fastapi
import threading
import inspect

# Thread-local storage to capture chat_id from request
_thread_local = threading.local()


def create_agency_with_persistence(load_threads_callback=None, save_threads_callback=None):
    """
    Wrapper that creates the agency with chat_id-based persistence.
    
    Agency Swarm FastAPI passes callbacks with chat_id in closures.
    We extract it or use thread-local storage as fallback.
    """
    # Try to extract chat_id from Agency Swarm's callback closure
    captured_chat_id = None
    if load_threads_callback:
        try:
            closure_vars = inspect.getclosurevars(load_threads_callback)
            # Look for chat_id in the closure nonlocals
            for key, value in closure_vars.nonlocals.items():
                if isinstance(value, str) and len(value) > 20:  # UUID-like
                    captured_chat_id = value
                    logger.info(f"PERSISTENCE: ✅ Extracted chat_id from closure: {captured_chat_id[:8]}...")
                    break
        except Exception as e:
            logger.debug(f"PERSISTENCE: Could not inspect closure: {e}")
    
    # If we found chat_id in closure, use it
    if captured_chat_id:
        return create_agency(
            load_threads_callback=lambda: load_threads_for_chat(captured_chat_id),
            save_threads_callback=lambda messages: save_threads_for_chat(messages, captured_chat_id)
        )
    
    # Fallback: Use thread-local storage (set by middleware)
    def load_wrapper():
        chat_id = getattr(_thread_local, 'chat_id', None)
        if chat_id:
            logger.info(f"PERSISTENCE: ✅ Using chat_id from thread-local: {chat_id[:8]}...")
            return load_threads_for_chat(chat_id)
        elif load_threads_callback:
            logger.warning("PERSISTENCE: ⚠️ No chat_id, using provided callback")
            return load_threads_callback()
        logger.warning("PERSISTENCE: ⚠️ No chat_id available, returning empty")
        return []
    
    def save_wrapper(messages):
        chat_id = getattr(_thread_local, 'chat_id', None)
        if chat_id:
            logger.info(f"PERSISTENCE: ✅ Saving messages for chat_id: {chat_id[:8]}...")
            save_threads_for_chat(messages, chat_id)
        elif save_threads_callback:
            logger.warning("PERSISTENCE: ⚠️ No chat_id, using provided callback")
            save_threads_callback(messages)
        else:
            logger.warning("PERSISTENCE: ⚠️ No chat_id available, messages not saved")
    
    return create_agency(
        load_threads_callback=load_wrapper,
        save_threads_callback=save_wrapper
    )


# Middleware to capture chat_id from request payload
try:
    from fastapi import Request
    from starlette.middleware.base import BaseHTTPMiddleware
    
    class ChatIdCaptureMiddleware(BaseHTTPMiddleware):
        """Captures chat_id from request body and stores in thread-local"""
        
        async def dispatch(self, request: Request, call_next):
            path = str(request.url.path)
            if "/get_response" in path or "/get_response_stream" in path:
                try:
                    # Read and cache the request body
                    payload = await request.json()
                    chat_id = payload.get("chat_id")
                    if chat_id and isinstance(chat_id, str):
                        _thread_local.chat_id = chat_id
                        logger.info(f"PERSISTENCE: 📝 Captured chat_id from request: {chat_id[:8]}...")
                except Exception as e:
                    logger.debug(f"PERSISTENCE: Could not extract chat_id: {e}")
            
            response = await call_next(request)
            return response
    
    logger.info("PERSISTENCE: ChatIdCaptureMiddleware ready")
    
except Exception as e:
    logger.warning(f"PERSISTENCE: Could not setup middleware: {e}")
    ChatIdCaptureMiddleware = None


if __name__ == "__main__":
    # Configuration from environment
    port = int(os.getenv("PORT", 8080))
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "*")
    app_token_env = os.getenv("APP_TOKEN")
    
    # Parse CORS origins
    if frontend_origin == "*":
        cors_origins = ["*"]
    else:
        cors_origins = [origin.strip() for origin in frontend_origin.split(",")]
    
    logger.info(f"Starting IMSS Diabetes Agent API on port {port}")
    logger.info(f"CORS origins: {cors_origins}")
    logger.info(f"Auth: {'enabled' if app_token_env else 'disabled (no APP_TOKEN set)'}")
    logger.info(f"PERSISTENCE: Enabled (files/thread_state/)")
    
    # Build FastAPI kwargs
    fastapi_kwargs = {
        "agencies": {"imss-diabetes": create_agency_with_persistence},
        "port": port,
        "cors_origins": cors_origins,
        "enable_logging": True,
        "return_app": True,  # Return app to add middleware
    }
    
    # Only add auth if APP_TOKEN is set
    if app_token_env:
        fastapi_kwargs["app_token_env"] = "APP_TOKEN"
    
    # Get FastAPI app
    app = run_fastapi(**fastapi_kwargs)
    
    # Add middleware to capture chat_id from requests
    if ChatIdCaptureMiddleware:
        app.add_middleware(ChatIdCaptureMiddleware)
        logger.info("PERSISTENCE: ✅ ChatIdCaptureMiddleware installed")
    
    # Start server manually with extended timeouts
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        timeout_keep_alive=600,  # 600s for large SQL queries
    )