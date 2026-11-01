"""Learning duration and schedule calculator.

Converts course/project hours plus explicit study overhead into weekly and
monthly schedules. Courses are sequenced by default. When a student opts into
parallel learning, courses inside the same phase are run in parallel lanes
while phases remain strictly ordered.
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any

COURSE_OVERHEAD = 1.25  # assignments + revision
PROJECT_OVERHEAD = 1.10  # review + documentation
ASSESSMENT_HOURS = 2.0
FALLBACK_COURSE_HOURS = 20.0


def effective_course_hours(hours: float | None) -> tuple[float, bool]:
    """Return (hours, used_fallback)."""
    if hours and hours > 0:
        return float(hours), False
    return FALLBACK_COURSE_HOURS, True


def weekly_capacity(profile) -> float:
    return max(1.0, float(profile.hours_per_day or 2) * int(profile.days_per_week or 5))


def _codes(node_type: str) -> str:
    return {"course": "C", "project": "P", "assessment": "A"}.get(node_type, "X")


def calculate_schedule(
    phases: list[dict[str, Any]],
    profile,
    start_date: date | None = None,
    target_date: date | None = None,
) -> dict[str, Any]:
    """
    phases: [{phase_number, title, courses:[{key,title,hours}], project:{key,title,hours}|None,
              assessment:{key,title}|None}]
    Each course/project dict must include `key`, `title`, and optional `hours`.
    """
    start = start_date or date.today()
    capacity = weekly_capacity(profile)
    parallel = bool(profile.parallel_learning)
    warnings: list[str] = []
    fallback_count = 0

    # Offset (in weeks) for each node, used to build the weekly plan.
    intervals: list[dict[str, Any]] = []
    phase_results: list[dict[str, Any]] = []
    cursor = 0.0

    for phase in phases:
        p_start = cursor
        courses = phase.get("courses", []) or []
        course_intervals = []
        lanes = min(len(courses), 3) if parallel else 1
        for idx, course in enumerate(courses):
            hours, fallback = effective_course_hours(course.get("hours"))
            if fallback:
                fallback_count += 1
            effective = hours * COURSE_OVERHEAD
            lane_capacity = capacity / lanes if parallel else capacity
            duration = effective / lane_capacity
            lane = idx % lanes if parallel else 0
            offset = lane * 0.0  # branches start together
            iv = {
                "key": course["key"], "title": course["title"], "type": "course",
                "phase": phase["phase_number"], "start": p_start + offset,
                "duration": duration, "hours": effective,
            }
            intervals.append(iv)
            course_intervals.append(iv)

        if parallel and courses:
            phase_course_end = p_start + max(iv["duration"] for iv in course_intervals)
        else:
            phase_course_end = p_start + sum(iv["duration"] for iv in course_intervals)

        cursor = phase_course_end
        project = phase.get("project")
        if project:
            p_hours = float(project.get("hours") or 10) * PROJECT_OVERHEAD
            duration = p_hours / capacity
            intervals.append({
                "key": project["key"], "title": project["title"], "type": "project",
                "phase": phase["phase_number"], "start": cursor, "duration": duration, "hours": p_hours,
            })
            cursor += duration

        assessment = phase.get("assessment")
        if assessment:
            duration = ASSESSMENT_HOURS / capacity
            intervals.append({
                "key": assessment["key"], "title": assessment["title"], "type": "assessment",
                "phase": phase["phase_number"], "start": cursor, "duration": duration,
                "hours": ASSESSMENT_HOURS,
            })
            cursor += duration

        phase_end = cursor
        phase_results.append({
            "phase_number": phase["phase_number"],
            "title": phase["title"],
            "start_week": round(p_start + 1, 2),
            "end_week": round(phase_end, 2),
            "weeks": round(phase_end - p_start, 2),
            "start_date": start + timedelta(days=7 * max(0.0, p_start)),
            "end_date": start + timedelta(days=7 * phase_end - 1),
            "hours": round(sum(iv["hours"] for iv in intervals if iv["phase"] == phase["phase_number"]), 1),
        })

    total_weeks_float = cursor
    total_weeks = max(1, math.ceil(total_weeks_float))
    expected_completion = start + timedelta(days=7 * total_weeks_float)
    total_hours = sum(iv["hours"] for iv in intervals)

    # ----- weekly plan -----
    weeks: list[dict[str, Any]] = []
    for week in range(1, total_weeks + 1):
        week_start = week - 1
        items = []
        allocated = 0.0
        for iv in intervals:
            iv_start, iv_end = iv["start"], iv["start"] + iv["duration"]
            if iv_end <= week_start or iv_start >= week_start + 1:
                continue
            overlap = min(iv_end, week_start + 1) - max(iv_start, week_start)
            if overlap <= 0:
                continue
            per_week = iv["hours"] / iv["duration"] if iv["duration"] else iv["hours"]
            hours = round(per_week * overlap, 1)
            if hours <= 0:
                continue
            allocated += hours
            items.append({
                "node_key": iv["key"], "title": iv["title"], "type": iv["type"],
                "phase": iv["phase"], "hours": hours,
                "continues": iv_start < week_start,
                "finishes": iv_end <= week_start + 1,
            })
        weeks.append({
            "week": week,
            "start_date": start + timedelta(days=7 * week_start),
            "end_date": start + timedelta(days=7 * (week_start + 1) - 1),
            "planned_hours": round(allocated, 1),
            "capacity_hours": capacity,
            "items": items,
        })

    # ----- monthly milestones -----
    months = []
    by_month: dict[int, dict[str, Any]] = {}
    for week in weeks:
        month_index = (week["start_date"] - start).days // 30
        bucket = by_month.setdefault(month_index, {
            "month": month_index + 1, "label": week["start_date"].strftime("%B %Y"),
            "hours": 0.0, "phases": set(), "weeks": [],
        })
        bucket["hours"] += week["planned_hours"]
        bucket["weeks"].append(week["week"])
        for item in week["items"]:
            bucket["phases"].add(item["phase"])
    for idx in sorted(by_month):
        bucket = by_month[idx]
        month_date = start + timedelta(days=30 * idx)
        completed_titles = []
        for p in phase_results:
            if p["end_date"] <= month_date + timedelta(days=30):
                completed_titles.append(p["title"])
        months.append({
            "month": bucket["month"],
            "label": bucket["label"],
            "hours": round(bucket["hours"], 1),
            "weeks": bucket["weeks"],
            "phases": sorted(bucket["phases"]),
            "milestone": completed_titles[-1] if completed_titles else None,
            "date": month_date,
        })

    # ----- feasibility -----
    feasibility: dict[str, Any] = {
        "weekly_capacity": capacity,
        "total_weeks": total_weeks,
        "on_track": True,
        "message": "Your weekly capacity supports this roadmap.",
        "required_hours_per_day": round((total_hours / max(1, total_weeks)) / max(1, int(profile.days_per_week or 5)), 1),
        "target_date": target_date,
        "expected_completion": expected_completion,
    }
    if target_date:
        days_available = (target_date - start).days
        weeks_available = max(1, days_available / 7)
        required_capacity = total_hours / weeks_available
        if weeks_available < total_weeks_float:
            feasibility.update({
                "on_track": False,
                "required_weekly_hours": round(required_capacity, 1),
                "required_hours_per_day": round(required_capacity / max(1, int(profile.days_per_week or 5)), 1),
                "message": (
                    f"Your target date is earlier than the estimated completion. "
                    f"You would need about {round(required_capacity, 1)} focused hours per week."
                ),
            })
        else:
            feasibility["message"] = "Your target date is realistic at the current weekly capacity."

    if fallback_count:
        warnings.append(
            f"{fallback_count} course(s) have no published duration; a {int(FALLBACK_COURSE_HOURS)}-hour "
            "estimate was used. Durations are marked as estimates in the roadmap."
        )

    return {
        "start_date": start,
        "total_hours": round(total_hours, 1),
        "total_weeks": total_weeks,
        "expected_completion": expected_completion,
        "weekly_capacity": capacity,
        "parallel": parallel,
        "weeks": weeks,
        "months": months,
        "phases": phase_results,
        "feasibility": feasibility,
        "warnings": warnings,
    }
