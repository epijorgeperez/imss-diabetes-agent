# IPythonInterpreter.py
from agency_swarm.tools import BaseTool
from pydantic import Field
from io import StringIO
import contextlib
import traceback
import os

# Output directory for generated files
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "files", "outputs")


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
    
    Librerías pre-importadas: pandas (pd), numpy (np), matplotlib.pyplot (plt), 
    seaborn (sns), json, datetime, os.
    
    Estilo institucional IMSS aplicado automáticamente a todas las gráficas.
    Variables e imports persisten entre ejecuciones de la misma sesión.
    
    Ejemplos de uso:
    - Crear DataFrame: `df = pd.DataFrame(query_results)`
    - Calcular tasas: `df['tasa'] = (df['casos'] / df['poblacion']) * 100000`
    - Guardar gráfica: `plt.savefig(f'{OUTPUT_DIR}/grafica.png')`
    - Usar colores institucionales: `plt.bar(x, y, color=EstiloInstitucional.VERDE_IMSS)`
    """

    code: str = Field(
        ..., 
        description="Código Python a ejecutar. Soporta múltiples líneas. Los datos de la última consulta SQL están en 'query_results'."
    )

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
            import json
            from datetime import datetime
            namespace.update({"json": json, "datetime": datetime, "os": os})
            
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
            
            self.context.set("python_namespace", namespace)
        
        # Step 3: Inject query_results from context if available
        query_results = self.context.get("query_results")
        if query_results is not None:
            namespace["query_results"] = query_results
            namespace["query_columns"] = self.context.get("query_columns", [])
            namespace["query_row_count"] = self.context.get("query_row_count", 0)
        
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
        
        # Step 5: Persist updated namespace
        self.context.set("python_namespace", namespace)
        
        stdout = output.getvalue().strip()
        
        # Step 6: Build response with file detection
        response_parts = []
        
        if error:
            return f"[ERROR]\n{error}"
        
        if stdout:
            response_parts.append(f"[OK] Output:\n{stdout}")
        elif result_value is not None:
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
    
    # Simulate query_results from QueryDatabase
    master_ctx.set("query_results", [
        {"Nombre_OOAD": "Jalisco", "casos": 15420, "poblacion": 3500000},
        {"Nombre_OOAD": "CDMX Norte", "casos": 22100, "poblacion": 5200000},
        {"Nombre_OOAD": "Nuevo León", "casos": 12300, "poblacion": 2800000},
    ])
    master_ctx.set("query_columns", ["Nombre_OOAD", "casos", "poblacion"])
    master_ctx.set("query_row_count", 3)
    
    ctx_wrapper = RunContextWrapper(context=master_ctx)
    
    # Test 1: Access query_results and calculate rates
    print("Test 1 - DataFrame y cálculo de tasas:")
    tool = IPythonInterpreter(code="""
df = pd.DataFrame(query_results)
df['tasa_incidencia'] = (df['casos'] / df['poblacion']) * 100000
print(df.to_string(index=False))
""")
    tool._context = ctx_wrapper
    print(asyncio.run(tool.run()))
    
    # Test 2: Variable persistence
    print("\nTest 2 - Persistencia de variables:")
    tool2 = IPythonInterpreter(code="print(f'Total casos: {df[\"casos\"].sum():,}')")
    tool2._context = ctx_wrapper
    print(asyncio.run(tool2.run()))
    
    # Test 3: Generate chart with institutional style
    print("\nTest 3 - Generar gráfica con estilo institucional:")
    tool3 = IPythonInterpreter(code="""
plt.figure(figsize=(12, 6))
plt.bar(df['Nombre_OOAD'], df['tasa_incidencia'])
plt.title('Tasa de Incidencia por Delegación')
plt.xlabel('Delegación')
plt.ylabel('Tasa por 100,000 hab.')
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig(f'{OUTPUT_DIR}/incidencia_test.png', dpi=150, bbox_inches='tight')
plt.close()
print(f"Gráfica guardada con colores institucionales en {OUTPUT_DIR}/incidencia_test.png")
""")
    tool3._context = ctx_wrapper
    print(asyncio.run(tool3.run()))

