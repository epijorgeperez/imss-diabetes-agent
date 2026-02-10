"""
User registration, authentication, and usage logging module.

Uses SQLite for zero-infra storage. Thread-safe for concurrent FastAPI requests.
"""
import sqlite3
import os
import json
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# --- Database path ---
DB_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DB_DIR, "users.db")

# Configurable domain
ALLOWED_EMAIL_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "imss.gob.mx")


def _get_db() -> sqlite3.Connection:
    """Get thread-safe SQLite connection with row factory."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")  # Better concurrency
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if they don't exist."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = _get_db()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                adscripcion TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS usage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                chat_id TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                message_preview TEXT,
                tools_used TEXT,
                response_duration_ms INTEGER,
                ip_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_email) REFERENCES users(email)
            );

            CREATE INDEX IF NOT EXISTS idx_usage_email ON usage_logs(user_email);
            CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_usage_chat ON usage_logs(chat_id);
        """)
        conn.commit()
        logger.info(f"AUTH: ✅ Database initialized at {DB_PATH}")
    finally:
        conn.close()


# --- User CRUD ---

def validate_email(email: str) -> bool:
    """Validate institutional email domain."""
    if not email or "@" not in email:
        return False
    domain = email.split("@")[-1].lower()
    return domain == ALLOWED_EMAIL_DOMAIN.lower()


def register_user(nombre: str, email: str, adscripcion: str) -> dict:
    """Register a new user. Returns user dict or raises ValueError."""
    email = email.strip().lower()
    
    if not validate_email(email):
        raise ValueError(f"El correo debe ser del dominio @{ALLOWED_EMAIL_DOMAIN}")
    
    if not nombre.strip():
        raise ValueError("El nombre es requerido")
    
    if not adscripcion.strip():
        raise ValueError("La adscripción es requerida")
    
    conn = _get_db()
    try:
        conn.execute(
            "INSERT INTO users (nombre, email, adscripcion, last_login) VALUES (?, ?, ?, ?)",
            (nombre.strip(), email, adscripcion.strip(), datetime.now().isoformat())
        )
        conn.commit()
        
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        logger.info(f"AUTH: ✅ Registered user: {email}")
        return dict(user)
    except sqlite3.IntegrityError:
        raise ValueError(f"El correo {email} ya está registrado")
    finally:
        conn.close()


def login_user(email: str) -> Optional[dict]:
    """Login by email. Returns user dict or None."""
    email = email.strip().lower()
    conn = _get_db()
    try:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if user:
            conn.execute(
                "UPDATE users SET last_login = ? WHERE email = ?",
                (datetime.now().isoformat(), email)
            )
            conn.commit()
            logger.info(f"AUTH: ✅ Login: {email}")
            return dict(user)
        return None
    finally:
        conn.close()


def get_all_users() -> list[dict]:
    """List all registered users."""
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT id, nombre, email, adscripcion, created_at, last_login FROM users ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# --- Usage Logging ---

def log_usage(
    user_email: str,
    chat_id: str,
    endpoint: str,
    message_preview: Optional[str] = None,
    tools_used: Optional[list[str]] = None,
    response_duration_ms: Optional[int] = None,
    ip_address: Optional[str] = None,
):
    """Log a usage event."""
    conn = _get_db()
    try:
        conn.execute(
            """INSERT INTO usage_logs 
               (user_email, chat_id, endpoint, message_preview, tools_used, response_duration_ms, ip_address)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                user_email.strip().lower(),
                chat_id,
                endpoint,
                (message_preview or "")[:200],
                json.dumps(tools_used) if tools_used else None,
                response_duration_ms,
                ip_address,
            )
        )
        conn.commit()
    except Exception as e:
        logger.error(f"AUTH: Failed to log usage: {e}")
    finally:
        conn.close()


def get_usage_logs(
    email: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    """Query usage logs with optional filters."""
    conn = _get_db()
    try:
        query = "SELECT * FROM usage_logs WHERE 1=1"
        params: list = []
        
        if email:
            query += " AND user_email = ?"
            params.append(email.strip().lower())
        if from_date:
            query += " AND created_at >= ?"
            params.append(from_date)
        if to_date:
            query += " AND created_at <= ?"
            params.append(to_date + " 23:59:59")
        
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(min(limit, 1000))
        
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_usage_stats() -> dict:
    """Aggregated usage statistics."""
    conn = _get_db()
    try:
        total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        total_requests = conn.execute("SELECT COUNT(*) FROM usage_logs").fetchone()[0]
        
        # Average duration
        avg_row = conn.execute(
            "SELECT AVG(response_duration_ms) FROM usage_logs WHERE response_duration_ms IS NOT NULL"
        ).fetchone()
        avg_duration_ms = round(avg_row[0]) if avg_row[0] else 0
        
        # Top users (by request count)
        top_users = conn.execute("""
            SELECT user_email, COUNT(*) as request_count, MAX(created_at) as last_active
            FROM usage_logs GROUP BY user_email ORDER BY request_count DESC LIMIT 10
        """).fetchall()
        
        # Requests per day (last 30 days)
        requests_per_day = conn.execute("""
            SELECT DATE(created_at) as day, COUNT(*) as count
            FROM usage_logs
            WHERE created_at >= DATE('now', '-30 days')
            GROUP BY DATE(created_at) ORDER BY day DESC
        """).fetchall()
        
        # Popular tools
        all_tools = conn.execute(
            "SELECT tools_used FROM usage_logs WHERE tools_used IS NOT NULL"
        ).fetchall()
        tool_counts: dict[str, int] = {}
        for row in all_tools:
            try:
                tools = json.loads(row[0])
                for t in tools:
                    tool_counts[t] = tool_counts.get(t, 0) + 1
            except (json.JSONDecodeError, TypeError):
                pass
        popular_tools = sorted(tool_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        
        # Anomaly detection: emails from multiple IPs
        multi_ip_users = conn.execute("""
            SELECT user_email, COUNT(DISTINCT ip_address) as ip_count
            FROM usage_logs GROUP BY user_email HAVING ip_count > 2
        """).fetchall()
        
        # Anomaly detection: IPs with multiple users
        multi_user_ips = conn.execute("""
            SELECT ip_address, COUNT(DISTINCT user_email) as user_count
            FROM usage_logs WHERE ip_address IS NOT NULL
            GROUP BY ip_address HAVING user_count > 1
        """).fetchall()
        
        return {
            "total_users": total_users,
            "total_requests": total_requests,
            "avg_duration_ms": avg_duration_ms,
            "top_users": [{"email": r[0], "request_count": r[1], "last_active": r[2]} for r in top_users],
            "requests_per_day": [{"day": r[0], "count": r[1]} for r in requests_per_day],
            "popular_tools": [{"tool": t, "count": c} for t, c in popular_tools],
            "anomalies": {
                "multi_ip_users": [{"email": r[0], "ip_count": r[1]} for r in multi_ip_users],
                "multi_user_ips": [{"ip": r[0], "user_count": r[1]} for r in multi_user_ips],
            }
        }
    finally:
        conn.close()


# Initialize on import
init_db()
