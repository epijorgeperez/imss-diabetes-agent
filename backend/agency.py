import json
from pathlib import Path
from dotenv import load_dotenv
from agency_swarm import Agency

from epidemiology_agent import epidemiology_agent

load_dotenv()

# Persistence directory for chat history
PERSISTENCE_DIR = Path("files/thread_state")
PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)


def load_threads_for_chat(chat_id: str):
    """
    Load conversation history for a specific chat_id.
    Each conversation is stored in: files/thread_state/messages_{chat_id}.json
    """
    if not chat_id:
        return []
    
    thread_file = PERSISTENCE_DIR / f"messages_{chat_id}.json"
    
    if not thread_file.exists():
        return []
    
    try:
        with thread_file.open("r", encoding="utf-8") as f:
            messages = json.load(f)
        return messages if isinstance(messages, list) else []
    except (json.JSONDecodeError, IOError, OSError) as e:
        print(f"Warning: Could not load threads for chat_id {chat_id}: {e}")
        return []


def save_threads_for_chat(messages, chat_id: str):
    """
    Save conversation history for a specific chat_id.
    Each conversation is stored in: files/thread_state/messages_{chat_id}.json
    """
    if not isinstance(messages, list) or not chat_id:
        return
    
    thread_file = PERSISTENCE_DIR / f"messages_{chat_id}.json"
    
    try:
        thread_file.parent.mkdir(parents=True, exist_ok=True)
        with thread_file.open("w", encoding="utf-8") as f:
            json.dump(messages, f, indent=2, default=str)
    except (IOError, OSError) as e:
        print(f"Warning: Could not save threads for chat_id {chat_id}: {e}")


def create_agency(load_threads_callback=None, save_threads_callback=None):
    """
    Creates the IMSS Diabetes Analytical Agency.
    
    This is a single-agent agency where the epidemiology_agent handles all
    user interactions directly. No communication flows are needed since
    there's only one agent.
    
    Args:
        load_threads_callback: Function to load conversation history (provided by Agency Swarm)
        save_threads_callback: Function to save conversation history (provided by Agency Swarm)
    """
    # Use provided callbacks from Agency Swarm, or fallback to no-op
    load_callback = load_threads_callback if load_threads_callback else lambda: []
    save_callback = save_threads_callback if save_threads_callback else lambda msgs: None
    
    agency = Agency(
        epidemiology_agent,
        name="IMSS-Diabetes-Agency",
        shared_instructions="shared_instructions.md",
        load_threads_callback=load_callback,
        save_threads_callback=save_callback,
    )

    return agency


if __name__ == "__main__":
    agency = create_agency()
    
    # Run in terminal mode for testing
    agency.terminal_demo()
    
    # Alternative: Test with a single query
    # import asyncio
    # async def test():
    #     response = await agency.get_response("¿Cuántos casos nuevos de diabetes hubo en 2024?")
    #     print(response)
    # asyncio.run(test())
