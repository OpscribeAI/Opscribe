from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from apps.api.agent.core import get_agent_executor

router = APIRouter(
    prefix="/agent",
    tags=["agent"]
)

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    response: str

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with the Opscribe AI Agent.
    """
    try:
        executor = get_agent_executor()
        result = await executor.ainvoke({"input": request.query})
        return ChatResponse(response=result["output"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
