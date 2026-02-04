# SaveOutputFile.py
from agency_swarm.tools import BaseTool
from pydantic import Field
from typing import Literal
import os
import json

# Import streaming events helper - use absolute import since agency_swarm loads tools without package context
try:
    from epidemiology_agent.tools.streaming_events import emit_tool_start, emit_tool_end
except ImportError:
    try:
        from .streaming_events import emit_tool_start, emit_tool_end
    except ImportError:
        def emit_tool_start(*args, **kwargs): pass
        def emit_tool_end(*args, **kwargs): pass

# Output directory for generated files
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "files", "outputs")


class SaveOutputFile(BaseTool):
    """
    Guarda los resultados de la última consulta SQL en un archivo.
    Soporta formatos CSV, Excel (.xlsx), y JSON.
    
    Los datos se toman automáticamente de `query_results` (la última consulta SQL ejecutada).
    Los archivos se guardan en el directorio de outputs del agente.
    
    Ideal para:
    - Exportar reportes epidemiológicos
    - Compartir datos con otros sistemas
    - Crear archivos para análisis posterior
    """

    filename: str = Field(
        ...,
        description="Nombre del archivo sin extensión (ej: 'incidencia_jalisco_2024'). La extensión se agrega automáticamente."
    )
    
    format: Literal["csv", "xlsx", "json"] = Field(
        default="csv",
        description="Formato del archivo: 'csv' (recomendado), 'xlsx' (Excel), o 'json'."
    )
    
    include_metadata: bool = Field(
        default=True,
        description="Si es True, incluye metadatos (fecha, número de filas, columnas) en el nombre del archivo."
    )

    def _get_chat_id(self) -> str:
        """Get chat_id from context for streaming events."""
        if not hasattr(self, 'context') or self.context is None:
            return "default"
        chat_id = self.context.get("chat_id")
        return chat_id if chat_id else "default"

    def run(self) -> str:
        # Emit streaming event: tool started
        chat_id = self._get_chat_id()
        emit_tool_start(chat_id, "SaveOutputFile", {
            "filename": self.filename,
            "format": self.format
        })
        
        # Step 1: Ensure output directory exists
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        # Step 2: Get query_results from context
        query_results = None
        query_columns = []
        row_count = 0
        
        if hasattr(self, 'context') and self.context is not None:
            query_results = self.context.get("query_results")
            query_columns = self.context.get("query_columns", [])
            row_count = self.context.get("query_row_count", 0)
        
        if not query_results:
            result = "[ERROR] No hay datos en `query_results`. Ejecuta primero una consulta con QueryDatabase."
            emit_tool_end(chat_id, "SaveOutputFile", result)
            return result
        
        # Step 3: Build filename with optional metadata
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        
        if self.include_metadata:
            safe_filename = f"{self.filename}_{row_count}rows_{timestamp}"
        else:
            safe_filename = self.filename
        
        # Sanitize filename
        safe_filename = "".join(c if c.isalnum() or c in ('_', '-') else '_' for c in safe_filename)
        
        # Step 4: Save file based on format
        try:
            if self.format == "csv":
                filepath = os.path.join(OUTPUT_DIR, f"{safe_filename}.csv")
                self._save_csv(query_results, query_columns, filepath)
                
            elif self.format == "xlsx":
                filepath = os.path.join(OUTPUT_DIR, f"{safe_filename}.xlsx")
                self._save_excel(query_results, query_columns, filepath)
                
            elif self.format == "json":
                filepath = os.path.join(OUTPUT_DIR, f"{safe_filename}.json")
                self._save_json(query_results, filepath)
            
            result = f"[OK] Archivo guardado exitosamente:\nRuta: {filepath}\nDatos: {row_count} filas, {len(query_columns)} columnas"
            emit_tool_end(chat_id, "SaveOutputFile", f"Saved: {filepath}")
            return result
            
        except Exception as e:
            result = f"[ERROR] Error al guardar archivo: {str(e)}"
            emit_tool_end(chat_id, "SaveOutputFile", result)
            return result
    
    def _save_csv(self, data: list, columns: list, filepath: str):
        """Save data as CSV file."""
        try:
            import pandas as pd
            df = pd.DataFrame(data)
            df.to_csv(filepath, index=False, encoding='utf-8-sig')  # utf-8-sig for Excel compatibility
        except ImportError:
            # Fallback without pandas
            import csv
            with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
                if data:
                    writer = csv.DictWriter(f, fieldnames=columns or data[0].keys())
                    writer.writeheader()
                    writer.writerows(data)
    
    def _save_excel(self, data: list, columns: list, filepath: str):
        """Save data as Excel file."""
        try:
            import pandas as pd
            df = pd.DataFrame(data)
            df.to_excel(filepath, index=False, engine='openpyxl')
        except ImportError as e:
            raise ImportError(f"Se requiere pandas y openpyxl para Excel: {e}")
    
    def _save_json(self, data: list, filepath: str):
        """Save data as JSON file."""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)


if __name__ == "__main__":
    from agency_swarm import MasterContext, RunContextWrapper
    
    # Create context with sample data
    master_ctx = MasterContext(user_context={}, thread_manager=None, agents={})
    
    master_ctx.set("query_results", [
        {"Nombre_OOAD": "Jalisco", "casos": 15420, "tasa": 440.57},
        {"Nombre_OOAD": "CDMX Norte", "casos": 22100, "tasa": 425.00},
        {"Nombre_OOAD": "Nuevo León", "casos": 12300, "tasa": 439.29},
    ])
    master_ctx.set("query_columns", ["Nombre_OOAD", "casos", "tasa"])
    master_ctx.set("query_row_count", 3)
    
    ctx_wrapper = RunContextWrapper(context=master_ctx)
    
    # Test CSV export
    print("Test 1 - Exportar CSV:")
    tool = SaveOutputFile(filename="incidencia_test", format="csv")
    tool._context = ctx_wrapper
    print(tool.run())
    
    # Test JSON export
    print("\nTest 2 - Exportar JSON:")
    tool2 = SaveOutputFile(filename="incidencia_test", format="json", include_metadata=False)
    tool2._context = ctx_wrapper
    print(tool2.run())

