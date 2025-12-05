from dotenv import load_dotenv
from agency_swarm import Agency

from epidemiology_agent import epidemiology_agent

load_dotenv()


def create_agency(load_threads_callback=None):
    """
    Creates the IMSS Diabetes Analytical Agency.
    
    This is a single-agent agency where the epidemiology_agent handles all
    user interactions directly. No communication flows are needed since
    there's only one agent.
    """
    agency = Agency(
        epidemiology_agent,
        name="IMSS-Diabetes-Agency",
        shared_instructions="shared_instructions.md",
        load_threads_callback=load_threads_callback,
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
