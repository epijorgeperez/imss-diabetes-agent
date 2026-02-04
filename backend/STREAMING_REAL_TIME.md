# Real-Time Streaming Implementation

## Problema

El endpoint default de Agency Swarm (`/get_response_stream`) emite todos los eventos al final en un solo paquete `messages`, en lugar de emitir eventos conforme ocurren. Esto causa que el frontend no pueda mostrar las llamadas a herramientas en tiempo real.

## Solución

Se implementó un sistema de streaming en tiempo real que intercepta las ejecuciones de herramientas y emite eventos SSE conforme ocurren.

### Arquitectura

```
┌─────────────┐
│  Frontend   │
│  (useAgencyStream)
└──────┬──────┘
       │ POST /imss-diabetes/stream_response
       │ SSE Connection
       ▼
┌─────────────────────────────────────┐
│  Backend - stream_agency_response   │
│  - Crea event_queue                 │
│  - Ejecuta agency en background     │
│  - Lee eventos de queue y emite SSE │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Agency Execution (background)      │
│  - create_agency_with_persistence() │
│  - agency.get_response_sync()       │
└──────┬──────────────────────────────┘
       │ Llama herramientas
       ▼
┌─────────────────────────────────────┐
│  Tool Execution (wrapped)           │
│  - wrapped_run() intercepta         │
│  - Emite "function_call" al queue   │
│  - Ejecuta tool.run()               │
│  - Emite "function_call_output"     │
└─────────────────────────────────────┘
```

### Implementación

#### 1. Monkey-Patching de Herramientas

```python
def wrap_tool_run(tool_class):
    """Wrap a tool's run method to emit events"""
    original_run = tool_class.run
    
    def wrapped_run(self):
        chat_id = getattr(_thread_local, 'chat_id', None)
        
        if chat_id:
            # Emitir evento ANTES de ejecutar
            emit_tool_event(chat_id, "function_call", {
                "name": self.__class__.__name__,
                "arguments": {...}
            })
        
        # Ejecutar herramienta
        result = original_run(self)
        
        if chat_id:
            # Emitir evento DESPUÉS de ejecutar
            emit_tool_event(chat_id, "function_call_output", {
                "name": self.__class__.__name__,
                "output": str(result)[:1000]
            })
        
        return result
    
    tool_class.run = wrapped_run

# Aplicar a todas las herramientas
wrap_tool_run(QueryDatabase)
wrap_tool_run(IPythonInterpreter)
wrap_tool_run(SaveOutputFile)
```

#### 2. Event Queue System

```python
# Global dict: chat_id -> Queue
_streaming_queues = {}

def emit_tool_event(chat_id: str, event_type: str, data: dict):
    """Pone evento en el queue del chat_id"""
    if chat_id in _streaming_queues:
        _streaming_queues[chat_id].put((event_type, data))
```

#### 3. Streaming Endpoint

```python
@app.post("/imss-diabetes/stream_response")
async def stream_response_endpoint(request: ChatRequest):
    return StreamingResponse(
        stream_agency_response(request.message, request.chat_id),
        media_type="text/event-stream"
    )

async def stream_agency_response(message: str, chat_id: str):
    # Crear queue para este chat
    event_queue = queue.Queue()
    _streaming_queues[chat_id] = event_queue
    
    # Ejecutar agency en background
    agency_task = asyncio.create_task(run_agency())
    
    # Stream eventos conforme llegan
    while True:
        try:
            event_type, data = event_queue.get(timeout=0.1)
            yield emit_sse(event_type, data)
            
            if event_type == "_done":
                break
        except queue.Empty:
            if agency_task.done():
                break
            await asyncio.sleep(0.1)
```

### Flujo de Eventos

1. **Frontend** hace POST a `/stream_response` con `{message, chat_id}`
2. **Backend** crea un `Queue` para ese `chat_id`
3. **Backend** ejecuta el agency en un thread separado
4. **Herramientas** al ejecutarse emiten eventos al queue:
   - `function_call` → Herramienta empieza
   - `function_call_output` → Herramienta termina
5. **Endpoint** lee del queue y emite eventos SSE conforme llegan:
   ```
   event: function_call
   data: {"name": "QueryDatabase", "arguments": {...}}

   event: function_call_output
   data: {"name": "QueryDatabase", "output": "..."}

   event: messages
   data: {"final_output": "...", "new_messages": [...]}

   event: done
   data: {}
   ```
6. **Frontend** (`useAgencyStream.ts`) recibe eventos y actualiza UI en tiempo real

### Configuración Frontend

```typescript
// frontend/lib/api-client.ts
export const ENDPOINTS = {
  getResponseStream: `${API_CONFIG.baseURL}/${API_CONFIG.agency}/stream_response`,
  // ^ Cambiado de get_response_stream a stream_response
}
```

El hook `useAgencyStream` ya estaba preparado para manejar eventos incrementales (`function_call`, `function_call_output`). No requiere cambios.

### Testing

Para probar el streaming en tiempo real:

```bash
# Backend
cd backend
python -c "from main import app"

# Frontend
cd frontend
npm run dev
```

Luego haz una pregunta que requiera múltiples herramientas:
- "¿Cuál fue la incidencia de diabetes en Jalisco en 2024 comparado con 2023?"

Deberías ver en la UI:
1. Spinner "Ejecutando: QueryDatabase" (aparece inmediatamente)
2. "QueryDatabase completado" (cuando termina)
3. Spinner "Ejecutando: IPythonInterpreter" (si hace análisis)
4. Respuesta final del agente

Todo en tiempo real, no al final.

## Limitaciones

- **Solo herramientas explícitas**: Solo funciona con herramientas que hicimos wrap (`QueryDatabase`, `IPythonInterpreter`, `SaveOutputFile`). Si agregas nuevas herramientas, debes agregarlas a la lista en `main.py:253-256`.
- **Output truncado**: Los outputs de herramientas se truncan a 1000 caracteres para evitar saturar el stream.
- **No funciona con paquetes**: El endpoint `/generate_package` sigue siendo síncrono y no usa este sistema.

## Próximos Pasos

1. Agregar nuevas herramientas al wrapping automático
2. Implementar streaming token-by-token de la respuesta del agente (actualmente solo se emite completa al final)
3. Agregar eventos de "thinking" cuando el agente está razonando sin ejecutar herramientas
