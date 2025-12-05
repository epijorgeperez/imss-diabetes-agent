# QueryDatabase.py
from agency_swarm.tools import BaseTool
from pydantic import Field
import os
import json
import re
from dotenv import load_dotenv

load_dotenv()

# Database connection constants from environment
DB_SERVER = os.getenv("DB_SERVER", "11.33.41.96")
DB_NAME = os.getenv("DB_NAME", "")
DB_USER = os.getenv("DB_USER", "")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
QUERY_TIMEOUT = int(os.getenv("QUERY_TIMEOUT", "600"))

# Threshold for direct response vs context storage
DIRECT_RESPONSE_THRESHOLD = 50


class QueryDatabase(BaseTool):
    """
    Executes SQL queries against the IMSS SQL Server database for diabetes epidemiological analysis.
    
    CRITICAL RULES:
    - Use aggregations (COUNT, SUM, AVG, GROUP BY) for large tables
    - Use TOP N for sampling when needed
    - Tables contain 1M+ records - optimize queries accordingly
    """
    
    sql_query: str = Field(
        ..., 
        description="The SQL query to execute. Use aggregations (COUNT, SUM, GROUP BY) or TOP N."
    )
    
    def _validate_query(self, query: str) -> tuple[bool, str]:
        """
        Validates the SQL query for safety and performance.
        Returns (is_valid, error_message)
        """
        query_upper = query.upper().strip()
        
        # Step 2: Check for dangerous operations
        dangerous_patterns = ['DROP', 'DELETE', 'TRUNCATE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'EXEC', 'EXECUTE']
        for pattern in dangerous_patterns:
            if re.search(rf'\b{pattern}\b', query_upper):
                return False, f"Operation '{pattern}' is not allowed. Only SELECT queries are permitted."
        
        # Step 3: Warn if no aggregation or TOP for large result sets
        has_aggregation = any(agg in query_upper for agg in ['COUNT(', 'SUM(', 'AVG(', 'MAX(', 'MIN(', 'GROUP BY'])
        has_top = 'TOP ' in query_upper or 'TOP(' in query_upper
        has_where = 'WHERE' in query_upper
        
        if not has_aggregation and not has_top:
            return False, "Query must use aggregations (COUNT, SUM, GROUP BY) or TOP N to limit results. Tables contain millions of records."
        
        return True, ""
    
    def _format_results(self, columns: list, rows: list, row_count: int) -> str:
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
            
            return (
                f"**Dataset grande: {row_count} filas, {len(columns)} columnas**\n\n"
                f"**Columnas:** {', '.join(columns)}\n\n"
                f"**Muestra (primeras 5 filas):**\n{sample_table}\n\n"
                f"Los datos completos están en `query_results`. "
                f"Usa **IPythonInterpreter** para análisis estadístico:\n"
                f"```python\n"
                f"df = pd.DataFrame(query_results)\n"
                f"print(df.describe())\n"
                f"```"
            )
    
    def run(self):
        """
        Executes the validated SQL query and returns formatted results.
        Stores results in shared context for use with IPythonInterpreter.
        """
        # Step 1: Validate query
        is_valid, error_message = self._validate_query(self.sql_query)
        if not is_valid:
            return f"[ERROR] Query validation failed: {error_message}"
        
        # Step 2: Check for required environment variables
        if not DB_NAME or not DB_USER or not DB_PASSWORD:
            return "[ERROR] Database credentials not configured. Set DB_NAME, DB_USER, DB_PASSWORD in .env file."
        
        # Step 3: Apply OPENSSL_CONF if set (for legacy SQL Server on Ubuntu)
        openssl_conf = os.getenv("OPENSSL_CONF")
        if openssl_conf and os.path.exists(openssl_conf):
            os.environ["OPENSSL_CONF"] = openssl_conf
        
        # Step 4: Import pyodbc
        try:
            import pyodbc
        except ImportError:
            return "[ERROR] pyodbc is not installed. Run: pip install pyodbc"
        
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
                
                # Step 9: Store results in shared context for IPythonInterpreter
                if hasattr(self, 'context') and self.context is not None:
                    self.context.set("query_results", rows_as_dicts)
                    self.context.set("query_columns", columns)
                    self.context.set("query_row_count", row_count)
                
                # Step 10: Format and return results
                result = self._format_results(columns, rows, row_count)
                return f"[OK] Query executed successfully ({row_count} filas).\n\n{result}"
                
        except pyodbc.Error as e:
            error_code = e.args[0] if e.args else "Unknown"
            error_msg = e.args[1] if len(e.args) > 1 else str(e)
            
            # Check for common SSL/TLS errors
            if "SSL" in str(e) or "protocol" in str(e).lower():
                return (
                    f"[ERROR] SSL/TLS connection error: {error_msg}\n\n"
                    "This typically occurs with legacy SQL Server. Try:\n"
                    "1. Set OPENSSL_CONF environment variable to permissive OpenSSL config\n"
                    "2. Ensure the config has SECLEVEL=0 and UnsafeLegacyRenegotiation=yes"
                )
            
            return f"[ERROR] Database error [{error_code}]: {error_msg}"
            
        except Exception as e:
            return f"[ERROR] Unexpected error: {str(e)}"


if __name__ == "__main__":
    # Test case: Validate query validation logic
    print("=== QueryDatabase Tool Test ===\n")
    
    # Test 2: Invalid query (no aggregation)
    tool = QueryDatabase(sql_query="SELECT name, age FROM patients")
    result = tool.run()
    print(f"Test 2 (No aggregation blocked): {result}\n")
    
    # Test 3: Valid query with aggregation
    tool = QueryDatabase(sql_query="SELECT COUNT(*) as total, delegacion FROM morbilidad GROUP BY delegacion")
    print(f"Test 3 (Valid aggregation query):")
    print(f"  Query validation: {tool._validate_query(tool.sql_query)}\n")
    
    # Test 4: Valid query with TOP
    tool = QueryDatabase(sql_query="SELECT TOP 10 id, fecha FROM casos ORDER BY fecha DESC")
    print(f"Test 4 (Valid TOP query):")
    print(f"  Query validation: {tool._validate_query(tool.sql_query)}\n")
    
    # Test 5: Dangerous operation blocked
    tool = QueryDatabase(sql_query="DROP TABLE patients")
    result = tool.run()
    print(f"Test 5 (DROP blocked): {result}\n")
    
    print("=== Tests Complete ===")

