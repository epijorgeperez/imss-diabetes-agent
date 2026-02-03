# IPythonInterpreter.py
from agency_swarm.tools import BaseTool
from pydantic import Field
from io import StringIO
import contextlib
import traceback
import os
import json
import pickle
from pathlib import Path

# Output directory for generated files
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "files", "outputs")

# Directory for persisting query results and namespaces between messages
QUERY_CACHE_DIR = Path(__file__).parent.parent / "files" / "query_cache"
NAMESPACE_CACHE_DIR = Path(__file__).parent.parent / "files" / "namespace_cache"
QUERY_CACHE_DIR.mkdir(parents=True, exist_ok=True)
NAMESPACE_CACHE_DIR.mkdir(parents=True, exist_ok=True)


class EstiloInstitucional:
    """
    Define la paleta de colores y estilos tipográficos basados 
    en la guía cromática institucional del IMSS.
    """
    # Colores extraídos y estandarizados
    NEGRO = '#222223'        # Negro Institucional
    VERDE_IMSS = '#00594C'   # Verde Institucional (Pantone 561 C)
    GRIS_TEXTO = '#B1B3B3'   # Gris Institucional
    TINTO = '#651D32'        # Tinto/Vino
    ROJO_GOB = '#9B2242'     # Rojo Gobierno (Acento)
    DORADO_IMSS = '#AD841F'  # Dorado/Ocre Institucional
    BLANCO = '#FFFFFF'       # Blanco
    
    @classmethod
    def aplicar_estilo(cls):
        """Aplica la configuración global a Matplotlib/Seaborn"""
        try:
            import matplotlib.pyplot as plt
            import matplotlib as mpl
            
            # Configure matplotlib directly with institutional colors
            plt.style.use('seaborn-v0_8-whitegrid')
            
            plt.rcParams.update({
                # Fonts
                'font.family': 'sans-serif',
                'font.sans-serif': ['Arial', 'Helvetica', 'DejaVu Sans'],
                # Text colors
                'text.color': cls.NEGRO,
                'axes.labelcolor': cls.NEGRO,
                'xtick.color': cls.NEGRO,
                'ytick.color': cls.NEGRO,
                # Sizes
                'axes.titlesize': 14,
                'axes.titleweight': 'bold',
                'axes.labelsize': 11,
                'figure.figsize': (12, 6),
                # Background
                'axes.facecolor': cls.BLANCO,
                'figure.facecolor': cls.BLANCO,
                # Grid
                'grid.color': cls.GRIS_TEXTO,
                'grid.alpha': 0.3,
                # Color cycle - THIS IS THE KEY
                'axes.prop_cycle': mpl.cycler(color=[
                    cls.VERDE_IMSS, 
                    cls.DORADO_IMSS, 
                    cls.ROJO_GOB, 
                    cls.TINTO, 
                    cls.GRIS_TEXTO
                ])
            })
            
            # Also set seaborn palette if available
            try:
                import seaborn as sns
                sns.set_palette([cls.VERDE_IMSS, cls.DORADO_IMSS, cls.ROJO_GOB, cls.TINTO, cls.GRIS_TEXTO])
            except ImportError:
                pass
                
        except ImportError:
            pass


class IPythonInterpreter(BaseTool):
    """
    Ejecuta código Python en un namespace aislado y persistente por sesión.
    Ideal para análisis epidemiológicos, cálculos estadísticos y visualizaciones.
    
    Variables predefinidas disponibles automáticamente:
    - `query_results`: Lista de dicts con los resultados de la última consulta SQL
    - `query_columns`: Lista de nombres de columnas
    - `query_row_count`: Número total de filas
    - `OUTPUT_DIR`: Directorio para guardar archivos generados
    - `EstiloInstitucional`: Clase con paleta de colores IMSS (VERDE_IMSS, DORADO_IMSS, etc.)
    
    MULTI-QUERY SUPPORT (Named Queries):
    - `named_queries`: Dict con todas las consultas nombradas
    - `get_query(name)`: Retorna DataFrame de una consulta específica
    - `list_queries()`: Lista todas las consultas disponibles
    
    Librerías pre-importadas: pandas (pd), numpy (np), matplotlib.pyplot (plt), 
    seaborn (sns), json, datetime, os.
    
    Estilo institucional IMSS aplicado automáticamente a todas las gráficas.
    
    PERSISTENCIA:
    - Variables persisten entre ejecuciones de la misma conversación (chat_id)
    - query_results y named_queries se cargan automáticamente si QueryDatabase se ejecutó previamente
    - El namespace Python se guarda/restaura entre mensajes
    
    Ejemplos de uso:
    - Crear DataFrame: `df = pd.DataFrame(query_results)` (última consulta)
    - Multi-query: `df_inc = get_query("incidencia")`, `df_mort = get_query("mortalidad")`
    - Ver consultas disponibles: `print(list_queries())`
    - Calcular tasas: `df['tasa'] = (df['casos'] / df['poblacion']) * 100000`
    - Guardar gráfica: `plt.savefig(f'{OUTPUT_DIR}/grafica.png')`
    """

    code: str = Field(
        ..., 
        description="Código Python a ejecutar. Soporta múltiples líneas. Los datos de la última consulta SQL están en 'query_results'."
    )
    
    def _get_chat_id(self) -> str:
        """Extracts chat_id from MasterContext for namespace persistence.
        
        El MasterContext tiene un dict user_context, y .get() busca directamente ahí.
        Por ejemplo: context.get("chat_id") busca en context.user_context["chat_id"]
        """
        if not hasattr(self, 'context') or self.context is None:
            print("[IPythonInterpreter] WARNING: No context available, using 'default'")
            return "default"
        
        # MasterContext.get() busca directamente en user_context
        chat_id = self.context.get("chat_id")
        if chat_id:
            print(f"[IPythonInterpreter] ✅ Got chat_id from context: {chat_id[:8]}...")
            return chat_id
        
        # Fallback: buscar en user_context anidado (compatibilidad hacia atrás)
        user_context = self.context.get("user_context", {})
        if isinstance(user_context, dict) and "chat_id" in user_context:
            chat_id = user_context["chat_id"]
            print(f"[IPythonInterpreter] ✅ Got chat_id from nested user_context: {chat_id[:8]}...")
            return chat_id
        
        print("[IPythonInterpreter] WARNING: No chat_id found in context, using 'default'")
        return "default"
    
    def _load_query_results_from_cache(self) -> tuple:
        """
        Loads query_results from disk cache if not in context.
        Returns (results, columns, row_count, named_queries) or (None, None, None, None) if not found.
        """
        chat_id = self._get_chat_id()
        cache_file = QUERY_CACHE_DIR / f"results_{chat_id}.json"
        
        if not cache_file.exists():
            return None, None, None, None
        
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
            
            # Load named_queries if available (new format)
            named_queries = cached.get("named_queries", {})
            
            return (
                cached.get("results"), 
                cached.get("columns", []), 
                cached.get("row_count", 0),
                named_queries
            )
        except Exception as e:
            print(f"[IPythonInterpreter] Warning: Could not load cached results: {e}")
            return None, None, None, None
    
    def _load_namespace_from_cache(self) -> dict:
        """
        Loads persisted namespace variables from disk for cross-message continuity.
        Only loads serializable data (DataFrames, arrays, etc.), not modules.
        """
        chat_id = self._get_chat_id()
        cache_file = NAMESPACE_CACHE_DIR / f"namespace_{chat_id}.pkl"
        
        if not cache_file.exists():
            return {}
        
        try:
            with open(cache_file, "rb") as f:
                return pickle.load(f)
        except Exception as e:
            print(f"[IPythonInterpreter] Warning: Could not load cached namespace: {e}")
            return {}
    
    def _save_namespace_to_cache(self, namespace: dict):
        """
        Persists serializable namespace variables to disk.
        Skips modules and non-picklable objects.
        """
        chat_id = self._get_chat_id()
        cache_file = NAMESPACE_CACHE_DIR / f"namespace_{chat_id}.pkl"
        
        # Filter to only picklable items
        serializable_items = {}
        skip_keys = {"__builtins__", "__name__", "pd", "np", "plt", "sns", "json", 
                     "datetime", "os", "stats", "sm", "EstiloInstitucional", "OUTPUT_DIR",
                     "get_query", "list_queries", "named_queries"}
        
        for key, value in namespace.items():
            if key in skip_keys or key.startswith("_"):
                continue
            try:
                # Test if picklable by attempting serialization
                pickle.dumps(value)
                serializable_items[key] = value
            except (pickle.PicklingError, TypeError, AttributeError):
                # Skip non-picklable items silently
                pass
        
        try:
            with open(cache_file, "wb") as f:
                pickle.dump(serializable_items, f)
        except Exception as e:
            print(f"[IPythonInterpreter] Warning: Could not persist namespace: {e}")

    async def run(self) -> str:
        # Step 1: Ensure output directory exists
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        # Step 1.5: Detect existing files before execution
        existing_files = set(os.listdir(OUTPUT_DIR)) if os.path.exists(OUTPUT_DIR) else set()
        
        # Step 2: Get or create isolated namespace per session
        namespace = self.context.get("python_namespace")
        if namespace is None:
            namespace = {
                "__builtins__": __builtins__,
                "__name__": "__main__",
                "OUTPUT_DIR": OUTPUT_DIR,
            }
            
            # Pre-import common libraries
            import json as json_module
            from datetime import datetime
            namespace.update({"json": json_module, "datetime": datetime, "os": os})
            
            try:
                import pandas as pd
                namespace["pd"] = pd
            except ImportError:
                pass
            
            try:
                import numpy as np
                namespace["np"] = np
            except ImportError:
                pass
            
            try:
                import matplotlib
                matplotlib.use('Agg')  # Non-GUI backend for server
                import matplotlib.pyplot as plt
                
                # Apply institutional IMSS style BEFORE creating any plots
                EstiloInstitucional.aplicar_estilo()
                
                namespace["plt"] = plt
                namespace["EstiloInstitucional"] = EstiloInstitucional
            except ImportError:
                pass
            
            try:
                import seaborn as sns
                namespace["sns"] = sns
            except ImportError:
                pass

            try:
                import scipy.stats as stats
                namespace["stats"] = stats
            except ImportError: pass

            try:
                import statsmodels.api as sm
                namespace["sm"] = sm
            except ImportError: pass
            
            # Step 2.5: Restore persisted variables from previous messages (same chat_id)
            cached_vars = self._load_namespace_from_cache()
            if cached_vars:
                namespace.update(cached_vars)
            
            self.context.set("python_namespace", namespace)
        
        # Step 3: Inject query_results and named_queries from context if available
        query_results = self.context.get("query_results")
        named_queries = self.context.get("named_queries") or {}
        
        if query_results is not None:
            namespace["query_results"] = query_results
            namespace["query_columns"] = self.context.get("query_columns", [])
            namespace["query_row_count"] = self.context.get("query_row_count", 0)
            namespace["named_queries"] = named_queries
        else:
            # Step 3.5: If not in context, try to load from disk cache (cross-message persistence)
            cached_results, cached_columns, cached_row_count, cached_named = self._load_query_results_from_cache()
            if cached_results is not None:
                namespace["query_results"] = cached_results
                namespace["query_columns"] = cached_columns
                namespace["query_row_count"] = cached_row_count
                # Also store in context for subsequent tool calls in same message
                self.context.set("query_results", cached_results)
                self.context.set("query_columns", cached_columns)
                self.context.set("query_row_count", cached_row_count)
            
            # Load named_queries from cache
            if cached_named:
                named_queries = cached_named
                self.context.set("named_queries", named_queries)
            
            namespace["named_queries"] = named_queries
        
        # Step 3.6: Inject helper functions for multi-query access
        def get_query(name: str):
            """
            Retorna un DataFrame con los resultados de una consulta nombrada.
            Uso: df = get_query("incidencia")
            """
            if "pd" not in namespace:
                raise ImportError("pandas no está disponible")
            pd = namespace["pd"]
            
            nq = namespace.get("named_queries", {})
            if name not in nq:
                available = [k for k in nq.keys() if not k.startswith("__")]
                raise KeyError(f"Consulta '{name}' no encontrada. Disponibles: {available}")
            
            return pd.DataFrame(nq[name]["results"])
        
        def list_queries():
            """
            Lista todas las consultas nombradas disponibles.
            Retorna dict con nombre -> row_count
            """
            nq = namespace.get("named_queries", {})
            return {
                k: {"row_count": v.get("row_count", 0), "columns": v.get("columns", [])}
                for k, v in nq.items() 
                if not k.startswith("__")
            }
        
        namespace["get_query"] = get_query
        namespace["list_queries"] = list_queries
        
        # Step 4: Execute code
        output = StringIO()
        error = None
        result_value = None
        
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            try:
                # Compile and execute as statements
                compiled = compile(self.code, "<agent>", "exec")
                exec(compiled, namespace)
            except SyntaxError:
                # If fails, try as expression to get result
                try:
                    compiled = compile(self.code, "<agent>", "eval")
                    result_value = eval(compiled, namespace)
                except Exception as e:
                    error = "".join(traceback.format_exception_only(type(e), e))
            except Exception as e:
                error = "".join(traceback.format_exception_only(type(e), e))
        
        # Step 5: Persist updated namespace to context (for same message)
        self.context.set("python_namespace", namespace)
        
        # Step 5.5: Persist namespace to disk (for cross-message continuity)
        self._save_namespace_to_cache(namespace)
        
        stdout = output.getvalue().strip()
        
        # Step 6: Build response with file detection
        response_parts = []
        
        if error:
            # Check if error is about missing query_results and provide helpful message
            if "query_results" in str(error) and "not defined" in str(error):
                return (
                    f"[ERROR]\n{error}\n\n"
                    "⚠️ **query_results no está disponible.**\n"
                    "Ejecuta `QueryDatabase` primero para cargar datos de la base de datos."
                )
            return f"[ERROR]\n{error}"
        
        if stdout:
            response_parts.append(f"[OK] Output:\n{stdout}")
        elif result_value is not None:
            # Format DataFrames nicely
            if hasattr(result_value, 'to_string'):
                response_parts.append(f"[OK] Result:\n{result_value.to_string()}")
            else:
                response_parts.append(f"[OK] Result: {repr(result_value)}")
        else:
            response_parts.append("[OK] Ejecutado correctamente.")
        
        # Step 7: Detect new files and generate markdown links
        current_files = set(os.listdir(OUTPUT_DIR)) if os.path.exists(OUTPUT_DIR) else set()
        new_files = current_files - existing_files
        
        if new_files:
            response_parts.append("\n\n**ARCHIVOS GENERADOS** (Incluye estos links en tu respuesta final):")
            for f in sorted(new_files):
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    response_parts.append(f"![Gráfico generado](/files/outputs/{f})")
                else:
                    response_parts.append(f"[Descargar {f}](/files/outputs/{f})")
        
        return "\n".join(response_parts)


if __name__ == "__main__":
    import asyncio
    from agency_swarm import MasterContext, RunContextWrapper

    # Create context correctly for v1.x
    master_ctx = MasterContext(user_context={}, thread_manager=None, agents={})
    
    # Simulate MULTIPLE named queries (incidencia, prevalencia, mortalidad)
    named_queries = {
        "incidencia": {
            "results": [
                {"Nombre_OOAD": "Jalisco", "Casos_Nuevos": 15420, "Poblacion": 3500000},
                {"Nombre_OOAD": "CDMX Norte", "Casos_Nuevos": 22100, "Poblacion": 5200000},
                {"Nombre_OOAD": "Nuevo León", "Casos_Nuevos": 12300, "Poblacion": 2800000},
            ],
            "columns": ["Nombre_OOAD", "Casos_Nuevos", "Poblacion"],
            "row_count": 3
        },
        "prevalencia": {
            "results": [
                {"Nombre_OOAD": "Jalisco", "Pacientes": 85000, "Poblacion_Ref": 3500000},
                {"Nombre_OOAD": "CDMX Norte", "Pacientes": 120000, "Poblacion_Ref": 5200000},
                {"Nombre_OOAD": "Nuevo León", "Pacientes": 72000, "Poblacion_Ref": 2800000},
            ],
            "columns": ["Nombre_OOAD", "Pacientes", "Poblacion_Ref"],
            "row_count": 3
        },
        "mortalidad": {
            "results": [
                {"Nombre_OOAD": "Jalisco", "Defunciones": 1542, "Poblacion": 3500000},
                {"Nombre_OOAD": "CDMX Norte", "Defunciones": 2210, "Poblacion": 5200000},
                {"Nombre_OOAD": "Nuevo León", "Defunciones": 1230, "Poblacion": 2800000},
            ],
            "columns": ["Nombre_OOAD", "Defunciones", "Poblacion"],
            "row_count": 3
        },
        "__latest__": "mortalidad"
    }
    
    # Set both legacy and new format
    master_ctx.set("query_results", named_queries["mortalidad"]["results"])
    master_ctx.set("query_columns", named_queries["mortalidad"]["columns"])
    master_ctx.set("query_row_count", 3)
    master_ctx.set("named_queries", named_queries)
    
    ctx_wrapper = RunContextWrapper(context=master_ctx)
    
    # Test 1: List available queries
    print("Test 1 - Listar consultas disponibles:")
    tool = IPythonInterpreter(code="""
print("Consultas disponibles:")
for name, info in list_queries().items():
    print(f"  - {name}: {info['row_count']} filas, columnas: {info['columns']}")
""")
    tool._context = ctx_wrapper
    print(asyncio.run(tool.run()))
    
    # Test 2: Access multiple queries with get_query()
    print("\nTest 2 - Acceso multi-query con get_query():")
    tool2 = IPythonInterpreter(code="""
df_inc = get_query("incidencia")
df_prev = get_query("prevalencia")
df_mort = get_query("mortalidad")

print(f"Incidencia: {len(df_inc)} filas - Cols: {list(df_inc.columns)}")
print(f"Prevalencia: {len(df_prev)} filas - Cols: {list(df_prev.columns)}")
print(f"Mortalidad: {len(df_mort)} filas - Cols: {list(df_mort.columns)}")
""")
    tool2._context = ctx_wrapper
    print(asyncio.run(tool2.run()))
    
    # Test 3: Calculate rates from all three queries
    print("\nTest 3 - Calcular tasas de los 3 indicadores:")
    tool3 = IPythonInterpreter(code="""
df_inc = get_query("incidencia")
df_prev = get_query("prevalencia")
df_mort = get_query("mortalidad")

# Calculate rates
df_inc['Tasa_Incidencia'] = (df_inc['Casos_Nuevos'] / df_inc['Poblacion']) * 100000
df_prev['Prevalencia_Pct'] = (df_prev['Pacientes'] / df_prev['Poblacion_Ref']) * 100
df_mort['Tasa_Mortalidad'] = (df_mort['Defunciones'] / df_mort['Poblacion']) * 100000

# Merge into single summary
resumen = df_inc[['Nombre_OOAD', 'Tasa_Incidencia']].copy()
resumen['Prevalencia_Pct'] = df_prev['Prevalencia_Pct'].values
resumen['Tasa_Mortalidad'] = df_mort['Tasa_Mortalidad'].values

print("\\nResumen de indicadores por delegación:")
print(resumen.to_string(index=False, float_format='%.2f'))
""")
    tool3._context = ctx_wrapper
    print(asyncio.run(tool3.run()))
    
    # Test 4: Error handling - query not found
    print("\nTest 4 - Manejo de error (consulta no existe):")
    tool4 = IPythonInterpreter(code="""
try:
    df_fake = get_query("hospitalizaciones")
except KeyError as e:
    print(f"Error esperado: {e}")
""")
    tool4._context = ctx_wrapper
    print(asyncio.run(tool4.run()))
    
    print("\n=== Tests Complete ===")

