# Agente Analítico de Diabetes IMSS

Sistema conversacional para consulta de indicadores de morbilidad y mortalidad por diabetes en el Instituto Mexicano del Seguro Social.

## Arquitectura

Monorepo que integra:

- **Backend**: Agent based en `agency-swarm` con herramientas personalizadas para consulta SQL Server
- **Frontend**: Interfaz de chat basada en Next.js con streaming support

## Estructura

```
imss-diabetes-agent/
├── backend/           # FastAPI + Agency Swarm + SQL Server
├── frontend/          # Next.js + React + Streaming UI
└── deploy.sh          # Script de despliegue automatizado
```

## Stack Tecnológico

### Backend
- Python 3.11+
- FastAPI
- Agency Swarm
- pyodbc (ODBC Driver 17 for SQL Server)
- OpenAI API

### Frontend
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Redis (persistencia local)

## Configuración

### Prerrequisitos

1. ODBC Driver 17 for SQL Server instalado
2. Python 3.11+
3. Node.js 20+
4. Redis (local o Docker)

### Variables de Entorno

#### Backend (`backend/.env`)
```
OPENAI_API_KEY=sk-...
DB_SERVER=11.33.41.96
DB_NAME=nombre_db
DB_USER=usuario
DB_PASSWORD=password
```

#### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
AUTH_SECRET=your-secret-here
POSTGRES_URL=postgresql://...
KV_URL=redis://localhost:6379
```

## Instalación

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd frontend
pnpm install
```

## Desarrollo

```bash
# Terminal 1: Backend
cd backend
python main.py

# Terminal 2: Frontend
cd frontend
pnpm dev
```

## Despliegue

```bash
# En el servidor Ubuntu
./deploy.sh
```

## Características

- Consulta de indicadores epidemiológicos mediante lenguaje natural
- Generación automática de SQL optimizado
- Visualización de datos y reportes
- Streaming de respuestas en tiempo real
- Persistencia de conversaciones
- Autenticación de usuarios

## Seguridad

- Conexión SQL Server legacy con parámetros `Encrypt=no` y `TrustServerCertificate=yes`
- Despliegue on-premise en red institucional
- Acceso híbrido: Internet (OpenAI) + Intranet (SQL Server)

