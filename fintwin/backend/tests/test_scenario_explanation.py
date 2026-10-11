"""What-if explanations: facts, grounding, and the HTTP route. No Gemini key is required."""

import json

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.models.risk_explanation import ScenarioExplanationRequest
from app.services.gemini_explainer import (
    GeminiExplainer,
    GeminiUngrounded,
    render_scenario_facts,
)

PAYLOAD = {
    "scenario": {
        "type": "one_time_purchase",
        "description": "Trip to Goa",
        "amountCents": 69_000,
        "effectiveDate": "2026-10-21",
        "frequency": None,
        "netChangeCents": -69_000,
        "cashFlowCount": 1,
    },
    "referenceDate": "2026-10-11",
    "horizonDays": 30,
    "pathCount": 10_000,
    "protectedMinimumCents": 30_000,
    "targetConfidence": 0.95,
    "openingBalanceCents": 120_000,
    "before": {
        "safetyProbability": 0.965,
        "breachProbability": 0.035,
        "meetsTarget": True,
        "safeToSpendCents": 20_190,
        "medianEndingBalanceCents": 180_000,
        "minimumBalanceP5Cents": 31_000,
        "tightestDay": {"date": "2026-10-24", "p10Cents": 52_000},
    },
    "after": {
        "safetyProbability": 0.883,
        "breachProbability": 0.117,
        "meetsTarget": False,
        "safeToSpendCents": None,
        "medianEndingBalanceCents": 111_000,
        "minimumBalanceP5Cents": -38_000,
        "tightestDay": {"date": "2026-10-24", "p10Cents": -17_000},
    },
    "safetyChangePoints": -8.2,
    "changeDay": {
        "beforeP10Cents": 95_000,
        "beforeP50Cents": 110_000,
        "afterP10Cents": 26_000,
        "afterP50Cents": 41_000,
    },
    "nextIncomeAfterChange": {
        "name": "Paycheck",
        "date": "2026-10-30",
        "amountCents": 160_000,
        "confidence": "scheduled",
    },
    "billsAfterChange": {
        "count": 1,
        "totalCents": 45_000,
        "bills": [
            {"name": "Rent", "amountCents": 45_000, "date": "2026-10-25", "category": "Housing"}
        ],
        "until": "next_paycheck",
    },
    "spendingUsesDefaults": True,
    "emergenciesIncluded": True,
    "warnings": [],
}

GROUNDED = json.dumps(
    {
        "summary": "Spending $690.00 on Oct 21, 2026 moves safety from 96.5% to 88.3%.",
        "factors": [
            {
                "title": "Rent before the next paycheck",
                "detail": "Rent of $450.00 is due Oct 25, 2026, before the Oct 30, 2026 paycheck.",
            }
        ],
    }
)


def _request() -> ScenarioExplanationRequest:
    return ScenarioExplanationRequest.model_validate(PAYLOAD)


def _explainer(*replies: str) -> GeminiExplainer:
    queue = list(replies)
    return GeminiExplainer(Settings(), generate=lambda _system, _user: queue.pop(0))


def test_facts_cover_the_change_its_timing_and_both_outcomes():
    facts = render_scenario_facts(_request())

    assert '"Trip to Goa": spend $690.00 on Oct 21, 2026' in facts
    assert "96.5% before the change and 88.3% after it" in facts
    assert "down 8.2 percentage points" in facts
    assert "After it, nothing is safe to spend today while meeting the target" in facts
    assert "more than the safe-to-spend amount" not in facts
    assert "Rent (Housing) $450.00 due Oct 25, 2026" in facts
    assert "Paycheck on Oct 30, 2026 for $1,600.00" in facts


def test_grounded_reply_is_returned():
    explanation = _explainer(GROUNDED).explain_scenario(_request())

    assert explanation.summary.startswith("Spending $690.00")
    assert explanation.factors[0].title == "Rent before the next paycheck"


def test_invented_figures_are_rejected_after_one_retry():
    invented = json.dumps({"summary": "Safety falls to 70.0% because of a $999.00 bill.", "factors": []})

    with pytest.raises(GeminiUngrounded):
        _explainer(invented, invented).explain_scenario(_request())


def test_route_returns_the_explanation():
    with TestClient(app) as client:
        app.state.risk_explainer = _explainer(GROUNDED)
        response = client.post("/api/ai/explain-scenario", json=PAYLOAD)

    assert response.status_code == 200
    assert response.json()["factors"][0]["title"] == "Rent before the next paycheck"
