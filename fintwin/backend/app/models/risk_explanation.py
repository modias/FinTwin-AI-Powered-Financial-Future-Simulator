"""Payload for a Gemini explanation of an existing Monte Carlo safety score.

The browser sends the result it already computed. This model checks the shape.
It does not run a simulation.
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_CENTS = 100_000_000_00
_CAMEL = ConfigDict(alias_generator=lambda name: _camel(name), populate_by_name=True, extra="forbid")


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(part.capitalize() for part in rest)


class CamelModel(BaseModel):
    model_config = _CAMEL


def _iso_date(value: str) -> str:
    if len(value) != 10:
        raise ValueError("Dates must be YYYY-MM-DD.")

    date.fromisoformat(value)
    return value


class BillFact(CamelModel):
    name: str = Field(min_length=1, max_length=80)
    amount_cents: int = Field(ge=0, le=MAX_CENTS)
    date: str
    category: str = Field(min_length=1, max_length=40)

    @field_validator("name", "category")
    @classmethod
    def strip_text(cls, value: str) -> str:
        text = value.strip()

        if not text:
            raise ValueError("Text is required.")

        return text

    @field_validator("date")
    @classmethod
    def real_date(cls, value: str) -> str:
        return _iso_date(value)


class IncomeFact(CamelModel):
    name: str = Field(min_length=1, max_length=80)
    date: str
    amount_cents: int = Field(ge=0, le=MAX_CENTS)
    confidence: Literal["scheduled", "estimated"]

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        text = value.strip()

        if not text:
            raise ValueError("Name is required.")

        return text

    @field_validator("date")
    @classmethod
    def real_date(cls, value: str) -> str:
        return _iso_date(value)


class EverydaySpendingFact(CamelModel):
    expected_cents: int = Field(ge=0, le=MAX_CENTS)
    p10_cents: int = Field(ge=0, le=MAX_CENTS)
    p90_cents: int = Field(ge=0, le=MAX_CENTS)
    essential_expected_cents: int = Field(ge=0, le=MAX_CENTS)
    discretionary_expected_cents: int = Field(ge=0, le=MAX_CENTS)
    essential_basis: Literal["transaction_history", "fallback"]
    discretionary_basis: Literal["transaction_history", "fallback"]


class EmergencyFact(CamelModel):
    events_per_year: float = Field(ge=0, le=365)
    mean_cost_cents: int = Field(ge=0, le=MAX_CENTS)
    max_cost_cents: int = Field(ge=0, le=MAX_CENTS)
    probability_of_any: float = Field(ge=0, le=1)
    breach_with_any: float | None = Field(default=None, ge=0, le=1)
    breach_with_none: float | None = Field(default=None, ge=0, le=1)


class TightestDayFact(CamelModel):
    date: str
    p10_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)
    p50_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)

    @field_validator("date")
    @classmethod
    def real_date(cls, value: str) -> str:
        return _iso_date(value)


class BreachTimingFact(CamelModel):
    date: str
    day_index: int = Field(ge=0, le=3660)

    @field_validator("date")
    @classmethod
    def real_date(cls, value: str) -> str:
        return _iso_date(value)


class BeforePaycheckFact(CamelModel):
    count: int = Field(ge=0, le=500)
    total_cents: int = Field(ge=0, le=MAX_CENTS)


class RiskExplanationRequest(CamelModel):
    """Facts already produced by the browser simulation."""

    safety_probability: float = Field(ge=0, le=1)
    breach_probability: float = Field(ge=0, le=1)
    ending_above_minimum_probability: float = Field(ge=0, le=1)
    horizon_days: int = Field(ge=1, le=366)
    reference_date: str
    path_count: int = Field(ge=1, le=100_000)
    safe_paths: int = Field(ge=0, le=100_000)
    protected_minimum_cents: int = Field(ge=0, le=MAX_CENTS)
    opening_balance_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)
    target_confidence: float = Field(ge=0, le=1)
    next_income: IncomeFact | None
    upcoming_bills: list[BillFact] = Field(max_length=10)
    upcoming_bills_complete: bool
    scheduled_bills_total_cents: int = Field(ge=0, le=MAX_CENTS)
    scheduled_bills_count: int = Field(ge=0, le=500)
    bills_before_next_paycheck: BeforePaycheckFact | None
    everyday_spending: EverydaySpendingFact
    emergencies: EmergencyFact | None
    tightest_day: TightestDayFact
    median_first_breach: BreachTimingFact | None
    median_shortfall_cents: int | None = Field(default=None, ge=0, le=MAX_CENTS)
    minimum_balance_p5_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)
    median_minimum_balance_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)
    warnings: list[str] = Field(default_factory=list, max_length=6)

    @field_validator("reference_date")
    @classmethod
    def real_reference_date(cls, value: str) -> str:
        return _iso_date(value)

    @field_validator("warnings")
    @classmethod
    def short_warnings(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []

        for value in values:
            text = value.strip()

            if not text:
                continue

            cleaned.append(text[:300])

        return cleaned

    @model_validator(mode="after")
    def paths_fit(self) -> "RiskExplanationRequest":
        if self.safe_paths > self.path_count:
            raise ValueError("safePaths cannot exceed pathCount.")

        return self


ScenarioType = Literal[
    "one_time_purchase",
    "delayed_purchase",
    "recurring_expense",
    "emergency_expense",
    "income_increase",
    "income_decrease",
    "rent_increase",
    "rent_decrease",
]


class ScenarioFact(CamelModel):
    type: ScenarioType
    description: str = Field(min_length=1, max_length=80)
    amount_cents: int = Field(ge=0, le=MAX_CENTS)
    effective_date: str
    frequency: Literal["weekly", "biweekly", "monthly"] | None
    net_change_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)
    cash_flow_count: int = Field(ge=0, le=400)

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        text = value.strip()

        if not text:
            raise ValueError("Description is required.")

        return text

    @field_validator("effective_date")
    @classmethod
    def real_date(cls, value: str) -> str:
        return _iso_date(value)


class LowPointFact(CamelModel):
    date: str
    p10_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)

    @field_validator("date")
    @classmethod
    def real_date(cls, value: str) -> str:
        return _iso_date(value)


class OutcomeFact(CamelModel):
    """One side of the before-and-after comparison, on the same simulated paths."""

    safety_probability: float = Field(ge=0, le=1)
    breach_probability: float = Field(ge=0, le=1)
    meets_target: bool
    safe_to_spend_cents: int | None = Field(ge=0, le=MAX_CENTS)
    median_ending_balance_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)
    minimum_balance_p5_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)
    tightest_day: LowPointFact


class ChangeDayFact(CamelModel):
    """Balances on the day the change starts, before and after it."""

    before_p10_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)
    before_p50_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)
    after_p10_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)
    after_p50_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)


class BillsAfterChangeFact(CamelModel):
    """Scheduled bills from the change date until the next paycheck or the forecast end."""

    count: int = Field(ge=0, le=500)
    total_cents: int = Field(ge=0, le=MAX_CENTS)
    bills: list[BillFact] = Field(max_length=6)
    until: Literal["next_paycheck", "forecast_end"]


class ScenarioExplanationRequest(CamelModel):
    """A baseline and one what-if, both already simulated by the browser."""

    scenario: ScenarioFact
    reference_date: str
    horizon_days: int = Field(ge=1, le=366)
    path_count: int = Field(ge=1, le=100_000)
    protected_minimum_cents: int = Field(ge=0, le=MAX_CENTS)
    target_confidence: float = Field(ge=0, le=1)
    opening_balance_cents: int = Field(ge=-MAX_CENTS, le=MAX_CENTS)
    before: OutcomeFact
    after: OutcomeFact
    safety_change_points: float = Field(ge=-100, le=100)
    change_day: ChangeDayFact | None
    next_income_after_change: IncomeFact | None
    bills_after_change: BillsAfterChangeFact
    spending_uses_defaults: bool
    emergencies_included: bool
    warnings: list[str] = Field(default_factory=list, max_length=6)

    @field_validator("reference_date")
    @classmethod
    def real_reference_date(cls, value: str) -> str:
        return _iso_date(value)

    @field_validator("warnings")
    @classmethod
    def short_warnings(cls, values: list[str]) -> list[str]:
        return [value.strip()[:300] for value in values if value.strip()]


class RiskFactor(BaseModel):
    title: str
    detail: str


class RiskExplanationResponse(BaseModel):
    summary: str
    factors: list[RiskFactor]
