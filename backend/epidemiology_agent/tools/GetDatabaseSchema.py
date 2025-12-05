# GetDatabaseSchema.py
from agency_swarm.tools import BaseTool
from pydantic import Field
import os
from dotenv import load_dotenv

load_dotenv()

# Database connection constants from environment
DB_SERVER = os.getenv("DB_SERVER", "11.33.41.96")
DB_NAME = os.getenv("DB_NAME", "")
DB_USER = os.getenv("DB_USER", "")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")


class GetDatabaseSchema(BaseTool):
    """
    Retrieves schema information from the IMSS SQL Server database.
    Use this tool to discover table structures, column names, and data types
    before constructing SQL queries. Essential for understanding the database
    structure when the instructions don't provide enough detail.
    """
    
    table_name: str = Field(
        default="",
        description="Optional: Specific table name to get schema for. Leave empty to list all tables."
    )
    
    def run(self):
        """
        Queries INFORMATION_SCHEMA to get table and column information.
        """
        # Step 1: Check for required environment variables
        if not DB_NAME or not DB_USER or not DB_PASSWORD:
            return "[ERROR] Database credentials not configured. Set DB_NAME, DB_USER, DB_PASSWORD in .env file."
        
        # Step 2: Apply OPENSSL_CONF if set (for legacy SQL Server on Ubuntu)
        openssl_conf = os.getenv("OPENSSL_CONF")
        if openssl_conf and os.path.exists(openssl_conf):
            os.environ["OPENSSL_CONF"] = openssl_conf
        
        # Step 3: Import pyodbc
        try:
            import pyodbc
        except ImportError:
            return "[ERROR] pyodbc is not installed. Run: pip install pyodbc"
        
        # Step 4: Build connection string with legacy SSL parameters
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
        
        # Step 5: Build the appropriate query
        if self.table_name:
            # Get columns for a specific table
            query = f"""
            SELECT 
                TABLE_NAME,
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                ORDINAL_POSITION
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '{self.table_name}'
            ORDER BY ORDINAL_POSITION
            """
        else:
            # List all tables (compatible with SQL Server 2008/2012 - no STRING_AGG)
            query = """
            SELECT 
                TABLE_NAME,
                COUNT(*) as COLUMN_COUNT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME IN (
                SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'
            )
            GROUP BY TABLE_NAME
            ORDER BY TABLE_NAME
            """
        
        # Step 6: Execute query
        try:
            with pyodbc.connect(connection_string, timeout=60) as conn:
                cursor = conn.cursor()
                cursor.execute(query)
                
                columns = [column[0] for column in cursor.description] if cursor.description else []
                rows = cursor.fetchall()
                
                if not rows:
                    if self.table_name:
                        return f"[INFO] No table found with name '{self.table_name}'. Use GetDatabaseSchema without table_name to list all tables."
                    return "[INFO] No tables found in the database."
                
                # Step 7: Format results
                if self.table_name:
                    # Detailed column info for specific table
                    result = f"## Schema for table: {self.table_name}\n\n"
                    result += "| Column | Data Type | Nullable | Position |\n"
                    result += "| --- | --- | --- | --- |\n"
                    for row in rows:
                        result += f"| {row.COLUMN_NAME} | {row.DATA_TYPE} | {row.IS_NULLABLE} | {row.ORDINAL_POSITION} |\n"
                else:
                    # Table list (without column names - use GetDatabaseSchema with table_name for details)
                    result = "## Available Tables\n\n"
                    result += "| Table | Columns |\n"
                    result += "| --- | --- |\n"
                    for row in rows:
                        result += f"| {row.TABLE_NAME} | {row.COLUMN_COUNT} |\n"
                    result += "\n*Use GetDatabaseSchema(table_name='TABLE_NAME') to see column details*"
                
                return f"[OK] Schema retrieved successfully.\n\n{result}"
                
        except pyodbc.Error as e:
            error_code = e.args[0] if e.args else "Unknown"
            error_msg = e.args[1] if len(e.args) > 1 else str(e)
            
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
    print("=== GetDatabaseSchema Tool Test ===\n")
    
    # Test 1: List all tables (will fail without DB connection, but validates structure)
    tool = GetDatabaseSchema(table_name="")
    print(f"Test 1 (List all tables): Query would be executed")
    print(f"  Requires DB connection to test\n")
    
    # Test 2: Get specific table schema
    tool = GetDatabaseSchema(table_name="MORBI_DIABETES")
    print(f"Test 2 (Specific table): Query would be executed for MORBI_DIABETES")
    print(f"  Requires DB connection to test\n")
    
    print("=== Tests Complete ===")

