import os

from shared.utils import silence_warnings_and_logs

silence_warnings_and_logs()

import litellm  # noqa: E402 - must import after warning suppression
from agency_swarm import Agency  # noqa: E402 - must import after warning suppression
from dotenv import load_dotenv  # noqa: E402 - must import after warning suppression

from data_analyst_agent import data_analyst  # noqa: E402 - must import after warning suppression
from onboarding_config import config  # noqa: E402 - must import after warning suppression

load_dotenv()

current_dir = os.path.dirname(os.path.abspath(__file__))
litellm.modify_params = True

def render_shared_instructions():
    """Render shared instructions template with config values"""
    shared_instructions_path = os.path.join(current_dir, "shared_instructions.md")
    
    with open(shared_instructions_path, "r") as file:
        template = file.read()
    
    rendered = template.format(
        company_name=config["company_name"],
        business_overview=config["business_overview"] or "Not provided.",
        business_goals=config["business_goals"] or "Not provided.",
    )
    
    return rendered

def create_agency(load_threads_callback=None):
    # Use company name for agency branding
    agency_name = f"{config['company_name']} Analytics Agency"
    
    agency = Agency(
        data_analyst,
        name=agency_name,
        communication_flows=[],
        load_threads_callback=load_threads_callback,
        shared_instructions=render_shared_instructions(),
    )
    return agency

if __name__ == "__main__":
    agency = create_agency()
    agency.terminal_demo()
