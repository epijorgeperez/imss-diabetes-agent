import os
from agency_swarm import Agent
from agents import ModelSettings
from openai.types.shared.reasoning import Reasoning
from onboarding_config import config
from agents.tool import WebSearchTool

# Get the absolute path to the current file's directory
current_dir = os.path.dirname(os.path.abspath(__file__))
instructions_path = os.path.join(current_dir, "instructions.md")

def render_instructions():
    """Render instructions template with config values and write to a temp file"""
    with open(instructions_path, "r") as file:
        template = file.read()

    # List all files in the credentials directory
    credentials_dir = os.path.join(os.path.dirname(current_dir), "credentials")
    credentials_files = []
    
    if os.path.exists(credentials_dir):
        for file in os.listdir(credentials_dir):
            # Skip hidden files and directories
            if not file.startswith('.'):
                file_path = os.path.join(credentials_dir, file)
                if os.path.isfile(file_path):
                    credentials_files.append(f"- `credentials/{file}`")
    
    # Format credentials files list
    credentials_files_str = "\n".join(credentials_files) if credentials_files else "- No credential files uploaded yet."

    rendered = template.format(
        analytics_apis=config["analytics_apis"],
        output_format=config["output_format"],
        additional_notes=config.get("additional_notes", ""),
        credentials_files=credentials_files_str
    )
    
    # Write rendered instructions to a file
    rendered_path = os.path.join(current_dir, "instructions_rendered.md")
    with open(rendered_path, "w") as f:
        f.write(rendered)
    
    return rendered_path

def get_model_settings():
    """Get model settings based on reasoning effort"""
    return ModelSettings(
        reasoning=Reasoning(
            effort=config["reasoning_effort"],
            summary="auto",
        ),
        truncation="auto"
    )

data_analyst = Agent(
    name="Data Analyst Agent",
    description=f"An agent that performs advanced data analytics and provides actionable insights for {config['company_name']}",
    instructions=render_instructions(),
    tools_folder=os.path.join(current_dir, "tools"),
    model="gpt-5",
    tools=[WebSearchTool()],
    model_settings=get_model_settings(),
)

