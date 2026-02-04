# QueryDatabase.py
from agency_swarm.tools import BaseTool
from pydantic import Field
from typing import Optional
import os
import json
import re
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Import streaming events helper - absolute import (agency_swarm loads tools without package context)
try:
    from epidemiology_agent.tools.streaming_events import emit_tool_start, emit_tool_end
except ImportError:
    try:
        from .streaming_events import emit_tool_start, emit_tool_end
    except ImportError:
        def emit_tool_start(*args, **kwargs): pass
        def emit_tool_end(*args, **kwargs): pass

# Counter for auto-naming queries without explicit names
_query_counter = 0

# Database connection constants from environment
DB_SERVER = os.getenv("DB_SERVER", "11.33.41.96")
DB_NAME = os.getenv("DB_NAME", "")
DB_USER = os.getenv("DB_USER", "")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
QUERY_TIMEOUT = int(os.getenv("QUERY_TIMEOUT", "600"))

# Threshold for direct response vs context storage
DIRECT_RESPONSE_THRESHOLD = 50

# Directory for persisting query results between messages
QUERY_CACHE_DIR = Path(__file__).parent.parent / "files" / "query_cache"
QUERY_CACHE_DIR.mkdir(parents=True, exist_ok=True)


class QueryDatabase(BaseTool):
    """
    Executes SQL queries against the IMSS SQL Server database for diabetes epidemiological analysis.
    
    CRITICAL RULES:
    - Use aggregations (COUNT, SUM, AVG, GROUP BY) for large tables
    - Use TOP N for sampling when needed
    - Tables contain 1M+ records - optimize queries accordingly
    
    Results are automatically:
    - Stored in shared context for immediate use with IPythonInterpreter
    - Persisted to disk by chat_id for cross-message continuity
    
    NAMED QUERIES (Multi-Query Support):
    - Use `result_name` to identify each query (e.g., "incidencia", "mortalidad")
    - Access in IPythonInterpreter: `df = get_query("incidencia")`
    - All named queries available via `named_queries` dict
    """
    
    sql_query: str = Field(
        ..., 
        description="The SQL query to execute. Use aggregations (COUNT, SUM, GROUP BY) or TOP N."
    )
    
    result_name: Optional[str] = Field(
        default=None,
        description="Nombre para identificar esta consulta. Ej: 'incidencia', 'mortalidad'. "
                    "Permite acceder a resultados especificos desde IPythonInterpreter con get_query('nombre')."
    )
    
    def _get_chat_id(self) -> str:
        """Extracts chat_id from MasterContext for result persistence."""
        if not hasattr(self, 'context') or self.context is None:
            return "default"
        
        chat_id = self.context.get("chat_id")
        if chat_id:
            return chat_id
        
        # Fallback: buscar en user_context anidado
        user_context = self.context.get("user_context", {})
        if isinstance(user_context, dict) and "chat_id" in user_context:
            return user_context["chat_id"]
        
        return "default"
    
    def _persist_results(self, results: list, columns: list, row_count: int, query_name: str = None):
        """
        Persists query results to a JSON file for cross-message access.
        Supports multiple named queries in the same file.
        File is stored by chat_id to ensure isolation between conversations.
        """
        chat_id = self._get_chat_id()
        cache_file = QUERY_CACHE_DIR / f"results_{chat_id}.json"
        
        try:
            # Load existing named queries if file exists
            existing_data = {}
            if cache_file.exists():
                try:
                    with open(cache_file, "r", encoding="utf-8") as f:
                        existing_data = json.load(f)
                except (json.JSONDecodeError, IOError):
                    existing_data = {}
            
            # Build query entry
            query_entry = {
                "results": results,
                "columns": columns,
                "row_count": row_count,
                "timestamp": datetime.now().isoformat(),
                "query": self.sql_query[:500]
            }
            
            # Store in named_queries structure
            if "named_queries" not in existing_data:
                existing_data["named_queries"] = {}
            
            # Add/update this query by name
            name = query_name or "__latest__"
            existing_data["named_queries"][name] = query_entry
            existing_data["__latest__"] = name
            
            # Also keep legacy format for backward compatibility
            existing_data["results"] = results
            existing_data["columns"] = columns
            existing_data["row_count"] = row_count
            existing_data["timestamp"] = query_entry["timestamp"]
            
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(existing_data, f, ensure_ascii=False, default=str)
                
        except Exception:
            pass  # Non-fatal: don't fail the query if persistence fails
    
    def _validate_query(self, query: str) -> tuple[bool, str]:
        """
        Validates the SQL query for safety and performance.
        Returns (is_valid, error_message)
        """
        query_upper = query.upper().strip()
        
        # Step 1: Check for dangerous operations
        dangerous_patterns = ['DROP', 'DELETE', 'TRUNCATE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'EXEC', 'EXECUTE']
        for pattern in dangerous_patterns:
            if re.search(rf'\b{pattern}\b', query_upper):
                return False, f"Operation '{pattern}' is not allowed. Only SELECT queries are permitted."
        
        # Step 2: Warn if no aggregation or TOP for large result sets
        has_aggregation = any(agg in query_upper for agg in ['COUNT(', 'SUM(', 'AVG(', 'MAX(', 'MIN(', 'GROUP BY'])
        has_top = 'TOP ' in query_upper or 'TOP(' in query_upper
        has_where = 'WHERE' in query_upper
        
        if not has_aggregation and not has_top:
            return False, "Query must use aggregations (COUNT, SUM, GROUP BY) or TOP N to limit results. Tables contain millions of records."
        
        # Step 3: Detect anti-pattern - JOIN directo a Poblacion + SUM(Poblacion)
        # This causes fan-out and inflates population denominators
        has_direct_pop_join = re.search(
            r'JOIN\s+V_Agente_Poblacion', query, re.IGNORECASE
        )
        has_sum_poblacion = re.search(
            r'SUM\s*\(\s*[A-Z_]*\.?Poblacion_Adscrita', query, re.IGNORECASE
        )
        
        if has_direct_pop_join and has_sum_poblacion:
            return False, (
                "ANTI-PATRON DETECTADO: JOIN directo a V_Agente_Poblacion + SUM(Poblacion_Adscrita).\n"
                "Esto causa fan-out e infla el denominador (poblacion multiplicada por filas de la otra tabla).\n\n"
                "SOLUCION - Usa subconsulta escalar o CTE:\n"
                "- Subconsulta: (SELECT SUM(P.Poblacion_Adscrita_MF) FROM V_Agente_Poblacion_Detalle P WHERE P.Anio = M.Anio AND P.Cve_Presupuestal = M.Cve_Presupuestal AND P.Nivel_Jerarquico = '...')\n"
                "- CTE: WITH Pob AS (SELECT Cve_Presupuestal, SUM(Poblacion_Adscrita_MF) AS Pob_Total FROM V_Agente_Poblacion_Detalle GROUP BY Cve_Presupuestal, Anio) SELECT ... FROM Metricas JOIN Pob ON ..."
            )
        
        return True, ""
    
    def _format_results(self, columns: list, rows: list, row_count: int, query_name: str = None) -> str:
        """
        Formats query results based on size.
        - Small results (<=50): Full markdown table
        - Large results (>50): Summary + hint to use Python
        """
        if not rows:
            return "No results found."
        
        if row_count <= DIRECT_RESPONSE_THRESHOLD:
            # Small dataset: return full markdown table
            header = "| " + " | ".join(str(col) for col in columns) + " |"
            separator = "| " + " | ".join("---" for _ in columns) + " |"
            
            data_rows = []
            for row in rows:
                formatted_row = "| " + " | ".join(str(val) if val is not None else "NULL" for val in row) + " |"
                data_rows.append(formatted_row)
            
            return f"{header}\n{separator}\n" + "\n".join(data_rows)
        else:
            # Large dataset: return summary with hint
            header = "| " + " | ".join(str(col) for col in columns) + " |"
            separator = "| " + " | ".join("---" for _ in columns) + " |"
            
            # Show first 5 rows as sample
            data_rows = []
            for row in rows[:5]:
                formatted_row = "| " + " | ".join(str(val) if val is not None else "NULL" for val in row) + " |"
                data_rows.append(formatted_row)
            
            sample_table = f"{header}\n{separator}\n" + "\n".join(data_rows)
            
            # Build access hint based on whether query has a name
            if query_name:
                access_hint = (
                    f"Acceso: `df = get_query('{query_name}')` o `pd.DataFrame(query_results)`"
                )
            else:
                access_hint = "Acceso: `df = pd.DataFrame(query_results)`"
            
            return (
                f"**Dataset grande: {row_count} filas, {len(columns)} columnas**\n\n"
                f"**Columnas:** {', '.join(columns)}\n\n"
                f"**Muestra (primeras 5 filas):**\n{sample_table}\n\n"
                f"{access_hint}"
            )
    
    def run(self):
        """
        Executes the validated SQL query and returns formatted results.
        Stores results in shared context for use with IPythonInterpreter.
        """
        # Emit streaming event: tool started
        chat_id = self._get_chat_id()
        emit_tool_start(chat_id, "QueryDatabase", {
            "sql_query": self.sql_query[:200],
            "result_name": self.result_name
        })
        
        # Step 1: Validate query
        is_valid, error_message = self._validate_query(self.sql_query)
        if not is_valid:
            result = f"[ERROR] Query validation failed: {error_message}"
            emit_tool_end(chat_id, "QueryDatabase", result)
            return result
        
        # Step 2: Check for required environment variables
        if not DB_NAME or not DB_USER or not DB_PASSWORD:
            result = "[ERROR] Database credentials not configured. Set DB_NAME, DB_USER, DB_PASSWORD in .env file."
            emit_tool_end(chat_id, "QueryDatabase", result)
            return result
        
        # Step 3: Apply OPENSSL_CONF if set (for legacy SQL Server on Ubuntu)
        openssl_conf = os.getenv("OPENSSL_CONF")
        if openssl_conf and os.path.exists(openssl_conf):
            os.environ["OPENSSL_CONF"] = openssl_conf
        
        # Step 4: Import pyodbc
        try:
            import pyodbc
        except ImportError:
            result = "[ERROR] pyodbc is not installed. Run: pip install pyodbc"
            emit_tool_end(chat_id, "QueryDatabase", result)
            return result
        
        # Step 5: Build connection string with legacy SSL parameters
        connection_string = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={DB_SERVER};"
            f"DATABASE={DB_NAME};"
            f"UID={DB_USER};"
            f"PWD={DB_PASSWORD};"
            f"TrustServerCertificate=yes;"
            f"Encrypt=no;"
            f"Connection Timeout=30;"
        )
        
        # Step 6: Connect and execute query
        try:
            with pyodbc.connect(connection_string, timeout=QUERY_TIMEOUT) as conn:
                cursor = conn.cursor()
                cursor.execute(self.sql_query)
                
                # Step 7: Fetch results
                columns = [column[0] for column in cursor.description] if cursor.description else []
                rows = cursor.fetchall()
                row_count = len(rows)
                
                # Step 8: Convert rows to list of dicts for context storage
                rows_as_dicts = [
                    {columns[i]: (val if val is not None else None) for i, val in enumerate(row)}
                    for row in rows
                ]
                
                # Step 9: Generate query name (auto-name if not provided)
                global _query_counter
                if self.result_name:
                    query_name = self.result_name
                else:
                    _query_counter += 1
                    query_name = f"query_{_query_counter}"
                
                # Step 9.1: Store results in shared context for IPythonInterpreter
                if hasattr(self, 'context') and self.context is not None:
                    # Legacy: query_results always has latest query (backward compatibility)
                    self.context.set("query_results", rows_as_dicts)
                    self.context.set("query_columns", columns)
                    self.context.set("query_row_count", row_count)
                    
                    # NEW: Store in named_queries dict for multi-query access
                    named_queries = self.context.get("named_queries") or {}
                    named_queries[query_name] = {
                        "results": rows_as_dicts,
                        "columns": columns,
                        "row_count": row_count
                    }
                    named_queries["__latest__"] = query_name
                    self.context.set("named_queries", named_queries)
                
                # Step 9.5: Persist results to disk for cross-message access
                self._persist_results(rows_as_dicts, columns, row_count, query_name)
                
                # Step 10: Format and return results
                formatted = self._format_results(columns, rows, row_count, query_name)
                name_info = f" [nombre: '{query_name}']" if self.result_name else ""
                result = f"[OK] Query executed successfully ({row_count} filas){name_info}.\n\n{formatted}"
                emit_tool_end(chat_id, "QueryDatabase", f"Success: {row_count} rows")
                return result
                
        except pyodbc.Error as e:
            error_code = e.args[0] if e.args else "Unknown"
            error_msg = e.args[1] if len(e.args) > 1 else str(e)
            
            # Check for common SSL/TLS errors
            if "SSL" in str(e) or "protocol" in str(e).lower():
                result = (
                    f"[ERROR] SSL/TLS connection error: {error_msg}\n\n"
                    "This typically occurs with legacy SQL Server. Try:\n"
                    "1. Set OPENSSL_CONF environment variable to permissive OpenSSL config\n"
                    "2. Ensure the config has SECLEVEL=0 and UnsafeLegacyRenegotiation=yes"
                )
                emit_tool_end(chat_id, "QueryDatabase", result)
                return result
            
            result = f"[ERROR] Database error [{error_code}]: {error_msg}"
            emit_tool_end(chat_id, "QueryDatabase", result)
            return result
            
        except Exception as e:
            result = f"[ERROR] Unexpected error: {str(e)}"
            emit_tool_end(chat_id, "QueryDatabase", result)
            return result


if __name__ == "__main__":
    # Test case: Validate query validation logic
    print("=== QueryDatabase Tool Test ===\n")
    
    # Test 1: Invalid query (no aggregation)
    tool = QueryDatabase(sql_query="SELECT name, age FROM patients")
    result = tool.run()
    print(f"Test 1 (No aggregation blocked): {result}\n")
    
    # Test 2: Valid query with aggregation
    tool = QueryDatabase(sql_query="SELECT COUNT(*) as total, delegacion FROM morbilidad GROUP BY delegacion")
    print(f"Test 2 (Valid aggregation query):")
    print(f"  Query validation: {tool._validate_query(tool.sql_query)}\n")
    
    # Test 3: Valid query with TOP
    tool = QueryDatabase(sql_query="SELECT TOP 10 id, fecha FROM casos ORDER BY fecha DESC")
    print(f"Test 3 (Valid TOP query):")
    print(f"  Query validation: {tool._validate_query(tool.sql_query)}\n")
    
    # Test 4: Dangerous operation blocked
    tool = QueryDatabase(sql_query="DROP TABLE patients")
    result = tool.run()
    print(f"Test 4 (DROP blocked): {result}\n")
    
    # Test 5: Named query parameter
    tool_named = QueryDatabase(
        sql_query="SELECT COUNT(*) as total FROM incidencia GROUP BY ooad", 
        result_name="incidencia"
    )
    print(f"Test 5 (Named query):")
    print(f"  result_name: {tool_named.result_name}")
    print(f"  Query validation: {tool_named._validate_query(tool_named.sql_query)}\n")
    
    # Test 6: Auto-naming (no result_name)
    tool_auto = QueryDatabase(sql_query="SELECT COUNT(*) FROM mortalidad GROUP BY year")
    print(f"Test 6 (Auto-naming):")
    print(f"  result_name: {tool_auto.result_name} (will be auto-named as 'query_N')")
    print(f"  Query validation: {tool_auto._validate_query(tool_auto.sql_query)}\n")
    
    # Test 7: Anti-pattern - JOIN directo + SUM(Poblacion) - SHOULD BE BLOCKED
    bad_query = """
    SELECT TOP 10 
        Cat.Nombre_Oficial AS Unidad,
        SUM(M.Defunciones) AS Defunciones,
        SUM(P.Poblacion_Adscrita_MF) AS Poblacion
    FROM V_Agente_Mortalidad M
    JOIN V_Agente_Catalogo_Unidades Cat ON M.Cve_Presupuestal = Cat.ClavePresupuestal
    JOIN V_Agente_Poblacion_Detalle P ON P.Anio = M.Anio AND P.Cve_Presupuestal = M.Cve_Presupuestal
    WHERE M.Anio = 2024
    GROUP BY Cat.Nombre_Oficial
    """
    tool_bad = QueryDatabase(sql_query=bad_query)
    is_valid, msg = tool_bad._validate_query(bad_query)
    print(f"Test 7 (Anti-pattern JOIN+SUM(Poblacion) BLOCKED):")
    print(f"  is_valid: {is_valid}")
    print(f"  message: {msg[:100]}...\n")
    
    # Test 8: Valid pattern - subconsulta escalar for population - SHOULD PASS
    good_query = """
    SELECT TOP 10 
        Cat.Nombre_Oficial AS Unidad,
        SUM(M.Defunciones) AS Defunciones,
        (SELECT SUM(P.Poblacion_Adscrita_MF) FROM V_Agente_Poblacion_Detalle P 
         WHERE P.Anio = M.Anio AND P.Cve_Presupuestal = M.Cve_Presupuestal) AS Poblacion
    FROM V_Agente_Mortalidad M
    JOIN V_Agente_Catalogo_Unidades Cat ON M.Cve_Presupuestal = Cat.ClavePresupuestal
    WHERE M.Anio = 2024
    GROUP BY Cat.Nombre_Oficial, M.Anio, M.Cve_Presupuestal
    """
    tool_good = QueryDatabase(sql_query=good_query)
    is_valid, msg = tool_good._validate_query(good_query)
    print(f"Test 8 (Valid subconsulta pattern ALLOWED):")
    print(f"  is_valid: {is_valid}")
    print(f"  message: '{msg}'\n")
    
    print("=== Tests Complete ===")

