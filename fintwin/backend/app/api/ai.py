"""Explain the current safety score or one what-if. The simulation itself stays in the browser."""

from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, Request

from app.models.risk_explanation import (
    RiskExplanationRequest,
    RiskExplanationResponse,
    ScenarioExplanationRequest,
)
from app.services.gemini_explainer import (
    GeminiExplainer,
    GeminiNotConfigured,
    GeminiUnavailable,
    GeminiUngrounded,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


def get_explainer(request: Request) -> GeminiExplainer:
    explainer = getattr(request.app.state, "risk_explainer", None)

    if not isinstance(explainer, GeminiExplainer):
        raise HTTPException(status_code=503, detail=GeminiUnavailable.public_message)

    return explainer


@router.post("/explain-risk", response_model=RiskExplanationResponse)
def explain_risk(
    payload: RiskExplanationRequest,
    explainer: GeminiExplainer = Depends(get_explainer),
) -> RiskExplanationResponse:
    return _run(lambda: explainer.explain(payload))


@router.post("/explain-scenario", response_model=RiskExplanationResponse)
def explain_scenario(
    payload: ScenarioExplanationRequest,
    explainer: GeminiExplainer = Depends(get_explainer),
) -> RiskExplanationResponse:
    return _run(lambda: explainer.explain_scenario(payload))


def _run(explain: Callable[[], RiskExplanationResponse]) -> RiskExplanationResponse:
    try:
        return explain()
    except GeminiNotConfigured as exc:
        raise HTTPException(status_code=503, detail=exc.public_message) from None
    except GeminiUngrounded as exc:
        raise HTTPException(status_code=502, detail=exc.public_message) from None
    except GeminiUnavailable as exc:
        raise HTTPException(status_code=503, detail=exc.public_message) from None
