# streaming_events.py
"""
Helper module for emitting streaming events from tools.
This allows real-time updates to the frontend as tools execute.
"""
import queue
from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)

# Reference to the global streaming queues (set by main.py at startup)
_streaming_queues: Optional[dict] = None

def set_streaming_queues(queues: dict):
    """Set the reference to the global streaming queues dict"""
    global _streaming_queues
    _streaming_queues = queues
    logger.info("STREAMING: Tool event emitter initialized")

def emit_tool_start(chat_id: str, tool_name: str, arguments: dict):
    """Emit event when a tool starts executing"""
    if not _streaming_queues or not chat_id or chat_id not in _streaming_queues:
        return
    
    try:
        safe_args = {}
        for k, v in arguments.items():
            try:
                safe_args[k] = str(v)[:500] if v is not None else None
            except:
                safe_args[k] = "<non-serializable>"
        
        _streaming_queues[chat_id].put_nowait(("function_call", {
            "name": tool_name,
            "arguments": safe_args
        }))
    except Exception as e:
        logger.warning(f"STREAMING: Error emitting tool start: {e}")

def emit_tool_end(chat_id: str, tool_name: str, output: Any):
    """Emit event when a tool finishes executing"""
    if not _streaming_queues or not chat_id or chat_id not in _streaming_queues:
        return
    
    try:
        output_str = str(output)[:1000] if output is not None else ""
        _streaming_queues[chat_id].put_nowait(("function_call_output", {
            "name": tool_name,
            "output": output_str
        }))
    except Exception as e:
        logger.warning(f"STREAMING: Error emitting tool end: {e}")
