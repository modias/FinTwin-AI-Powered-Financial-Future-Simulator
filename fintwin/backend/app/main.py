"""FinTwin API. The Monte Carlo engine stays in the browser.

This process fetches the Nessie sandbox and asks Gemini to explain a safety
score the browser already computed. It does not run another simulation.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.ai import router as ai_router
from app.api.nessie import router as nessie_router
from app.config import load_settings
from app.services.gemini_explainer import GeminiExplainer
from app.services.nessie_client import NessieClient

_LOCAL_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    client = NessieClient(settings)
    app.state.nessie = client
    app.state.risk_explainer = GeminiExplainer(settings)

    try:
        yield
    finally:
        await client.aclose()


app = FastAPI(
    title="FinTwin",
    version="0.1.0",
    description=(
        "Local hackathon API. Nessie credentials stay on this server. "
        "Customer listing is not safe to expose publicly without authentication."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_LOCAL_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)

app.include_router(nessie_router)
app.include_router(ai_router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
