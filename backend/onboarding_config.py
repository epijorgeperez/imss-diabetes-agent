# Auto-generated onboarding configuration

config = {
    "company_name": "Your Company Name.",
    "business_overview": "* **Your Company Name** is an [industry type] company focused on [main business activities].\n* **Key Metrics:** Monthly Revenue, Conversion Rate, Customer LTV, Cart Abandonment.\n* **Data Sources:** Google Analytics, PostgreSQL database, Stripe API.\n* **Analytics Focus:** Revenue optimization and user behavior analysis.",
    "business_goals": "* Reach $1M/year in revenue.\n* Increase profit margin by 10%.\n* Reduce refund rate to below 1%.\n",
    "analytics_apis": "**Google Analytics 4**\n- Purpose: Web traffic and conversion data\n- Authentication: Service account JSON at `credentials/ga_service_account.json`\n- Property ID: UA-123456789-1\n\n**PostgreSQL Database**\n- Purpose: Customer and transaction data\n- Authentication: Connection string in `credentials/.env` as `DATABASE_URL`\n- Key Tables: users, orders, products\n\n**Stripe API**\n- Purpose: Payment and subscription data\n- Authentication: API key in `credentials/.env` as `STRIPE_API_KEY`\n- Rate Limits: 100 requests/second",
    "credentials_files": [],
    "reasoning_effort": "medium",
    "output_format": "**Scope and Sources**\n- Data sources and APIs used\n- Time period analyzed\n- Metrics examined\n\n**Key Findings**\n- 3-5 most important insights (use simple language)\n- Include relevant visualizations\n- Quantify results where possible\n\n**What to Do Next**\n- Immediate actionable recommendations\n- Prioritized by impact and ease\n\n**Assumptions and Limits**\n- Data quality notes\n- Missing information or gaps\n- Confidence level in findings\n\n**Follow-Up Actions**\n- Additional analysis needed\n- Data to track going forward\n- Questions to explore next"
}
