from agency_swarm.tools import BaseTool
from pydantic import Field
import os
from dotenv import load_dotenv
from typing import Literal, Optional

load_dotenv()

class OnboardingTool(BaseTool):
    """
    Customizes the Data Analyst Agent based on the client's specific analytics needs,
    APIs, and data sources before deployment.
    """
    
    company_name: str = Field(
        ..., 
        description="Your company name (used for agency branding and shared context).",
        json_schema_extra={
            "ui:placeholder": "Acme Corp",
        },
    )
    
    business_overview: str = Field(
        ...,
        description="Brief business overview including industry, key metrics, and analytics needs.",
        json_schema_extra={
            "ui:placeholder": 
                "* **[Company Name]** is a [industry type] company focused on [main business activities].\n"
                "* **Key Metrics:** [list important KPIs like revenue, users, conversions, etc.].\n"
                "* **Data Sources:** [databases, platforms, or files used].\n"
                "* **Analytics Focus:** [what insights or reports are most important].\n",
            "ui:widget": "textarea",
            "format": "textarea"
        },
    )

    business_goals: str = Field(
        ...,
        description="Please list 2-3 business goals for this year as a bullet list.",
        json_schema_extra={
            "ui:placeholder": 
                "* Reach $1M/year in revenue.\n"
                "* Increase profit margin by 10%.\n"
                "* Reduce refund rate to below 1%.\n",
            "ui:widget": "textarea",
            "format": "textarea"
        },
    )
    
    analytics_apis: str = Field(
        ...,
        description="List of analytics APIs and platforms with authentication details. Include platform name, purpose, credentials location, and usage notes.",
        json_schema_extra={
            "ui:placeholder": 
                "**Google Analytics 4**\n"
                "- Purpose: Web traffic and conversion data\n"
                "- Authentication: Uploaded service account JSON file`\n"
                "- Property ID: [your-property-id]\n\n"
                "**PostgreSQL Database**\n"
                "- Purpose: Customer and transaction data\n"
                "- Authentication: Added connection string to DB_CONNECTION_STRING environment variable\n"
                "- Relevant Table Names: users, orders, products\n\n"
                "**Stripe API**\n"
                "- Purpose: Payment and subscription data\n"
                "- Authentication: Added API key to STRIPE_API_KEY environment variable\n",
            "ui:widget": "textarea",
            "format": "textarea"
        },
    )
    
    credentials_files: list[str] = Field(
        default_factory=list,
        description="Upload API credentials files (JSON) needed for data access. You can also add individual environment variables (API Keys) at the bottom of this form.",
        json_schema_extra={
            "x-file-upload-path": "./credentials",
        },
    )
    
    reasoning_effort: Literal["medium", "high"] = Field(
        "medium",
        description="Reasoning effort level for complex data analysis tasks. Higher effort = more thorough analysis but slower responses.",
    )
    
    output_format: str = Field(
        default=(
            "**Scope and Sources**\n"
            "- Data sources and APIs used\n"
            "- Time period analyzed\n"
            "- Metrics examined\n\n"
            "**Key Findings**\n"
            "- 3-5 most important insights (use simple language)\n"
            "- Include relevant visualizations\n"
            "- Quantify results where possible\n\n"
            "**What to Do Now**\n"
            "- Immediate actionable recommendations\n"
            "- Prioritized by impact and ease\n\n"
            "**Assumptions and Limits**\n"
            "- Data quality notes\n"
            "- Missing information or gaps\n"
            "- Confidence level in findings\n\n"
            "**Follow-Up Actions**\n"
            "- Additional analysis needed\n"
            "- Data to track going forward\n"
            "- Questions to explore next"
        ),
        description="Desired output format for analysis reports and visualizations.",
        json_schema_extra={
            "ui:widget": "textarea",
            "format": "textarea"
        },
    )
    
    additional_notes: Optional[str] = Field(
        None, 
        description="Any additional context, constraints, or requirements for the agent.",
        json_schema_extra={
            "ui:placeholder": 
                "- Focus on executive-level insights\n"
                "- Avoid technical jargon\n"
                "- Always validate data quality before analysis",
            "ui:widget": "textarea",
            "format": "textarea"
        },
    )

    def run(self):
        """
        Saves the configuration as a Python file with a config object
        """
        tool_dir = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(tool_dir, "onboarding_config.py")

        config = self.model_dump(exclude_none=True)

        try:
            # Generate Python code with the config as a dictionary
            import json
            
            # Convert to properly formatted Python dict
            python_code = "# Auto-generated onboarding configuration\n\n"
            python_code += "config = {\n"
            
            for i, (key, value) in enumerate(config.items()):
                python_code += f"    \"{key}\": {json.dumps(value, ensure_ascii=False)}"
                if i < len(config) - 1:
                    python_code += ","
                python_code += "\n"
            
            python_code += "}\n"
            
            with open(config_path, "w", encoding="utf-8") as f:
                f.write(python_code)
            
            return f"Configuration saved at: {config_path}\n\nYou can now import it with:\nfrom onboarding_config import config"
        except Exception as e:
            return f"Error writing config file: {str(e)}"

if __name__ == "__main__":
    tool = OnboardingTool(
        company_name="Your Company Name.",
        business_overview=(
            "* **Your Company Name** is an [industry type] company focused on [main business activities].\n"
            "* **Key Metrics:** Monthly Revenue, Conversion Rate, Customer LTV, Cart Abandonment.\n"
            "* **Data Sources:** Google Analytics, PostgreSQL database, Stripe API.\n"
            "* **Analytics Focus:** Revenue optimization and user behavior analysis."
        ),
        business_goals=(
            "* Reach $1M/year in revenue.\n"
            "* Increase profit margin by 10%.\n"
            "* Reduce refund rate to below 1%.\n"
        ),
        analytics_apis=(
            "**Google Analytics 4**\n"
            "- Purpose: Web traffic and conversion data\n"
            "- Authentication: Service account JSON at `credentials/ga_service_account.json`\n"
            "- Property ID: UA-123456789-1\n\n"
            "**PostgreSQL Database**\n"
            "- Purpose: Customer and transaction data\n"
            "- Authentication: Connection string in `credentials/.env` as `DATABASE_URL`\n"
            "- Key Tables: users, orders, products\n\n"
            "**Stripe API**\n"
            "- Purpose: Payment and subscription data\n"
            "- Authentication: API key in `credentials/.env` as `STRIPE_API_KEY`\n"
            "- Rate Limits: 100 requests/second"
        ),
        credentials_files=[],
        reasoning_effort="medium",
        output_format=(
            "**Scope and Sources**\n"
            "- Data sources and APIs used\n"
            "- Time period analyzed\n"
            "- Metrics examined\n\n"
            "**Key Findings**\n"
            "- 3-5 most important insights (use simple language)\n"
            "- Include relevant visualizations\n"
            "- Quantify results where possible\n\n"
            "**What to Do Next**\n"
            "- Immediate actionable recommendations\n"
            "- Prioritized by impact and ease\n\n"
            "**Assumptions and Limits**\n"
            "- Data quality notes\n"
            "- Missing information or gaps\n"
            "- Confidence level in findings\n\n"
            "**Follow-Up Actions**\n"
            "- Additional analysis needed\n"
            "- Data to track going forward\n"
            "- Questions to explore next"
        ),
    )
    print(tool.run())

