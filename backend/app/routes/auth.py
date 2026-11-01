"""Authentication and account routes."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, serialize_user
from ..models import ActivityLog, StudentProfile, User, utcnow
from ..schemas import (
    AccountUpdate,
    LoginRequest,
    PasswordChange,
    RegisterRequest,
    TokenOut,
    UserOut,
)
from ..security import (
    PasswordPolicyError,
    create_access_token,
    hash_password,
    validate_password,
    verify_password,
)
from ..services.profile_service import profile_completeness

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _token_response(user: User) -> dict:
    token = create_access_token(str(user.id), user.role, extra={"email": user.email})
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    try:
        password_hash = hash_password(payload.password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    user = User(
        email=payload.email,
        password_hash=password_hash,
        full_name=payload.full_name,
        role="student",
        is_active=True,
        last_login=utcnow(),
    )
    db.add(user)
    db.flush()
    profile = StudentProfile(user_id=user.id, onboarding_completed=False)
    db.add(profile)
    db.add(ActivityLog(user_id=user.id, action="account_created", detail="Student account registered"))
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated")
    user.last_login = utcnow()
    db.add(ActivityLog(user_id=user.id, action="login", detail="Signed in"))
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/token", response_model=TokenOut, include_in_schema=True)
def token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> dict:
    """OAuth2 password form endpoint used by Swagger UI's Authorize button."""
    user = db.query(User).filter(User.email == form_data.username.strip().lower()).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated")
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    return _token_response(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> dict:
    return serialize_user(user)


@router.patch("/me", response_model=UserOut)
def update_account(
    payload: AccountUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    try:
        validate_password(payload.new_password)
        user.password_hash = hash_password(payload.new_password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if verify_password(payload.new_password, user.password_hash) and payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current password")
    db.commit()
    return {"message": "Password updated successfully"}


@router.post("/logout")
def logout() -> dict:
    # JWTs are stateless; the client discards the token.
    return {"message": "Signed out"}


@router.get("/me/export")
def export_account(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    return {
        "user": serialize_user(user),
        "profile": {
            "college_name": profile.college_name if profile else None,
            "degree": profile.degree if profile else None,
            "department": profile.department if profile else None,
            "career_goal": profile.desired_role if profile else None,
            "completeness": profile_completeness(profile),
        },
        "exported_at": datetime.now(timezone.utc),
    }
