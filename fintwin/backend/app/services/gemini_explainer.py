"""Ask Gemini to explain a safety score using only the supplied simulation facts.

The Monte Carlo engine stays in the browser. This module formats those results,
calls the official Google Gen AI SDK, and drops any reply that adds amounts,
dates, probabilities, or a ranked cause.
"""

import re
from collections.abc import Callable
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.config import Settings
from app.models.risk_explanation import (
    OutcomeFact,
    RiskExplanationRequest,
    RiskExplanationResponse,
    RiskFactor,
    ScenarioExplanationRequest,
    ScenarioFact,
)

_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

_MONEY = re.compile(r"-?\$\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?")
_PERCENT = re.compile(r"(?:<|>)?\d+(?:\.\d+)?%")
_SHORT_DATE = re.compile(
    r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b"
)
_LONG_DATE = re.compile(
    r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b"
)
_ISO_DATE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
_BANNED = (
    "biggest",
    "root cause",
    "primary cause",
    "primary driver",
    "most important",
    "main cause",
    "largest driver",
    "largest cause",
    "you should",
    "recommend",
)

SYSTEM_INSTRUCTION = """
You explain a Monte Carlo financial safety score that FinTwin already computed.
Use only the facts in the user message. Do not invent amounts, dates, probabilities, bill names, or causes.
Do not give advice, recommendations, purchases, or scenario comparisons.
The simulation does not rank which factor contributes most. Call each item a potential risk factor.
Never say a factor is the biggest, main, primary, or most important cause.
Copy dollar amounts, percents, and dates exactly as written, including cents and the decimal in percents.
Write a summary of 2 or 3 short sentences, then at most 3 potential risk factors.
If the breach probability is 0.0%, do not list any risk factors.
""".strip()

SCENARIO_SYSTEM_INSTRUCTION = """
You explain how one hypothetical change moves a Monte Carlo financial safety score that FinTwin already computed.
Use only the facts in the user message. Do not invent amounts, dates, probabilities, bill names, or causes.
Before and after use the same simulated futures, so the difference between them comes from this change alone. You may say so.
Explain why this change moves the score: its size and timing against the balance on that day, the protected minimum, the bills due after it, and the next paycheck.
Do not give advice or recommendations, and do not suggest a different amount, date, or purchase.
Never call anything the biggest, main, primary, or most important cause. The simulation does not rank the bills.
Copy dollar amounts, percents, and dates exactly as written, including cents and the decimal in percents.
Write a summary of 2 or 3 short sentences that states the safety before and after, then at most 3 factors that explain why it moved.
""".strip()

_RETRY_NOTE = (
    "Rewrite the JSON. Copy dollar amounts, percents, and dates exactly from the facts. "
    "Do not add figures. Do not rank causes. Say potential risk factor."
)


class GeminiNotConfigured(Exception):
    public_message = (
        "Risk explanations aren't configured yet. Add a Gemini API key on the server to turn them on."
    )


class GeminiUnavailable(Exception):
    public_message = (
        "FinTwin couldn't reach Gemini right now. Your safety score is unchanged — try again in a moment."
    )


class GeminiUngrounded(Exception):
    public_message = (
        "The explanation didn't stay within your simulation data, so it wasn't shown. Try again."
    )


class _DraftFactor(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    detail: str


class _Draft(BaseModel):
    model_config = ConfigDict(extra="ignore")

    summary: str
    factors: list[_DraftFactor] = Field(default_factory=list)


Generate = Callable[[str, str], str]


class GeminiExplainer:
    """Turns one simulation summary into a short explanation. Does not simulate."""

    def __init__(self, settings: Settings, generate: Generate | None = None) -> None:
        self._api_key = settings.gemini_api_key
        self._model = settings.gemini_model
        self._generate = generate

    def __repr__(self) -> str:
        return f"GeminiExplainer(configured={bool(self._api_key)}, model={self._model!r})"

    def explain(self, payload: RiskExplanationRequest) -> RiskExplanationResponse:
        return self._explain(
            SYSTEM_INSTRUCTION,
            render_facts(payload),
            allow_factors=payload.safety_probability != 1,
        )

    def explain_scenario(self, payload: ScenarioExplanationRequest) -> RiskExplanationResponse:
        return self._explain(
            SCENARIO_SYSTEM_INSTRUCTION,
            render_scenario_facts(payload),
            allow_factors=True,
        )

    def _explain(self, system: str, facts: str, *, allow_factors: bool) -> RiskExplanationResponse:
        if self._generate is None and not self._api_key:
            raise GeminiNotConfigured

        user = facts

        for attempt in range(2):
            raw = self._complete(system, user)

            try:
                return _ground(raw, facts, allow_factors=allow_factors)
            except GeminiUngrounded:
                if attempt == 1:
                    raise

                user = f"{facts}\n\n{_RETRY_NOTE}"

        raise GeminiUngrounded

    def _complete(self, system: str, user: str) -> str:
        try:
            if self._generate is not None:
                return self._generate(system, user)

            return _call_gemini(self._api_key, self._model, system, user)
        except GeminiUngrounded:
            raise
        except Exception:
            raise GeminiUnavailable from None


def render_facts(payload: RiskExplanationRequest) -> str:
    """Plain-language facts. Every figure Gemini may quote is written here."""

    safety = format_probability(payload.safety_probability)
    breach = format_probability(payload.breach_probability)
    ending = format_probability(payload.ending_above_minimum_probability)
    target = format_probability(payload.target_confidence)
    lines = [
        "These facts are the only source you may use.",
        (
            f"Financial safety is {safety}: {payload.safe_paths:,} of {payload.path_count:,} "
            f"simulated futures never drop below the protected minimum of "
            f"{format_cents(payload.protected_minimum_cents)} during the next {payload.horizon_days} days "
            f"starting {format_medium_date(payload.reference_date)}."
        ),
        (
            f"Breach probability is {breach}. "
            f"The share that merely end at or above the minimum is {ending}. "
            f"The safety target is {target}."
        ),
        f"Opening balance is {format_cents(payload.opening_balance_cents)}.",
        (
            f"Tightest point is {format_medium_date(payload.tightest_day.date)}: "
            f"in the lowest 10% of paths the balance is {format_cents(payload.tightest_day.p10_cents)} or less, "
            f"and the median path has {format_cents(payload.tightest_day.p50_cents)}."
        ),
        (
            f"In the worst 5% of simulations the lowest balance is "
            f"{format_cents(payload.minimum_balance_p5_cents)} or lower. "
            f"The median low point is {format_cents(payload.median_minimum_balance_cents)}."
        ),
    ]

    if payload.median_first_breach and payload.median_shortfall_cents is not None:
        lines.append(
            "When a path dips below the minimum, it typically first happens around "
            f"{format_medium_date(payload.median_first_breach.date)}, a median of "
            f"{format_cents(payload.median_shortfall_cents)} below the minimum."
        )
    elif payload.breach_probability == 0:
        lines.append("No simulated path dipped below the protected minimum.")

    if payload.next_income is None:
        lines.append(
            f"No paycheck is scheduled in the next {payload.horizon_days} days, so the balance only goes down."
        )
    else:
        income = payload.next_income
        confidence = (
            "This paycheck is estimated, not a scheduled deposit."
            if income.confidence == "estimated"
            else "This paycheck is scheduled."
        )
        lines.append(
            f"Next paycheck is {income.name} on {format_medium_date(income.date)} "
            f"for {format_cents(income.amount_cents)}. {confidence}"
        )

    before = payload.bills_before_next_paycheck

    if before is not None:
        lines.append(
            f"{before.count} scheduled bill(s) totaling {format_cents(before.total_cents)} "
            "fall before that paycheck. Describe that timing as a potential risk factor only. "
            "The simulation does not prove it is the cause of the safety score."
        )

    lines.append(
        f"Scheduled bills over the forecast total {format_cents(payload.scheduled_bills_total_cents)} "
        f"across {payload.scheduled_bills_count} bill(s). They are the same on every path."
    )

    if payload.upcoming_bills:
        listed = "; ".join(
            f"{bill.name} ({bill.category}) {format_cents(bill.amount_cents)} due {format_medium_date(bill.date)}"
            for bill in payload.upcoming_bills
        )
        scope = (
            "These are all of the scheduled bills."
            if payload.upcoming_bills_complete
            else "This is a subset of the scheduled bills. Do not say they are the only bills."
        )
        lines.append(f"Bills you may mention: {listed}. {scope}")
    else:
        lines.append("No scheduled bills were provided.")

    spending = payload.everyday_spending
    lines.append(
        "Everyday spending over the forecast is estimated at "
        f"{format_cents(spending.expected_cents)}. "
        f"The middle 80% of paths spend between {format_cents(spending.p10_cents)} and "
        f"{format_cents(spending.p90_cents)}. "
        f"Essential spending is about {format_cents(spending.essential_expected_cents)} "
        f"({_basis(spending.essential_basis)}). "
        f"Discretionary spending is about {format_cents(spending.discretionary_expected_cents)} "
        f"({_basis(spending.discretionary_basis)}). "
        "Do not call this higher or lower than average. The simulation does not say that."
    )

    if payload.emergencies is None:
        lines.append(
            "Unexpected expenses are not included in this simulation. Do not mention emergency costs."
        )
    else:
        emergency = payload.emergencies
        text = (
            "Unexpected expenses are a modelling assumption, not a known bill: about "
            f"{_number(emergency.events_per_year)} a year, averaging {format_cents(emergency.mean_cost_cents)}, "
            f"capped at {format_cents(emergency.max_cost_cents)}. "
            f"{format_probability(emergency.probability_of_any)} of paths include at least one."
        )

        if emergency.breach_with_any is not None and emergency.breach_with_none is not None:
            text += (
                " Paths with one fall below the minimum "
                f"{format_probability(emergency.breach_with_any)} of the time, against "
                f"{format_probability(emergency.breach_with_none)} without one. "
                "You may quote that comparison. It does not rank other factors, and it is not the biggest cause."
            )

        lines.append(text)

    if payload.warnings:
        lines.append("Model warnings already shown to the user: " + " ".join(payload.warnings))

    lines.append(
        "If you are not sure a factor caused the score, call it a potential risk factor."
    )
    return "\n".join(lines)


def render_scenario_facts(payload: ScenarioExplanationRequest) -> str:
    """Plain-language facts about one what-if. Every figure Gemini may quote is written here."""

    scenario = payload.scenario
    before, after = payload.before, payload.after
    minimum = format_cents(payload.protected_minimum_cents)
    change_date = format_medium_date(scenario.effective_date)
    target = format_probability(payload.target_confidence)
    lines = [
        "These facts are the only source you may use.",
        f'The user is testing a hypothetical change called "{scenario.description}": '
        f"{_describe_scenario(scenario)}. {_net_change(scenario)}",
        (
            f"Before and after use the same {payload.path_count:,} simulated futures over the "
            f"{payload.horizon_days} days starting {format_medium_date(payload.reference_date)}, "
            "so the whole difference between them comes from this change."
        ),
        (
            f"Financial safety, the share of futures that never drop below the protected minimum of "
            f"{minimum}, is {format_probability(before.safety_probability)} before the change and "
            f"{format_probability(after.safety_probability)} after it. {_point_change(payload.safety_change_points)}"
        ),
        (
            f"Breach probability goes from {format_probability(before.breach_probability)} "
            f"to {format_probability(after.breach_probability)}."
        ),
        (
            f"The safety target is {target}. Before the change the plan {_meets(before)}. "
            f"After the change it {_meets(after)}."
        ),
        f"Opening balance is {format_cents(payload.opening_balance_cents)}.",
        f"Before the change, {_safe_to_spend(before)}. After it, {_safe_to_spend(after)}.",
    ]

    if (
        scenario.type == "one_time_purchase"
        and scenario.effective_date == payload.reference_date
        and before.safe_to_spend_cents is not None
    ):
        over = scenario.amount_cents - before.safe_to_spend_cents
        lines.append(
            f"The purchase is {format_cents(over)} more than the safe-to-spend amount before the change."
            if over > 0
            else "The purchase fits within the safe-to-spend amount before the change."
        )

    if payload.change_day is not None:
        day = payload.change_day
        lines.append(
            f"On {change_date}, the day the change starts, the lowest 10% of paths have "
            f"{format_cents(day.before_p10_cents)} or less before the change and "
            f"{format_cents(day.after_p10_cents)} or less after it. The median path has "
            f"{format_cents(day.before_p50_cents)} before and {format_cents(day.after_p50_cents)} after. "
            f"The protected minimum is {minimum}."
        )

    income = payload.next_income_after_change

    if income is None:
        lines.append(
            f"No paycheck arrives between {change_date} and the end of the forecast, "
            "so nothing refills the balance after the change."
        )
    else:
        estimated = (
            " This paycheck is estimated, not a scheduled deposit."
            if income.confidence == "estimated"
            else ""
        )
        lines.append(
            f"The next paycheck on or after {change_date} is {income.name} on "
            f"{format_medium_date(income.date)} for {format_cents(income.amount_cents)}.{estimated}"
        )

    bills = payload.bills_after_change
    window = (
        f"between {change_date} and that paycheck"
        if bills.until == "next_paycheck" and income is not None
        else f"between {change_date} and the end of the forecast"
    )

    if bills.count == 0:
        lines.append(f"No scheduled bills are due {window}.")
    else:
        listed = "; ".join(
            f"{bill.name} ({bill.category}) {format_cents(bill.amount_cents)} due {format_medium_date(bill.date)}"
            for bill in bills.bills
        )
        scope = "" if len(bills.bills) >= bills.count else " This is a subset. Do not say they are the only bills."
        lines.append(
            f"{bills.count} scheduled bill(s) totaling {format_cents(bills.total_cents)} are due {window}: "
            f"{listed}.{scope} Describe this timing as context. "
            "The simulation does not measure how much each bill contributes."
        )

    lines.extend(
        [
            (
                "In the worst 5% of simulations the lowest balance is "
                f"{format_cents(before.minimum_balance_p5_cents)} before the change and "
                f"{format_cents(after.minimum_balance_p5_cents)} after it."
            ),
            (
                f"The median balance at the end of the forecast is "
                f"{format_cents(before.median_ending_balance_cents)} before and "
                f"{format_cents(after.median_ending_balance_cents)} after."
            ),
            (
                f"The tightest day is {format_medium_date(before.tightest_day.date)} before the change, "
                f"when the lowest 10% of paths have {format_cents(before.tightest_day.p10_cents)} or less, "
                f"and {format_medium_date(after.tightest_day.date)} after it, with "
                f"{format_cents(after.tightest_day.p10_cents)} or less."
            ),
            (
                "Everyday spending variation uses default assumptions, not transaction history."
                if payload.spending_uses_defaults
                else "Everyday spending variation is measured from transaction history."
            ),
            (
                "Unexpected expenses are included on both sides as a modelling assumption."
                if payload.emergencies_included
                else "Unexpected expenses are not included. Do not mention emergency costs."
            ),
        ]
    )

    if payload.warnings:
        lines.append("Warnings about this change already shown to the user: " + " ".join(payload.warnings))

    lines.append("If you are not sure why the score moved, call the factor a potential reason.")
    return "\n".join(lines)


def _describe_scenario(scenario: ScenarioFact) -> str:
    amount = format_cents(scenario.amount_cents)
    when = format_medium_date(scenario.effective_date)

    match scenario.type:
        case "one_time_purchase":
            return f"spend {amount} on {when}"
        case "delayed_purchase":
            return f"spend {amount}, delayed to {when}"
        case "recurring_expense":
            return f"a new {scenario.frequency or 'monthly'} expense of {amount} starting {when}"
        case "emergency_expense":
            return f"an unexpected {amount} expense on {when}"
        case "income_increase":
            return f"{amount} more per paycheck from {when}"
        case "income_decrease":
            return f"{amount} less per paycheck from {when}"
        case "rent_increase":
            return f"rent {amount} higher from {when}"
        case "rent_decrease":
            return f"rent {amount} lower from {when}"


def _net_change(scenario: ScenarioFact) -> str:
    net = scenario.net_change_cents
    dates = f"across {scenario.cash_flow_count} date(s)"

    if net < 0:
        return f"Inside the forecast it takes {format_cents(-net)} out of the account in total, {dates}."

    if net > 0:
        return f"Inside the forecast it adds {format_cents(net)} to the account in total, {dates}."

    return "It moves no money inside the forecast."


def _point_change(points: float) -> str:
    if abs(points) < 0.05:
        return "Safety does not change."

    direction = "down" if points < 0 else "up"
    return f"That is {direction} {abs(points):.1f} percentage points."


def _meets(outcome: OutcomeFact) -> str:
    return "meets the target" if outcome.meets_target else "is below the target"


def _safe_to_spend(outcome: OutcomeFact) -> str:
    if outcome.safe_to_spend_cents is None:
        return "nothing is safe to spend today while meeting the target"

    return f"up to {format_cents(outcome.safe_to_spend_cents)} can be spent today while meeting the target"


def ground_explanation(
    raw: str,
    facts: str,
    payload: RiskExplanationRequest,
) -> RiskExplanationResponse:
    """Accept a reply only when every figure in it already appears in `facts`."""

    return _ground(raw, facts, allow_factors=payload.safety_probability != 1)


def _ground(raw: str, facts: str, *, allow_factors: bool) -> RiskExplanationResponse:
    try:
        draft = _Draft.model_validate_json(_json_text(raw))
    except (ValidationError, ValueError) as exc:
        raise GeminiUngrounded from exc

    summary = " ".join(draft.summary.split())
    factors = _fit_factors(draft.factors) if allow_factors else []

    if not summary or len(summary) > 900:
        raise GeminiUngrounded
    pieces = [summary, *(f"{factor.title} {factor.detail}" for factor in factors)]
    text = "\n".join(pieces)

    if _unsupported(text, facts) or _ranks_a_cause(text):
        raise GeminiUngrounded

    return RiskExplanationResponse(
        summary=summary,
        factors=[RiskFactor(title=factor.title, detail=factor.detail) for factor in factors],
    )


def format_cents(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    amount = abs(cents)
    return f"{sign}${amount // 100:,}.{amount % 100:02d}"


def format_probability(probability: float) -> str:
    if 0 < probability < 0.001:
        return "<0.1%"

    if 0.999 < probability < 1:
        return ">99.9%"

    return f"{probability * 100:.1f}%"


def format_medium_date(iso: str) -> str:
    parsed = date.fromisoformat(iso)
    return f"{_MONTHS[parsed.month - 1]} {parsed.day}, {parsed.year}"


def _fit_factors(factors: list[_DraftFactor]) -> list[_DraftFactor]:
    fitted: list[_DraftFactor] = []

    for factor in factors[:3]:
        title = " ".join(factor.title.split())
        detail = " ".join(factor.detail.split())

        if not title or not detail or len(title) > 80 or len(detail) > 400:
            raise GeminiUngrounded

        fitted.append(_DraftFactor(title=title, detail=detail))

    return fitted


def _basis(basis: str) -> str:
    if basis == "transaction_history":
        return "variation measured from transaction history"

    return "variation uses a default assumption, not transaction history"


def _number(value: float) -> str:
    if value == int(value):
        return str(int(value))

    return f"{value:g}"


def _json_text(raw: str) -> str:
    text = raw.strip()

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    return text.strip()


def _tokens(pattern: re.Pattern[str], text: str) -> set[str]:
    return set(pattern.findall(text))


def _unsupported(text: str, facts: str) -> bool:
    for pattern in (_MONEY, _PERCENT, _SHORT_DATE, _LONG_DATE, _ISO_DATE):
        allowed = _tokens(pattern, facts)

        if not _tokens(pattern, text) <= allowed:
            return True

    return False


def _ranks_a_cause(text: str) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in _BANNED)


def _call_gemini(api_key: str, model: str, system: str, user: str) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=25_000))
    response = client.models.generate_content(
        model=model,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.2,
            max_output_tokens=800,
            response_mime_type="application/json",
            response_json_schema=_Draft.model_json_schema(),
        ),
    )
    text = getattr(response, "text", None)

    if not text or not str(text).strip():
        raise GeminiUnavailable

    return str(text)
