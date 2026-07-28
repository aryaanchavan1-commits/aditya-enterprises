from fastapi import APIRouter, HTTPException
import httpx
from app.core.config import settings

router = APIRouter()

@router.get("/models")
async def get_groq_models():
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.GROQ_BASE_URL}/models",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            timeout=10.0
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch models")
        return response.json()

@router.post("/chat")
async def chat_completion(request: dict):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.GROQ_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"},
            json=request,
            timeout=60.0
        )
        return response.json()

@router.post("/analyze")
async def ai_analyze(request: dict):
    system_prompt = "You are ArynoxTech ERP Business Analyst AI for Sainath Enterprises. Analyze business data and give actionable insights."
    request["messages"] = [{"role": "system", "content": system_prompt}] + request.get("messages", [])
    return await chat_completion(request)

@router.post("/forecast")
async def ai_forecast(request: dict):
    system_prompt = "You are ArynoxTech ERP Forecasting AI. Predict future metrics with confidence intervals."
    request["messages"] = [{"role": "system", "content": system_prompt}] + request.get("messages", [])
    return await chat_completion(request)

@router.post("/agent")
async def ai_agent(request: dict):
    system_prompt = "You are ArynoxTech Autonomous AI Agent. Monitor ERP, detect issues, provide proactive recommendations."
    request["messages"] = [{"role": "system", "content": system_prompt}] + request.get("messages", [])
    return await chat_completion(request)
