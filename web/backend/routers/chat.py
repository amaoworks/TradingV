from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from .. import database as db
from .auth import get_current_user


router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessageCreate(BaseModel):
    text: str


def _message_public(row: dict) -> dict:
    created_at = row.get("created_at") or ""
    time_text = ""
    try:
        time_text = datetime.fromisoformat(created_at.rstrip("Z")).strftime("%H:%M")
    except ValueError:
        time_text = created_at[11:16] if len(created_at) >= 16 else ""
    return {
        "id": str(row["id"]),
        "roomKey": row["room_key"],
        "user": row["username"],
        "text": row["text"],
        "time": time_text,
        "createdAt": created_at,
    }


def _room_public(row: dict, *, include_messages: bool = True) -> dict:
    messages = db.list_chat_messages(row["key"]) if include_messages else []
    return {
        "key": row["key"],
        "i18nKey": row["i18n_key"],
        "online": row["online_hint"],
        "messages": [_message_public(message) for message in messages],
    }


@router.get("/rooms")
async def list_rooms(_: dict = Depends(get_current_user)):
    return {"items": [_room_public(room) for room in db.list_chat_rooms()]}


@router.get("/rooms/{room_key}/messages")
async def list_messages(
    room_key: str,
    limit: int = Query(default=200, ge=1, le=500),
    _: dict = Depends(get_current_user),
):
    if not db.get_chat_room(room_key):
        raise HTTPException(status_code=404, detail="Chat room not found")
    return {
        "items": [
            _message_public(message)
            for message in db.list_chat_messages(room_key, limit=limit)
        ]
    }


@router.post("/rooms/{room_key}/messages", status_code=201)
async def create_message(
    room_key: str,
    req: ChatMessageCreate,
    user: dict = Depends(get_current_user),
):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text is required")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="Message text is too long")
    row = db.add_chat_message(
        room_key,
        user_id=int(user["id"]),
        username=user["username"],
        text=text,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Chat room not found")
    return _message_public(row)
