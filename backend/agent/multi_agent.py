from __future__ import annotations

import json
from typing import Annotated, Any, Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from agent.tools import build_research_tools, build_workflow_tools
from shared.config import OPENAI_API_KEY

EMPLOYEE_CONTEXT = """Employee context:
- Name: Alex Chen
- Role: Software Engineer
- Start date: Today (Day 1)
- Employee ID: {employee_id}"""


def _employee_context(employee_id: str) -> str:
    return EMPLOYEE_CONTEXT.format(employee_id=employee_id)


ORCHESTRATOR_PROMPT = """You are the OnboardAI orchestrator. Decide which specialist agents to invoke.

{employee_context}

Route rules:
- needs_research: policy, handbook, benefits, IT setup, or any factual HR question
- needs_workflow: onboarding tasks, checklists, what to do this week, scheduling check-ins
- Both can be true for questions like "I just started, what should I do and what's the remote policy?"
"""

RESEARCH_PROMPT = """You are the OnboardAI research specialist. Search the employee handbook and cite sources.
Never invent policies. If nothing is found, say so.

{employee_context}"""

WORKFLOW_PROMPT = """You are the OnboardAI workflow specialist. Create onboarding tasks, list tasks, and schedule check-ins.
When a new hire asks what to do this week, create relevant tasks from the onboarding checklist.
Use categories: HR, IT, or Team.

{employee_context}"""

SYNTHESIZER_PROMPT = """You are OnboardAI, Acme Corp's autonomous HR onboarding assistant.

Synthesize specialist findings into one clear, friendly answer for the employee.
Always cite source documents when answering policy questions (e.g. employee-handbook.md).
Never invent policies not found in the handbook. If unsure, say so and suggest contacting HR."""


class RoutePlan(BaseModel):
    needs_research: bool = Field(description="Invoke the research agent for handbook/policy questions")
    needs_workflow: bool = Field(description="Invoke the workflow agent for tasks and check-ins")
    reasoning: str = Field(description="Brief routing rationale")


class MultiAgentState(TypedDict):
    user_message: str
    employee_id: str
    needs_research: bool
    needs_workflow: bool
    routing_reason: str
    research_output: str
    workflow_output: str
    final_response: str
    tool_calls_log: Annotated[list[dict[str, Any]], lambda a, b: a + b]
    agent_events: Annotated[list[dict[str, str]], lambda a, b: a + b]
    citations: Annotated[list[str], lambda a, b: list(dict.fromkeys(a + b))]


def _extract_citations(messages: list) -> list[str]:
    citations: list[str] = []
    for msg in messages:
        if isinstance(msg, ToolMessage) and "Source:" in str(msg.content):
            for line in str(msg.content).split("\n"):
                if line.startswith("[") and "Source:" in line:
                    source = line.split("Source:")[1].strip()
                    if source not in citations:
                        citations.append(source)
    return citations


def _extract_tool_calls(messages: list) -> list[dict[str, Any]]:
    tool_calls: list[dict[str, Any]] = []
    for msg in messages:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls.append({"name": tc["name"], "args": tc["args"]})
    return tool_calls


def _run_react_agent(
    system_prompt: str,
    user_message: str,
    tools: list,
) -> tuple[str, list[dict[str, Any]], list[str]]:
    llm = ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=0.2)
    llm_with_tools = llm.bind_tools(tools)
    tool_node = ToolNode(tools)

    messages: list = [SystemMessage(content=system_prompt), HumanMessage(content=user_message)]

    for _ in range(6):
        response = llm_with_tools.invoke(messages)
        messages.append(response)
        if not isinstance(response, AIMessage) or not response.tool_calls:
            break
        tool_results = tool_node.invoke({"messages": messages})
        messages.extend(tool_results["messages"])

    assistant_text = ""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.content:
            assistant_text = msg.content if isinstance(msg.content, str) else str(msg.content)
            break

    return assistant_text, _extract_tool_calls(messages), _extract_citations(messages)


def build_multi_agent():
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is required")

    router_llm = ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=0)
    router = router_llm.with_structured_output(RoutePlan)

    def orchestrator(state: MultiAgentState):
        employee_context = _employee_context(state["employee_id"])
        plan = router.invoke(
            [
                SystemMessage(content=ORCHESTRATOR_PROMPT.format(employee_context=employee_context)),
                HumanMessage(content=state["user_message"]),
            ]
        )
        return {
            "needs_research": plan.needs_research,
            "needs_workflow": plan.needs_workflow,
            "routing_reason": plan.reasoning,
            "agent_events": [
                {
                    "agent": "orchestrator",
                    "status": "completed",
                    "detail": plan.reasoning,
                }
            ],
        }

    def research_agent(state: MultiAgentState):
        output, tool_calls, citations = _run_react_agent(
            RESEARCH_PROMPT.format(employee_context=_employee_context(state["employee_id"])),
            state["user_message"],
            build_research_tools(),
        )
        return {
            "research_output": output,
            "tool_calls_log": tool_calls,
            "citations": citations,
            "agent_events": [
                {"agent": "research", "status": "completed", "detail": "Handbook search finished"}
            ],
        }

    def workflow_agent(state: MultiAgentState):
        output, tool_calls, citations = _run_react_agent(
            WORKFLOW_PROMPT.format(employee_context=_employee_context(state["employee_id"])),
            state["user_message"],
            build_workflow_tools(state["employee_id"]),
        )
        return {
            "workflow_output": output,
            "tool_calls_log": tool_calls,
            "citations": citations,
            "agent_events": [
                {"agent": "workflow", "status": "completed", "detail": "Task and check-in actions finished"}
            ],
        }

    def synthesizer(state: MultiAgentState):
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=0.2)
        context_parts = [f"User question: {state['user_message']}"]
        if state.get("research_output"):
            context_parts.append(f"Research specialist:\n{state['research_output']}")
        if state.get("workflow_output"):
            context_parts.append(f"Workflow specialist:\n{state['workflow_output']}")
        if state.get("routing_reason"):
            context_parts.append(f"Routing note: {state['routing_reason']}")

        response = llm.invoke(
            [
                SystemMessage(content=SYNTHESIZER_PROMPT),
                HumanMessage(content="\n\n".join(context_parts)),
            ]
        )
        text = response.content if isinstance(response.content, str) else str(response.content)
        return {
            "final_response": text,
            "agent_events": [
                {"agent": "synthesizer", "status": "completed", "detail": "Final answer ready"}
            ],
        }

    def after_orchestrator(state: MultiAgentState) -> Literal["research", "workflow", "synthesizer"]:
        if state["needs_research"]:
            return "research"
        if state["needs_workflow"]:
            return "workflow"
        return "synthesizer"

    def after_research(state: MultiAgentState) -> Literal["workflow", "synthesizer"]:
        if state["needs_workflow"]:
            return "workflow"
        return "synthesizer"

    graph = StateGraph(MultiAgentState)
    graph.add_node("orchestrator", orchestrator)
    graph.add_node("research", research_agent)
    graph.add_node("workflow", workflow_agent)
    graph.add_node("synthesizer", synthesizer)
    graph.set_entry_point("orchestrator")
    graph.add_conditional_edges("orchestrator", after_orchestrator)
    graph.add_conditional_edges("research", after_research)
    graph.add_edge("workflow", "synthesizer")
    graph.add_edge("synthesizer", END)
    return graph.compile()


def run_multi_agent(
    message: str,
    employee_id: str,
    history: list[dict] | None = None,
) -> dict[str, Any]:
    agent = build_multi_agent()
    history_context = ""
    if history:
        lines = [f"{m['role']}: {m['content']}" for m in history[-4:]]
        history_context = "\nRecent conversation:\n" + "\n".join(lines)

    user_message = message
    if history_context:
        user_message = f"{history_context}\n\nCurrent question: {message}"

    final_state = agent.invoke(
        {
            "user_message": user_message,
            "employee_id": employee_id,
            "needs_research": False,
            "needs_workflow": False,
            "routing_reason": "",
            "research_output": "",
            "workflow_output": "",
            "final_response": "",
            "tool_calls_log": [],
            "agent_events": [],
            "citations": [],
        }
    )

    return {
        "response": final_state["final_response"],
        "tool_calls": final_state["tool_calls_log"],
        "citations": final_state["citations"],
        "agent_events": final_state["agent_events"],
    }
