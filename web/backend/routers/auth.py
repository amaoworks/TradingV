import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from .. import database as db


router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)

_PASSWORD_ITERATIONS = 210_000
_TOKEN_TTL_DAYS = 7
_ROLES = {"admin", "member", "viewer"}


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


def _debug_auth_enabled() -> bool:
    return os.getenv("TRADINGV_DEBUG_AUTH", "").strip().lower() in {"1", "true", "yes", "on"}


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        _PASSWORD_ITERATIONS,
    )
    return f"pbkdf2_sha256${_PASSWORD_ITERATIONS}${_b64url(salt)}${_b64url(digest)}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algo, iterations_text, salt_text, digest_text = stored_hash.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        salt = _b64url_decode(salt_text)
        expected = _b64url_decode(digest_text)
    except (ValueError, TypeError):
        return False

    actual = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(actual, expected)


def _jwt_secret() -> str:
    return (
        os.getenv("TRADINGV_JWT_SECRET")
        or os.getenv("TRADINGV_AUTH_SECRET")
        or "tradingv-local-development-secret"
    )


def _jwt_encode(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_part = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_part = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_part}.{payload_part}".encode("ascii")
    signature = hmac.new(_jwt_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_part}.{payload_part}.{_b64url(signature)}"


def _jwt_decode(token: str) -> dict:
    try:
        header_part, payload_part, signature_part = token.split(".", 2)
        signing_input = f"{header_part}.{payload_part}".encode("ascii")
        expected = hmac.new(_jwt_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_decode(signature_part), expected):
            raise ValueError("bad signature")
        header = json.loads(_b64url_decode(header_part).decode("utf-8"))
        if header.get("alg") != "HS256":
            raise ValueError("unsupported algorithm")
        payload = json.loads(_b64url_decode(payload_part).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    return payload


def create_access_token(user: dict) -> str:
    ttl_days = int(os.getenv("TRADINGV_AUTH_TOKEN_DAYS", str(_TOKEN_TTL_DAYS)))
    return _jwt_encode(
        {
            "sub": str(user["id"]),
            "username": user["username"],
            "role": user["role"],
            "exp": int(time.time() + ttl_days * 86400),
        }
    )


def public_user(user: dict) -> dict:
    return {
        "id": str(user["id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "avatar": user.get("avatar"),
        "active": bool(user.get("is_active", 1)),
        "lastLogin": user.get("last_login") or "-",
        "createdAt": user.get("created_at"),
        "updatedAt": user.get("updated_at"),
    }


def _auth_response(user: dict) -> dict:
    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "user": public_user(user),
    }


def _normalize_username(username: str) -> str:
    value = username.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Username is required")
    return value


def _normalize_email(email: str) -> str:
    value = email.strip().lower()
    if not value or "@" not in value:
        raise HTTPException(status_code=400, detail="Valid email is required")
    return value


def _ensure_debug_admin():
    if not _debug_auth_enabled():
        return
    username = os.getenv("TRADINGV_DEBUG_AUTH_USER", "admin").strip() or "admin"
    password = os.getenv("TRADINGV_DEBUG_AUTH_PASSWORD", "admin")
    email = os.getenv("TRADINGV_DEBUG_AUTH_EMAIL", "admin@tradingv.local").strip().lower()
    password_hash = hash_password(password)

    existing = db.get_user_by_username(username)
    if existing:
        email_owner = db.get_user_by_email(email)
        if email_owner and int(email_owner["id"]) != int(existing["id"]):
            email = existing["email"]
        db.update_user(
            int(existing["id"]),
            email=email,
            password_hash=password_hash,
            role="admin",
            is_active=True,
        )
        return

    email_owner = db.get_user_by_email(email)
    if email_owner:
        email = f"{username}+debug@tradingv.local"
        if db.get_user_by_email(email):
            email = f"{username}-{secrets.token_hex(4)}@tradingv.local"
    db.create_user(
        username=username,
        email=email,
        password_hash=password_hash,
        role="admin",
        is_active=True,
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    payload = _jwt_decode(credentials.credentials)
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    user = db.get_user(user_id)
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user


@router.post("/login")
async def login(req: LoginRequest):
    _ensure_debug_admin()
    username = _normalize_username(req.username)
    user = db.get_user_by_username(username)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if not user.get("is_active"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    user = db.touch_user_login(int(user["id"])) or user
    return _auth_response(user)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest):
    username = _normalize_username(req.username)
    email = _normalize_email(req.email)
    if len(req.password) < 3:
        raise HTTPException(status_code=400, detail="Password is too short")

    role = "admin" if db.count_users() == 0 else "member"
    try:
        user = db.create_user(
            username=username,
            email=email,
            password_hash=hash_password(req.password),
            role=role,
            is_active=True,
        )
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email is already taken") from exc
    return {"message": "User registered successfully", "user": public_user(user)}


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    _normalize_email(req.email)
    # No mailer is configured yet. Return a generic success so callers do not
    # learn whether an email exists.
    return {"message": "Password reset email sent"}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)
