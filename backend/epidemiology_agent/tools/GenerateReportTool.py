from agency_swarm.tools import BaseTool
from pydantic import Field
from fpdf import FPDF
from fpdf.enums import XPos, YPos
import os

# Directorio compartido
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "files", "outputs")
ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "files", "assets")

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
        self.set_top_margin(45)  # Espacio para header + título

    def header(self):
        # 1. Fondo blanco para el header
        self.set_fill_color(*EstiloInstitucional.BLANCO)
        self.rect(0, 0, 210, 30, 'F')
        
        # 2. Logo IMSS izquierda
        logo_imss = os.path.join(ASSETS_DIR, "logo_imss.png")
        if os.path.exists(logo_imss):
            try:
                # Logo de 780x191 px tiene ratio 4:1 (ancho:alto)
                # Con altura 12mm, el ancho será ~48mm
                self.image(logo_imss, x=15, y=5, h=12)
            except: pass
        
        # 3. Leyenda institucional derecha (3 líneas)
        self.set_font('helvetica', '', 7)
        self.set_text_color(*EstiloInstitucional.VERDE_IMSS)
        
        # Línea 1
        self.set_xy(120, 6)
        self.cell(0, 4, "Dirección de Prestaciones Médicas", align='R', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        # Línea 2
        self.set_xy(120, 10)
        self.cell(0, 4, "Unidad de Planeación e Innovación en Salud", align='R', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        # Línea 3
        self.set_xy(120, 14)
        self.cell(0, 4, "Coordinación de Vigilancia Epidemiológica", align='R', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        # 4. Línea separadora verde institucional
        self.set_draw_color(*EstiloInstitucional.VERDE_IMSS)
        self.set_line_width(0.5)
        self.line(10, 25, 200, 25)
        
        # 5. Título del reporte debajo de la línea
        self.set_xy(10, 28)
        self.set_font('helvetica', 'B', 14)
        self.set_text_color(*EstiloInstitucional.NEGRO)
        
        titulo_safe = self.titulo_reporte
        try:
            titulo_safe = titulo_safe.encode('latin-1', 'replace').decode('latin-1')
        except: pass
        
        self.multi_cell(0, 6, titulo_safe, align='C')
        self.ln(3)

    def footer(self):
        self.set_y(-15)
        
        # Línea separadora verde
        self.set_draw_color(*EstiloInstitucional.VERDE_IMSS)
        self.set_line_width(0.3)
        self.line(10, self.get_y(), 200, self.get_y())
        
        self.set_y(-12)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(*EstiloInstitucional.GRIS_TEXTO)
        self.cell(0, 10, f'Página {self.page_no()} - Generado por Agente IA IMSS', align='C', new_x=XPos.RIGHT, new_y=YPos.TOP)

    def agregar_seccion(self, titulo, cuerpo):
        if not cuerpo: return

        # Títulos en ROJO GOBIERNO
        self.set_text_color(*EstiloInstitucional.ROJO_GOB)
        self.set_font('helvetica', 'B', 12)
        
        try:
            titulo = titulo.encode('latin-1', 'replace').decode('latin-1')
        except: pass
        
        self.cell(0, 10, titulo, align='L', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        # Cuerpo en Negro Institucional
        self.set_text_color(*EstiloInstitucional.NEGRO)
        self.set_font('helvetica', '', 10)
        
        # Limpiar texto: convertir \n literales a saltos reales y remover LaTeX
        import re
        cuerpo = cuerpo.replace('\\n', '\n')  # Convertir \n literal a salto real
        cuerpo = re.sub(r'\$\$(.+?)\$\$', r'[\1]', cuerpo, flags=re.DOTALL)  # LaTeX block → [formula]
        cuerpo = re.sub(r'\$(.+?)\$', r'[\1]', cuerpo)  # LaTeX inline → [formula]
        cuerpo = re.sub(r'\*\*(.+?)\*\*', r'\1', cuerpo)  # Remove markdown bold
        cuerpo = re.sub(r'\n{3,}', '\n\n', cuerpo)  # Max 2 newlines consecutivos
        
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
        self.cell(0, 8, titulo_tabla, align='L', new_x=XPos.LMARGIN, new_y=YPos.NEXT)

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
            pdf.cell(0, 10, "2. Datos Estadísticos Clave", align='L', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            
            for tabla in self.datos_tablas:
                pdf.agregar_tabla_datos(tabla.get("titulo", "Tabla de Datos"), tabla.get("filas", []))
        
        # 3. Gráficos
        if self.imagenes:
            self.set_text_color_safe(pdf, EstiloInstitucional.ROJO_GOB)
            pdf.set_font('helvetica', 'B', 12)
            pdf.cell(0, 10, "3. Evidencia Gráfica", align='L', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            
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