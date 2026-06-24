from __future__ import annotations

import json
from typing import Annotated, Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from typing_extensions import TypedDict

from shared.config import DEFAULT_EMPLOYEE_ID, OPENAI_API_KEY
from shared.rag import format_search_results, search_handbook
from shared.tasks import create_onboarding_task, list_onboarding_tasks, schedule_checkin

SYSTEM_PROMPT = """You are OnboardAI, Acme Corp's autonomous HR onboarding assistant.

Your role:
- Help new employees understand company policies using the employee handbook, benefits guide, and IT setup docs.
- Proactively create onboarding tasks when employees mention starting a new role or ask what to do.
- Schedule check-ins with managers or HR when appropriate.
- Always cite source documents when answering policy questions (e.g. employee-handbook.md).
- Never invent policies not found in the handbook. If unsure, say so and suggest contacting HR.

Employee context:
- Name: Alex Chen
- Role: Software Engineer
- Start date: Today (Day 1)
- Employee ID: alex-chen

When a new hire asks what to do this week, create relevant tasks from the onboarding checklist using create_onboarding_task.
Use categories: HR, IT, or Team."""


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    employee_id: str
    tool_calls_log: list[dict[str, Any]]


def build_tools(employee_id: str):
    @tool
    def search_handbook_tool(query: str) -> str:
        """Search HR handbook documents for policy and onboarding information."""
        results = search_handbook(query)
        return format_search_results(results)

    @tool
    def create_onboarding_task_tool(title: str, due_day: int, category: str) -> str:
        """Create an onboarding task. Category: HR, IT, or Team."""
        task = create_onboarding_task(employee_id, title, due_day, category)
        return json.dumps(task)

    @tool
    def list_onboarding_tasks_tool() -> str:
        """List all onboarding tasks for the current employee."""
        tasks = list_onboarding_tasks(employee_id)
        return json.dumps(tasks)

    @tool
    def schedule_checkin_tool(day: int, topic: str) -> str:
        """Schedule a manager or HR check-in for a specific onboarding day."""
        result = schedule_checkin(employee_id, day, topic)
        return json.dumps(result)

    return [
        search_handbook_tool,
        create_onboarding_task_tool,
        list_onboarding_tasks_tool,
        schedule_checkin_tool,
    ]


def build_agent(employee_id: str = DEFAULT_EMPLOYEE_ID):
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is required")

    tools = build_tools(employee_id)
    llm = ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=0.2)
    llm_with_tools = llm.bind_tools(tools)
    tool_node = ToolNode(tools)

    def agent_node(state: AgentState):
        response = llm_with_tools.invoke(
            [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
        )
        return {"messages": [response]}

    def should_continue(state: AgentState):
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")
    return graph.compile()


def run_agent(
    message: str,
    employee_id: str = DEFAULT_EMPLOYEE_ID,
    history: list[dict] | None = None,
) -> dict[str, Any]:
    agent = build_agent(employee_id)
    messages = []
    for item in history or []:
        if item["role"] == "user":
            messages.append(HumanMessage(content=item["content"]))
        elif item["role"] == "assistant":
            messages.append(AIMessage(content=item["content"]))
    messages.append(HumanMessage(content=message))

    tool_calls_log: list[dict[str, Any]] = []
    final_state = agent.invoke(
        {"messages": messages, "employee_id": employee_id, "tool_calls_log": tool_calls_log},
        config={"recursion_limit": 10},
    )

    # Extract tool calls from message history
    for msg in final_state["messages"]:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls_log.append({"name": tc["name"], "args": tc["args"]})

    # Get final assistant text
    assistant_text = ""
    for msg in reversed(final_state["messages"]):
        if isinstance(msg, AIMessage) and msg.content:
            assistant_text = msg.content if isinstance(msg.content, str) else str(msg.content)
            break

    # Extract citations from tool results
    citations = []
    for msg in final_state["messages"]:
        if isinstance(msg, ToolMessage) and "Source:" in str(msg.content):
            for line in str(msg.content).split("\n"):
                if line.startswith("[") and "Source:" in line:
                    source = line.split("Source:")[1].strip()
                    if source not in citations:
                        citations.append(source)

    return {
        "response": assistant_text,
        "tool_calls": tool_calls_log,
        "citations": citations,
    }


async def stream_agent(
    message: str,
    employee_id: str = DEFAULT_EMPLOYEE_ID,
    history: list[dict] | None = None):
    """Yield SSE events from agent execution."""
    result = run_agent(message, employee_id, history)
    yield {"event": "tool_calls", "data": result["tool_calls"]}
    yield {"event": "citations", "data": result["citations"]}
    # Stream response in chunks for UX
    text = result["response"]
    chunk_size = 40
    for i in range(0, len(text), chunk_size):
        yield {"event": "token", "data": text[i : i + chunk_size]}
    yield {"event": "done", "data": result["response"]}
