from agency_swarm.tools import BaseTool
from pydantic import Field
from fpdf import FPDF
import os

# Directorio compartido
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "files", "outputs")

# ==========================================
# GESTIÓN DE COLORES INSTITUCIONALES (RGB)
# ==========================================
class EstiloInstitucional:
    """
    Definición estática de colores institucionales en formato RGB (Tuplas).
    """
    NEGRO = (34, 34, 35)
    VERDE_IMSS = (0, 89, 76)       # Encabezados de tabla
    GRIS_TEXTO = (177, 179, 179)
    TINTO = (101, 29, 50)          
    ROJO_GOB = (155, 34, 66)       # Títulos
    DORADO_IMSS = (173, 132, 31)   # Subtítulos de tabla
    BLANCO = (255, 255, 255)

# ==========================================
# MOTOR DE PDF
# ==========================================
class PDFReporte(FPDF):
    def __init__(self, titulo="Reporte Institucional"):
        super().__init__()
        self.titulo_reporte = titulo
        self.set_auto_page_break(auto=True, margin=15)

    def header(self):
        # 1. Franja Verde Institucional
        # El operador '*' desempaqueta la tupla (0, 89, 76) en los 3 argumentos que pide FPDF
        self.set_fill_color(*EstiloInstitucional.VERDE_IMSS)
        self.rect(0, 0, 210, 20, 'F')
        
        # 2. Título
        self.set_font('helvetica', 'B', 16)
        self.set_text_color(*EstiloInstitucional.BLANCO)
        
        # Limpieza de caracteres para el título
        titulo_safe = self.titulo_reporte
        try:
            titulo_safe = titulo_safe.encode('latin-1', 'replace').decode('latin-1')
        except: pass
        
        self.cell(0, 10, titulo_safe, 0, 1, 'C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(128)
        self.cell(0, 10, f'Página {self.page_no()} - Generado por Agente IA IMSS', 0, 0, 'C')

    def agregar_seccion(self, titulo, cuerpo):
        if not cuerpo: return

        # Títulos en ROJO GOBIERNO
        self.set_text_color(*EstiloInstitucional.ROJO_GOB)
        self.set_font('helvetica', 'B', 12)
        
        try:
            titulo = titulo.encode('latin-1', 'replace').decode('latin-1')
        except: pass
        
        self.cell(0, 10, titulo, 0, 1, 'L')
        
        # Cuerpo en Negro Institucional
        self.set_text_color(*EstiloInstitucional.NEGRO)
        self.set_font('helvetica', '', 10)
        
        try:
            cuerpo = cuerpo.encode('latin-1', 'replace').decode('latin-1')
        except: pass
            
        self.multi_cell(0, 6, cuerpo)
        self.ln(5)

    def agregar_imagen_existente(self, nombre_archivo):
        ruta_completa = os.path.join(OUTPUT_DIR, nombre_archivo)
        if os.path.exists(ruta_completa):
            try:
                self.image(ruta_completa, x=20, w=170)
                self.ln(5)
            except Exception:
                self.set_text_color(255, 0, 0)
                self.cell(0, 10, f"[Error imagen: {nombre_archivo}]", 0, 1)

    def agregar_tabla_datos(self, titulo_tabla, datos):
        """Genera una tabla con estilo IMSS"""
        if not datos: return

        self.ln(5)
        
        # Título de la tabla (Dorado IMSS)
        self.set_text_color(*EstiloInstitucional.DORADO_IMSS)
        self.set_font('helvetica', 'B', 10)
        
        try:
            titulo_tabla = titulo_tabla.encode('latin-1', 'replace').decode('latin-1')
        except: pass
        self.cell(0, 8, titulo_tabla, 0, 1, 'L')

        # Renderizar Tabla
        with self.table() as table:
            for i, fila in enumerate(datos):
                row = table.row()
                for dato in fila:
                    # ESTILO DEL ENCABEZADO (Fila 0)
                    if i == 0:
                        self.set_fill_color(*EstiloInstitucional.VERDE_IMSS)
                        self.set_text_color(*EstiloInstitucional.BLANCO)
                        self.set_font('helvetica', 'B', 9)
                    # ESTILO DEL CUERPO
                    else:
                        # Alternar gris muy claro en filas pares
                        if i % 2 == 0:
                            self.set_fill_color(245, 245, 245)
                        else:
                            self.set_fill_color(*EstiloInstitucional.BLANCO)
                            
                        self.set_text_color(*EstiloInstitucional.NEGRO)
                        self.set_font('helvetica', '', 9)
                    
                    texto = str(dato)
                    try:
                        texto = texto.encode('latin-1', 'replace').decode('latin-1')
                    except: pass
                    
                    row.cell(texto)
        self.ln(10)

# ==========================================
# TOOL DE AGENCY SWARM
# ==========================================
class GenerateReportTool(BaseTool):
    """
    Ensambla un reporte PDF profesional con identidad gráfica IMSS.
    Soporta texto narrativo, imágenes (gráficos) y tablas de datos estructuradas.
    """
    
    titulo: str = Field(..., description="Título principal del reporte.")
    introduccion: str = Field(..., description="Contexto general.")
    analisis: str = Field(..., description="Interpretación detallada.")
    conclusiones: str = Field(..., description="Recomendaciones finales.")
    
    imagenes: list[str] = Field(
        default=[], 
        description="Lista de nombres de archivos .png generados previamente con IPythonInterpreter."
    )
    
    datos_tablas: list[dict] = Field(
        default=[],
        description="""
        Lista de tablas para incluir. Estructura:
        {
            "titulo": "Top 10 Unidades",
            "filas": [ ["Unidad", "Tasa"], ["UMF 1", "45.2"], ... ]
        }
        La primera fila SIEMPRE son los encabezados.
        """
    )
    
    nombre_archivo_salida: str = Field(..., description="Nombre del PDF (sin extensión).")

    def run(self):
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        archivo_final = f"{self.nombre_archivo_salida}.pdf"
        ruta_pdf = os.path.join(OUTPUT_DIR, archivo_final)
        
        pdf = PDFReporte(titulo=self.titulo)
        pdf.add_page()
        
        # 1. Introducción
        pdf.agregar_seccion("1. Introducción", self.introduccion)
        
        # 2. Tablas
        if self.datos_tablas:
            self.set_text_color_safe(pdf, EstiloInstitucional.ROJO_GOB)
            pdf.set_font('helvetica', 'B', 12)
            pdf.cell(0, 10, "2. Datos Estadísticos Clave", 0, 1, 'L')
            
            for tabla in self.datos_tablas:
                pdf.agregar_tabla_datos(tabla.get("titulo", "Tabla de Datos"), tabla.get("filas", []))
        
        # 3. Gráficos
        if self.imagenes:
            self.set_text_color_safe(pdf, EstiloInstitucional.ROJO_GOB)
            pdf.set_font('helvetica', 'B', 12)
            pdf.cell(0, 10, "3. Evidencia Gráfica", 0, 1, 'L')
            
            for img in self.imagenes:
                pdf.agregar_imagen_existente(img)

        # 4. Análisis y Conclusiones
        pdf.agregar_seccion("4. Análisis e Interpretación", self.analisis)
        pdf.agregar_seccion("5. Conclusiones y Recomendaciones", self.conclusiones)
        
        try:
            pdf.output(ruta_pdf)
        except Exception as e:
            return f"[ERROR] {str(e)}"
            
        return f"Reporte generado con éxito.\n\n[Descargar Reporte PDF](/files/outputs/{archivo_final})"

    def set_text_color_safe(self, pdf, color_tuple):
        """Helper para desempaquetar color sin errores fuera de la clase PDF"""
        pdf.set_text_color(*color_tuple)