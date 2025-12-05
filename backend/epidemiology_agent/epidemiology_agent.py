from agency_swarm import Agent, ModelSettings


epidemiology_agent = Agent(
    name="epidemiology_agent",
    description="Expert epidemiologist specializing in diabetes surveillance for IMSS. Analyzes morbidity and mortality data through SQL queries.",
    instructions="./instructions.md",
    files_folder="./files",
    tools_folder="./tools",
    model="gpt-5.1",
    model_settings=ModelSettings(
        temperature=0.3,
    ),
)
