# local_shell_tool.py
from agency_swarm.tools import BaseTool
from pydantic import Field
import subprocess
import os


class LocalShellTool(BaseTool):
    """
    Execute shell commands locally with persistent working directory.
    
    Allows the agent to run any shell commands like bash, file operations,
    package installations, etc. The working directory persists across commands
    within the same session.
    """

    command: str = Field(
        ..., 
        description="Shell command to execute (e.g., 'ls -la', 'cat file.txt')"
    )

    async def run(self) -> str:
        """
        Execute the shell command and return output.
        """
        cwd = os.getcwd()  # Default working directory
        
        try:
            # Get persistent working directory from shared state
            try:
                cwd = self._shared_state.get("shell_cwd")
                if cwd is None:
                    cwd = os.getcwd()
                    self._shared_state.set("shell_cwd", cwd)
            except (AttributeError, Exception):
                # If shared state is not available, use current directory
                cwd = os.getcwd()
            
            # Execute command
            result = subprocess.run(
                self.command,
                shell=True,
                capture_output=True,
                text=True,
                cwd=cwd,
                timeout=300  # 5 minute timeout
            )
            
            # Update working directory if cd command was used
            if self.command.strip().startswith('cd '):
                # Parse the new directory
                new_dir = self.command.strip()[3:].strip()
                if new_dir:
                    # Resolve relative paths
                    if not os.path.isabs(new_dir):
                        new_dir = os.path.join(cwd, new_dir)
                    new_dir = os.path.abspath(new_dir)
                    
                    # Update if directory exists
                    if os.path.isdir(new_dir):
                        try:
                            self._shared_state.set("shell_cwd", new_dir)
                        except (AttributeError, Exception):
                            pass  # Shared state not available
                        cwd = new_dir
            
            # Format output
            output_parts = []
            
            if result.stdout:
                output_parts.append(f"**Output:**\n```\n{result.stdout.strip()}\n```")
            
            if result.stderr:
                output_parts.append(f"**Stderr:**\n```\n{result.stderr.strip()}\n```")
            
            if result.returncode != 0:
                output_parts.append(f"**Exit Code:** {result.returncode}")
            
            if not output_parts:
                output_parts.append("✅ Command executed successfully (no output)")
            
            output = "\n\n".join(output_parts)
            output += f"\n\n**Working Directory:** `{cwd}`"
            
            return output
            
        except subprocess.TimeoutExpired:
            return f"❌ Error: Command timed out after 5 minutes\n\n**Working Directory:** `{cwd}`"
        except Exception as e:
            return f"❌ Error executing command: {str(e)}\n\n**Working Directory:** `{cwd}`"


if __name__ == "__main__":
    import asyncio
    from agency_swarm import MasterContext

    ctx = MasterContext(user_context={}, thread_manager=None, agents={})
    
    # Test basic command
    tool1 = LocalShellTool(command="echo 'Hello World'")
    tool1._context = ctx
    print("Test 1 - Echo:")
    print(asyncio.run(tool1.run()))
    print("\n" + "="*50 + "\n")
    
    # Test directory listing
    tool2 = LocalShellTool(command="ls -la")
    tool2._context = ctx
    print("Test 2 - List directory:")
    print(asyncio.run(tool2.run()))
    print("\n" + "="*50 + "\n")
    
    # Test cd command
    tool3 = LocalShellTool(command="cd .. && pwd")
    tool3._context = ctx
    print("Test 3 - Change directory:")
    print(asyncio.run(tool3.run()))

