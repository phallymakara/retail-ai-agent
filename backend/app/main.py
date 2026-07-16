from fastapi import FastAPI

app = FastAPI(
    title= "Retail AI Agent API",
    version="0.1.0"
)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "retail-ai-agent",
    }


