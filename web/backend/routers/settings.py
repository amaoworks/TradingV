import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

from tradingagents.default_config import DEFAULT_CONFIG, _ENV_OVERRIDES
from tradingagents.llm_clients.api_key_env import PROVIDER_API_KEY_ENV
from tradingagents.llm_clients.model_catalog import MODEL_OPTIONS
from ..models import SettingsUpdate, APIKeysUpdate, ProviderConnectionUpdate

router = APIRouter(prefix="/api", tags=["settings"])

# Runtime settings override (in-memory, persists for server lifetime).
# .env-persisted fields are reapplied on startup via DEFAULT_CONFIG so this
# dict only needs to hold the per-request deltas the server saw.
_overrides: dict = {}

# Project-root .env file shared with the CLI. Resolved relative to this file
# so the path is correct regardless of where the server is launched from.
_ENV_PATH = Path(__file__).resolve().parents[3] / ".env"

# Reverse map: config-key → TRADINGAGENTS_* env var name. Built once from
# the single-source-of-truth dict in default_config so adding a new override
# in one place automatically makes it persist-able from the web.
_CONFIG_KEY_TO_ENV: dict[str, str] = {v: k for k, v in _ENV_OVERRIDES.items() if v}

_PROVIDER_LABELS: dict[str, str] = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "google": "Google",
    "azure": "Azure OpenAI",
    "xai": "xAI",
    "deepseek": "DeepSeek",
    "qwen": "Qwen",
    "qwen-cn": "Qwen CN",
    "glm": "GLM",
    "glm-cn": "GLM CN",
    "minimax": "MiniMax",
    "minimax-cn": "MiniMax CN",
    "openrouter": "OpenRouter",
    "ollama": "Ollama",
}

_DEFAULT_BASE_URLS: dict[str, str | None] = {
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com/",
    "google": None,
    "azure": None,
    "xai": "https://api.x.ai/v1",
    "deepseek": "https://api.deepseek.com",
    "qwen": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    "qwen-cn": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "glm": "https://api.z.ai/api/paas/v4/",
    "glm-cn": "https://open.bigmodel.cn/api/paas/v4/",
    "minimax": "https://api.minimax.io/v1",
    "minimax-cn": "https://api.minimaxi.com/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "ollama": "http://localhost:11434/v1",
}


def _provider_base_url_env(provider: str) -> str:
    suffix = provider.upper().replace("-", "_")
    return f"TRADINGAGENTS_PROVIDER_{suffix}_BASE_URL"


def _provider_base_url(provider: str) -> str | None:
    provider = provider.lower()
    provider_specific = os.environ.get(_provider_base_url_env(provider))
    if provider_specific:
        return provider_specific
    config = get_effective_config()
    if config.get("llm_provider") == provider and config.get("backend_url"):
        return config.get("backend_url")
    if provider == "ollama" and os.environ.get("OLLAMA_BASE_URL"):
        return os.environ["OLLAMA_BASE_URL"]
    return _DEFAULT_BASE_URLS.get(provider)


def get_provider_base_url(provider: str) -> str | None:
    """Public helper for runners that need the saved endpoint for a provider."""
    return _provider_base_url(provider)


def get_effective_config() -> dict:
    config = DEFAULT_CONFIG.copy()
    config.update(_overrides)
    return config


@router.get("/settings")
async def get_settings():
    config = get_effective_config()
    return {
        "llm_provider": config.get("llm_provider"),
        "deep_think_llm": config.get("deep_think_llm"),
        "quick_think_llm": config.get("quick_think_llm"),
        "backend_url": config.get("backend_url"),
        "max_debate_rounds": config.get("max_debate_rounds"),
        "max_risk_discuss_rounds": config.get("max_risk_discuss_rounds"),
        "output_language": config.get("output_language"),
        "checkpoint_enabled": config.get("checkpoint_enabled"),
        "benchmark_ticker": config.get("benchmark_ticker"),
        "data_cache_dir": config.get("data_cache_dir"),
        "results_dir": config.get("results_dir"),
        "memory_log_path": config.get("memory_log_path"),
    }


@router.put("/settings")
async def update_settings(req: SettingsUpdate):
    """Update settings and persist any TRADINGAGENTS_*-mapped fields to .env.

    Fields that have a corresponding ``TRADINGAGENTS_*`` env var (per
    ``_ENV_OVERRIDES``) are written through to the project-root ``.env``
    AND mirrored into ``os.environ`` so:
      * the running server picks them up immediately (via the in-memory
        ``_overrides`` dict), and
      * the next server start re-reads them through ``DEFAULT_CONFIG``'s
        ``_apply_env_overrides``, so the choice survives restarts and is
        shared with the CLI.
    Fields without an env-var mapping (e.g. ``benchmark_ticker``) still
    get applied in-memory.
    """
    updates = req.model_dump(exclude_none=True)
    if not updates:
        return {"ok": True, "updated": []}

    # In-memory apply first, so /api/settings reflects the new state
    # without waiting on the disk write.
    _overrides.update(updates)

    persisted: list[str] = []
    try:
        from dotenv import set_key  # type: ignore
    except ImportError:
        # Without python-dotenv we can still apply in-memory; the CLI just
        # won't see the change on next start.
        return {"ok": True, "updated": list(updates.keys()), "persisted": [], "warning": "python-dotenv not installed; changes not written to .env"}

    _ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not _ENV_PATH.exists():
        _ENV_PATH.write_text("", encoding="utf-8")

    for key, value in updates.items():
        env_var = _CONFIG_KEY_TO_ENV.get(key)
        if not env_var:
            continue
        # Coerce booleans / ints / None into the string form dotenv writes.
        if value is None:
            continue
        if isinstance(value, bool):
            str_val = "true" if value else "false"
        else:
            str_val = str(value)
        set_key(str(_ENV_PATH), env_var, str_val, quote_mode="never")
        os.environ[env_var] = str_val
        persisted.append(env_var)

    return {"ok": True, "updated": list(updates.keys()), "persisted": persisted}


# --- API key management ---------------------------------------------------
#
# Keys live in the project-root .env file (same one the CLI's
# load_dotenv() reads at import time). We mirror writes into os.environ
# so the running server picks up changes without a restart, and persist
# to disk so a restart doesn't lose them.

def _mask_key(value: str) -> str:
    """Return a UI-friendly mask: first 4 + last 4, ``***`` for short values."""
    if not value:
        return ""
    if len(value) <= 8:
        return "***"
    return f"{value[:4]}…{value[-4:]}"


def _provider_key_rows() -> list[dict]:
    """List of {provider, env_var, masked, set} for every supported provider."""
    rows = []
    for provider, env_var in PROVIDER_API_KEY_ENV.items():
        if not env_var:
            # Providers like ollama that don't authenticate; surface them so
            # the UI can show "No key required" rather than omitting silently.
            rows.append({
                "provider": provider,
                "env_var": None,
                "masked": "",
                "set": False,
                "required": False,
            })
            continue
        current = os.environ.get(env_var, "")
        rows.append({
            "provider": provider,
            "env_var": env_var,
            "masked": _mask_key(current),
            "set": bool(current),
            "required": True,
        })
    return rows


def _provider_connection_rows() -> list[dict]:
    """Return only providers that have been configured by the user."""
    rows = []
    for provider, env_var in PROVIDER_API_KEY_ENV.items():
        base_url = _provider_base_url(provider)
        key_set = bool(env_var and os.environ.get(env_var, ""))
        # Do not list every known provider. A provider appears once the user
        # has supplied an API key or saved a provider-specific base URL. Local
        # runtimes such as Ollama have no key, so their saved URL is the marker.
        if not key_set and not os.environ.get(_provider_base_url_env(provider)):
            continue
        rows.append({
            "provider": provider,
            "label": _PROVIDER_LABELS.get(provider, provider),
            "env_var": env_var,
            "base_url": base_url or "",
            "default_base_url": _DEFAULT_BASE_URLS.get(provider) or "",
            "masked": _mask_key(os.environ.get(env_var, "")) if env_var else "",
            "set": key_set,
            "required": bool(env_var),
        })
    return rows


def _all_provider_options() -> list[dict]:
    rows = []
    for provider, env_var in PROVIDER_API_KEY_ENV.items():
        rows.append({
            "provider": provider,
            "label": _PROVIDER_LABELS.get(provider, provider),
            "env_var": env_var,
            "required": bool(env_var),
            "default_base_url": _DEFAULT_BASE_URLS.get(provider) or "",
        })
    return rows


@router.get("/api-keys")
async def get_api_keys():
    """Return masked key state per provider; never echoes the raw key."""
    return {"providers": _provider_key_rows()}


@router.get("/provider-connections")
async def get_provider_connections():
    """Return configured provider connections plus provider choices for add/edit."""
    return {
        "providers": _provider_connection_rows(),
        "available": _all_provider_options(),
    }


@router.get("/model-catalog")
async def get_model_catalog():
    """Expose the per-provider model catalog the CLI uses.

    Returns ``{provider: {quick: [{label, value}, ...], deep: [...]}}``.
    Providers without a static catalog (e.g. ``openrouter``, ``azure``) are
    simply absent — the frontend should fall back to a free-text input for
    those, since their model lists are either dynamic or deployment-specific.
    """
    out: dict[str, dict[str, list[dict[str, str]]]] = {}
    for provider, modes in MODEL_OPTIONS.items():
        out[provider] = {
            mode: [{"label": label, "value": value} for label, value in options]
            for mode, options in modes.items()
        }
    return {"providers": out}


@router.put("/api-keys")
async def update_api_keys(req: APIKeysUpdate):
    """Update API keys for one or more providers.

    Each entry in ``keys`` maps a provider name (case-insensitive) to either
    a new key (any non-empty string) or an empty string to clear it. Changes
    are mirrored into ``os.environ`` for the running process AND persisted
    into the project-root ``.env`` file so a restart preserves them.
    """
    if not req.keys:
        return {"ok": True, "updated": []}

    try:
        from dotenv import set_key, unset_key  # type: ignore
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"python-dotenv is required to persist keys: {e}",
        )

    # Make sure the .env file exists; set_key requires it to.
    _ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not _ENV_PATH.exists():
        _ENV_PATH.write_text("", encoding="utf-8")

    updated: list[str] = []
    unknown: list[str] = []

    for provider_raw, value in req.keys.items():
        provider = provider_raw.strip().lower()
        env_var = PROVIDER_API_KEY_ENV.get(provider)
        if not env_var:
            unknown.append(provider_raw)
            continue
        value = value or ""
        if value:
            set_key(str(_ENV_PATH), env_var, value, quote_mode="never")
            os.environ[env_var] = value
        else:
            unset_key(str(_ENV_PATH), env_var)
            os.environ.pop(env_var, None)
        updated.append(env_var)

    if unknown and not updated:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown providers: {', '.join(unknown)}",
        )

    return {"ok": True, "updated": updated, "unknown": unknown}


@router.put("/provider-connections")
async def update_provider_connection(req: ProviderConnectionUpdate):
    provider = req.provider.strip().lower()
    if provider not in PROVIDER_API_KEY_ENV:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {req.provider}")

    try:
        from dotenv import set_key, unset_key  # type: ignore
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"python-dotenv is required to persist provider settings: {e}",
        )

    _ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not _ENV_PATH.exists():
        _ENV_PATH.write_text("", encoding="utf-8")

    updated: list[str] = []
    env_var = PROVIDER_API_KEY_ENV[provider]
    if req.api_key is not None:
        value = req.api_key.strip()
        if env_var:
            if value:
                set_key(str(_ENV_PATH), env_var, value, quote_mode="never")
                os.environ[env_var] = value
            else:
                unset_key(str(_ENV_PATH), env_var)
                os.environ.pop(env_var, None)
            updated.append(env_var)
        elif value:
            raise HTTPException(status_code=400, detail=f"{provider} does not use an API key")

    base_env = _provider_base_url_env(provider)
    if req.base_url is not None:
        base_url = req.base_url.strip()
        if base_url:
            set_key(str(_ENV_PATH), base_env, base_url, quote_mode="never")
            os.environ[base_env] = base_url
            if provider == "ollama":
                set_key(str(_ENV_PATH), "OLLAMA_BASE_URL", base_url, quote_mode="never")
                os.environ["OLLAMA_BASE_URL"] = base_url
        else:
            unset_key(str(_ENV_PATH), base_env)
            os.environ.pop(base_env, None)
        updated.append(base_env)

    rows = [r for r in _provider_connection_rows() if r["provider"] == provider]
    return {"ok": True, "updated": updated, "provider": rows[0] if rows else None}


@router.delete("/provider-connections/{provider}")
async def delete_provider_connection(provider: str):
    provider = provider.strip().lower()
    if provider not in PROVIDER_API_KEY_ENV:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    try:
        from dotenv import unset_key  # type: ignore
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"python-dotenv is required to persist provider settings: {e}",
        )

    env_var = PROVIDER_API_KEY_ENV[provider]
    removed: list[str] = []
    if env_var:
        unset_key(str(_ENV_PATH), env_var)
        os.environ.pop(env_var, None)
        removed.append(env_var)
    base_env = _provider_base_url_env(provider)
    unset_key(str(_ENV_PATH), base_env)
    os.environ.pop(base_env, None)
    removed.append(base_env)
    if provider == "ollama":
        unset_key(str(_ENV_PATH), "OLLAMA_BASE_URL")
        os.environ.pop("OLLAMA_BASE_URL", None)
        removed.append("OLLAMA_BASE_URL")
    return {"ok": True, "removed": removed}
