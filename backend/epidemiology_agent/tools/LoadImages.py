# LoadImages.py
import base64
import mimetypes
import os
from typing import List

from agents.tool import ToolOutputImage, function_tool

# Output directory where images are saved
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "files", "outputs")


@function_tool
def load_images(file_paths: List[str]) -> List[ToolOutputImage]:
    """
    Carga imágenes desde el sistema de archivos y las retorna para análisis visual.
    
    Permite al agente "ver" las gráficas generadas con matplotlib/seaborn
    para analizarlas y extraer insights visuales.
    
    Soporta rutas absolutas y relativas. Solo archivos de imagen (PNG, JPG, etc.).
    Si la ruta no es absoluta, busca primero en el directorio de outputs.
    
    Args:
        file_paths: Lista de rutas a archivos de imagen. Puede ser:
                   - Ruta absoluta: "/path/to/image.png"
                   - Nombre de archivo: "grafica.png" (busca en outputs/)
                   - Ruta relativa: "./files/outputs/grafica.png"
    
    Returns:
        Lista de ToolOutputImage con las imágenes codificadas en base64.
    
    Ejemplo:
        load_images(["incidencia_2024.png", "piramide_poblacional.png"])
    """
    results = []
    
    for file_path in file_paths:
        # Step 1: Resolve file path
        if os.path.isabs(file_path):
            full_path = file_path
        else:
            # Try output directory first
            output_path = os.path.join(OUTPUT_DIR, file_path)
            if os.path.exists(output_path):
                full_path = output_path
            else:
                # Fall back to current working directory
                full_path = os.path.abspath(file_path)

        # Step 2: Validate file exists
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Archivo no encontrado: {file_path}")
        
        if not os.path.isfile(full_path):
            raise IsADirectoryError(f"La ruta es un directorio, no un archivo: {file_path}")
        
        # Step 3: Validate MIME type
        mime_type, _ = mimetypes.guess_type(full_path)
        if not (mime_type and mime_type.startswith('image/')):
            raise ValueError(f"Tipo de archivo no soportado: {mime_type or 'desconocido'}. Solo se permiten imágenes.")

        # Step 4: Read and encode image
        with open(full_path, 'rb') as f:
            file_content = f.read()
            base64_content = base64.b64encode(file_content).decode('utf-8')
        
        data_url = f"data:{mime_type};base64,{base64_content}"
        results.append(ToolOutputImage(image_url=data_url))
    
    return results


if __name__ == "__main__":
    import asyncio
    import json
    from agency_swarm import MasterContext, RunContextWrapper
    
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Create a test image using matplotlib
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import numpy as np
        
        # Generate test chart
        delegaciones = ['Jalisco', 'CDMX', 'Nuevo León', 'Puebla', 'Veracruz']
        tasas = [440.5, 425.0, 439.3, 380.2, 410.8]
        
        plt.figure(figsize=(10, 6))
        plt.bar(delegaciones, tasas, color='steelblue')
        plt.title('Tasa de Incidencia de Diabetes por Delegación')
        plt.xlabel('Delegación')
        plt.ylabel('Tasa por 100,000 habitantes')
        plt.tight_layout()
        
        test_image_path = os.path.join(OUTPUT_DIR, "test_chart.png")
        plt.savefig(test_image_path, dpi=150)
        plt.close()
        print(f"Test image created: {test_image_path}")
        
        # Test load_images
        ctx = MasterContext(user_context={}, thread_manager=None, agents={})
        run_ctx = RunContextWrapper(context=ctx)
        
        result = asyncio.run(load_images.on_invoke_tool(
            run_ctx, 
            json.dumps({"file_paths": ["test_chart.png"]})
        ))
        
        print(f"Load result type: {type(result)}")
        print(f"Image loaded successfully: {len(str(result)) > 100}")
        
    except ImportError as e:
        print(f"Could not run visual test (matplotlib not available): {e}")

