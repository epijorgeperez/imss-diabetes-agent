'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

interface TermsModalProps {
  open: boolean
  onAccept: () => Promise<void>
  userEmail: string
}

export function TermsModal({ open, onAccept, userEmail }: TermsModalProps) {
  const [isAccepting, setIsAccepting] = useState(false)

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      await onAccept()
    } finally {
      setIsAccepting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Términos y Condiciones de Uso: Prototipo Experimental de Análisis de Diabetes
          </CardTitle>
          <CardDescription>
            IMPORTANTE: LEA ATENTAMENTE ANTES DE CONTINUAR
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">Naturaleza del Aplicativo</h3>
                <p className="text-muted-foreground">
                  Esta herramienta es un prototipo experimental que se encuentra actualmente en fase de pruebas. 
                  Su propósito es estrictamente de consulta y análisis estadístico sobre indicadores de morbi-mortalidad 
                  por diabetes en el IMSS.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Limitación de Responsabilidad del LLM</h3>
                <p className="text-muted-foreground">
                  El sistema utiliza modelos de lenguaje extenso (LLM) y herramientas automatizadas para consultar 
                  bases de datos SQL Server. Debido a la naturaleza de estas tecnologías, existe la posibilidad de 
                  &quot;alucinaciones&quot; o errores en la generación de consultas y reportes.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Verificación Obligatoria</h3>
                <p className="text-muted-foreground">
                  No se asegura la exactitud, integridad o veracidad de las respuestas, reportes e interpretaciones 
                  generadas por el agente. Es responsabilidad obligatoria del usuario corroborar cualquier dato o hallazgo 
                  con las fuentes oficiales y bases de datos primarias antes de su uso en cualquier toma de decisiones o informe.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Uso Ético y Prohibiciones</h3>
                <p className="text-muted-foreground">
                  El usuario se compromete a no hacer mal uso del agente, del modelo ni de la información extraída. 
                  Queda estrictamente prohibido intentar vulnerar la seguridad del sistema o utilizar los datos para 
                  fines distintos al análisis institucional autorizado.
                </p>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium">
                  Al hacer clic en &quot;Aceptar&quot;, usted confirma que comprende el carácter experimental de esta 
                  herramienta y asume total responsabilidad por el uso e interpretación de la información proporcionada.
                </p>
              </div>
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter>
          <Button
            onClick={handleAccept}
            disabled={isAccepting}
            className="w-full sm:w-auto"
          >
            {isAccepting ? 'Procesando...' : 'Aceptar'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
