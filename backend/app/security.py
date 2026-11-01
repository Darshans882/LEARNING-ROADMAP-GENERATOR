"""Password hashing and JWT helpers."""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from .config import settings

PASSWORD_MIN_LENGTH = 8


class PasswordPolicyError(ValueError):
    pass


def validate_password(password: str) -> None:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise PasswordPolicyError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters long.")
    if not re.search(r"[A-Za-z]", password):
        raise PasswordPolicyError("Password must contain at least one letter.")
    if not re.search(r"\d", password):
        raise PasswordPolicyError("Password must contain at least one number.")


def hash_password(password: str) -> str:
    validate_password(password)
    # bcrypt has a 72-byte input limit; reject rather than silently truncate.
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        raise PasswordPolicyError("Password must be at most 72 bytes.")
    return bcrypt.hashpw(encoded, bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, role: str, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "iss": "smartlearn-ai",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
        issuer="smartlearn-ai",
    )
