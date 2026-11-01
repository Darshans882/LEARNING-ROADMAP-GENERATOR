"""Global AI assistant routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..ai.chatbot import handle_chat
from ..database import get_db
from ..deps import get_current_user, get_profile
from ..models import ChatConversation, ChatMessage, StudentProfile, User
from ..schemas import ChatRequest, ChatResponse, ConversationOut

router = APIRouter(prefix="/chat", tags=["Assistant"])

STARTER_PROMPTS = [
    "What should I study next?",
    "Explain my biggest skill gap",
    "Build a study plan for this week",
    "Suggest a project I can finish in a weekend",
    "How ready am I for my target role?",
]


@router.post("", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    profile: StudentProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> dict:
    return handle_chat(
        db, user, profile, payload.message,
        conversation_id=payload.conversation_id, node_key=payload.node_key,
    )


@router.get("/suggestions")
def suggestions(user: User = Depends(get_current_user)) -> dict:
    return {"suggested_prompts": STARTER_PROMPTS}


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    limit: int = Query(default=30, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = (
        db.query(ChatConversation)
        .filter(ChatConversation.user_id == user.id)
        .order_by(ChatConversation.updated_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": c.id,
            "title": c.title,
            "context_node_key": c.context_node_key,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
            "message_count": db.query(ChatMessage).filter(ChatMessage.conversation_id == c.id).count(),
        }
        for c in rows
    ]


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    conversation = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id, ChatConversation.user_id == user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        "id": conversation.id,
        "title": conversation.title,
        "context_node_key": conversation.context_node_key,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "sources": m.sources or [],
                "created_at": m.created_at,
            }
            for m in conversation.messages
        ],
    }


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    conversation = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id, ChatConversation.user_id == user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conversation)
    db.commit()
    return {"message": "Conversation deleted"}
