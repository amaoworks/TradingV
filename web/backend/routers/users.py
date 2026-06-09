import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from .. import database as db
from .auth import hash_password, public_user, require_admin


router = APIRouter(prefix="/api/users", tags=["users"])

_ROLES = {"admin", "member", "viewer"}


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "member"
    active: bool = True


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None


def _validate_role(role: str) -> str:
    value = role.strip().lower()
    if value not in _ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    return value


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


def _ensure_not_last_active_admin(user_id: int, *, next_role: Optional[str], next_active: Optional[bool]):
    current = db.get_user(user_id)
    if not current:
        raise HTTPException(status_code=404, detail="User not found")
    if current["role"] != "admin" or not current["is_active"]:
        return
    role_after = next_role if next_role is not None else current["role"]
    active_after = next_active if next_active is not None else bool(current["is_active"])
    if role_after == "admin" and active_after:
        return
    if db.count_active_admin_users(exclude_user_id=user_id) == 0:
        raise HTTPException(status_code=400, detail="Cannot remove the last active admin")


@router.get("")
async def list_users(
    search: Optional[str] = Query(default=None),
    _: dict = Depends(require_admin),
):
    return {"items": [public_user(user) for user in db.list_users(search=search)]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(req: UserCreate, _: dict = Depends(require_admin)):
    username = _normalize_username(req.username)
    email = _normalize_email(req.email)
    role = _validate_role(req.role)
    if len(req.password) < 3:
        raise HTTPException(status_code=400, detail="Password is too short")
    try:
        user = db.create_user(
            username=username,
            email=email,
            password_hash=hash_password(req.password),
            role=role,
            is_active=req.active,
        )
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Username or email is already taken") from exc
    return public_user(user)


@router.put("/{user_id}")
async def update_user(user_id: int, req: UserUpdate, _: dict = Depends(require_admin)):
    fields = {}
    if req.username is not None:
        fields["username"] = _normalize_username(req.username)
    if req.email is not None:
        fields["email"] = _normalize_email(req.email)
    if req.role is not None:
        fields["role"] = _validate_role(req.role)
    if req.active is not None:
        fields["is_active"] = req.active
    if req.password:
        if len(req.password) < 3:
            raise HTTPException(status_code=400, detail="Password is too short")
        fields["password_hash"] = hash_password(req.password)

    _ensure_not_last_active_admin(
        user_id,
        next_role=fields.get("role"),
        next_active=fields.get("is_active"),
    )

    try:
        user = db.update_user(user_id, **fields)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Username or email is already taken") from exc
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return public_user(user)


@router.delete("/{user_id}")
async def delete_user(user_id: int, current_user: dict = Depends(require_admin)):
    if int(current_user["id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete the current user")
    _ensure_not_last_active_admin(user_id, next_role=None, next_active=False)
    db.delete_user(user_id)
    return {"ok": True}
