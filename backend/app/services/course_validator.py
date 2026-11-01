"""Course URL validation with SSRF protections and honest verification states."""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Course

TRUSTED_EDUCATION_HOSTS = {
    "coursera.org", "www.coursera.org",
    "udemy.com", "www.udemy.com",
    "freecodecamp.org", "www.freecodecamp.org",
    "kaggle.com", "www.kaggle.com",
    "nptel.ac.in", "swayam.gov.in",
    "youtube.com", "www.youtube.com",
    "developers.google.com", "learndigital.withgoogle.com",
    "learn.microsoft.com", "skillbuilder.aws",
    "fullstackopen.com", "www.theodinproject.com",
    "developer.mozilla.org", "course.fast.ai",
    "huggingface.co", "ocw.mit.edu",
    "tryhackme.com", "www.netacad.com",
    "academy.hubspot.com", "www.semrush.com",
    "www.facebook.com", "www.canva.com",
    "www.figma.com", "www.interaction-design.org",
    "www.scrum.org", "www.atlassian.com",
    "www.pmi.org", "www.nngroup.com",
    "www.khanacademy.org", "www.autodesk.com",
    "www.solidworks.com", "matlabacademy.mathworks.com",
    "trailhead.salesforce.com", "analytics.google.com",
    "docs.python.org", "fastapi.tiangolo.com", "react.dev",
    "kubernetes.io", "docs.docker.com", "owasp.org",
    "pandas.pydata.org", "scikit-learn.org",
    "www.postgresql.org", "help.figma.com",
    "www.onetonline.org", "esco.ec.europa.eu",
    "www.techinterviewhandbook.org", "roadmap.sh",
}


def _is_private_host(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        try:
            address = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        if (
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_reserved
            or address.is_multicast
        ):
            return True
    return False


def static_validate(url: str) -> tuple[bool, str]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False, "URL must use http or https"
    if not parsed.hostname:
        return False, "URL has no hostname"
    host = parsed.hostname.lower()
    if host in {"localhost", "127.0.0.1", "0.0.0.0"} or _is_private_host(host):
        return False, "Private or local URLs are not allowed"
    if parsed.hostname.lower() not in TRUSTED_EDUCATION_HOSTS:
        # Not a hard failure: admins may add a new verified provider. Flag it.
        return True, "Host is not in the curated education allowlist; review manually"
    return True, "URL structure is valid"


def check_course_url(url: str, timeout: float | None = None) -> dict:
    """Perform a live reachability check. Never raises."""
    ok, note = static_validate(url)
    if not ok:
        return {"reachable": False, "status": "invalid", "note": note, "http_status": None}

    headers = {
        "User-Agent": "SmartLearnAI/1.0 (+course-link-validator)",
        "Accept": "text/html,application/xhtml+xml",
    }
    try:
        with httpx.Client(
            timeout=timeout or settings.URL_VALIDATION_TIMEOUT,
            follow_redirects=True,
            headers=headers,
        ) as client:
            response = client.get(url)
        if 200 <= response.status_code < 400:
            return {
                "reachable": True, "status": "reachable",
                "note": note, "http_status": response.status_code,
            }
        if response.status_code in {401, 403, 429}:
            return {
                "reachable": True, "status": "restricted",
                "note": f"Host reachable but returned HTTP {response.status_code} (bot protection)",
                "http_status": response.status_code,
            }
        return {
            "reachable": False, "status": "error",
            "note": f"HTTP {response.status_code}", "http_status": response.status_code,
        }
    except httpx.HTTPError as exc:
        return {
            "reachable": False, "status": "unreachable",
            "note": f"Could not reach host: {type(exc).__name__}", "http_status": None,
        }


def validate_course_record(db: Session, course: Course, network: bool = True) -> dict:
    static_ok, static_note = static_validate(course.url)
    result: dict = {
        "course_id": course.course_id,
        "url": course.url,
        "static_valid": static_ok,
        "note": static_note,
        "verified": bool(course.verified),
        "link_type": course.link_type,
    }
    if not static_ok:
        result.update({"status": "invalid", "reachable": False})
        return result

    if network and settings.COURSE_URL_VALIDATION:
        live = check_course_url(course.url)
        result.update(live)
        if live["status"] == "reachable" and course.link_type == "direct":
            course.verified = True
            course.last_checked = "live-check"
        elif live["status"] in {"error", "unreachable", "invalid"}:
            course.verified = False
        db.commit()
    else:
        result.update({"status": "static-only", "reachable": None})
    return result


def validate_catalogue(db: Session, limit: int = 25, network: bool = True) -> dict:
    courses = db.query(Course).order_by(Course.course_id).limit(limit).all()
    results = [validate_course_record(db, c, network=network) for c in courses]
    return {
        "checked": len(results),
        "reachable": sum(1 for r in results if r.get("reachable")),
        "invalid": sum(1 for r in results if r.get("status") == "invalid"),
        "restricted": sum(1 for r in results if r.get("status") == "restricted"),
        "results": results,
    }
