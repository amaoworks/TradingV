# TradingV

> **可视化多智能体 LLM 交易研究平台 — 实时呈现 Agent 决策、辩论与因果链推理过程。**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Frontend](https://img.shields.io/badge/Frontend-React_%2B_Kumo_%2B_Vite-f48120.svg)](https://kumo-ui.com/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)

> ⚠️ **仅供研究与教学用途，不构成任何投资建议。** [免责声明 ↓](#免责声明)

---

## 🌟 核心特性

- **结构化可视化推理**：解析 Agent 报告，将复杂的推理逻辑转化为可视化图表。
  - **因果链图谱**：展示 `事件 → 直接影响 → 供应链 → 板块情绪 → 个股` 的纵向传导链条。
  - **多空辩论可视化**：左右侧对话气泡展示 Agent 之间的辩论互动。
  - **实时流式更新**：通过 WebSocket 实时推送分析进度和辩论进程。
- **原生 A 股支持**：
  - **免费/专业数据源**：集成 AKShare（免费）与 Tushare Pro（可选），自动识别并路由 A 股代码。
  - **特色分析师 Agent**：内置 `cn_social` (股吧舆情)、`event` (因果分析)、`capital_flow` (资金流向)、`macro` (宏观板块) 4 个 A 股分析师。
- **完整研究工作流**：
  - **自然语言解析**：支持输入“研究茅台短期”等 Query 自动解析代码与日期。
  - **持仓与模拟交易**：支持记录持仓及盈亏，并可一键根据 Agent 决策进行模拟下单（适配 A 股 T+1）。
  - **决策回放回测**：基于已存储的决策进行历史回放回测，零 LLM 消耗，提供年化收益、最大回撤、夏普比率等指标。
  - **实时 K 线抽屉**：集成日线及分钟级 K 线，支持叠加入场、目标及止损参考线。
  - **系统管理**：支持多用户登录注册、权限管理、API Key 的 Web 端加密设置，并集成团队协作聊天室。

---

## 🆚 相比上游 TradingAgents 的改进

| 功能模块 | 上游 `TradingAgents` | **TradingV** |
| :--- | :--- | :--- |
| **用户界面** | 仅 CLI 命令行 | 丰富易用的 Web UI + CLI |
| **市场覆盖** | 仅美股 | 美股 + 港股 + **原生 A 股** |
| **数据源** | Yahoo Finance 等 | yfinance + **AKShare (免费) / Tushare Pro** |
| **展示形式** | Markdown 纯文本报告 | **实时流式结构化可视化** + Markdown |
| **A 股分析师** | 无 | `cn_social`, `event`, `capital_flow`, `macro` |
| **工作流支持** | 无 | 持仓追踪、模拟交易、定时分析、决策回测 |
| **系统配套** | 无 | 用户管理、API Key 集中管理、团队聊天室 |

---

## 🏛 系统架构

```
                 ┌────────────────────────────────────────────────────────┐
                 │             TradingAgentsGraph (LangGraph)             │
                 │                                                        │
   selected ───► │  Analysts ─► Researchers ─► Trader ─► Risk ─► Portfolio│
   analysts      │  market                    (debate)  (debate) Manager  │
                 │  social                                                │
                 │  news                                                  │
                 │  fundamentals                                          │
                 │  cn_social   ← Studio (A-share)                        │
                 │  event       ← Studio (LLM causal chain)               │
                 │  capital_flow← Studio (主力资金 / 北向 / 龙虎榜)        │
                 │  macro       ← Studio (CPI/PPI/M2/PMI/LPR)             │
                 └────────────────────────────────────────────────────────┘
                                          ▲
                                          │  WebSocket: agent_complete + debate_turn
                                          │
                 ┌────────────────────────────────────────────────────────┐
                 │   Web Studio                                            │
                 │   FastAPI ◄─► SQLite  │  React + Kumo frontend         │
                 │                                                        │
                 │   ▸ 自然语言分析入口                                    │
                 │   ▸ 因果链 + 辩论气泡可视化                             │
                 │   ▸ 持仓追踪(实时报价、最新信号)                      │
                 │   ▸ 定时分析(间隔 / 每日 / 每周)                      │
                 │   ▸ 模拟交易(按决策下单、NAV 曲线)                    │
                 │   ▸ K 线面板(日线 + 1/5/15/30/60 分钟,实时)          │
                 │   ▸ 决策回放回测                                        │
                 │   ▸ API Key + 模型目录管理                              │
                 └────────────────────────────────────────────────────────┘
                                          ▲
                                          │  vendor 路由自动识别 A 股
                                          │  → akshare → tushare → yfinance
                 ┌────────────────────────────────────────────────────────┐
                 │   数据源                                                │
                 │   AKShare  · Tushare · yfinance · Alpha Vantage         │
                 │   东方财富股吧 · Reddit · StockTwits · MediaCrawler    │
                 └────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 1. 安装依赖

推荐使用 [uv](https://github.com/astral-sh/uv) 极速同步环境：

```bash
git clone <your-repo-url> TradingV
cd TradingV

# 使用 uv 同步虚拟环境（推荐）
uv sync --extra web --extra cn

# 或者使用传统 pip 安装
python -m venv .venv
source .venv/bin/activate  # Windows 下使用 .venv\Scripts\activate
pip install -e ".[web,cn]"
```

*注：你可以根据需求安装其他的 extras：`cn-pro` (Tushare 付费兜底)、`cn-social` (股吧/微博舆情分析) 等。*

### 2. 配置环境变量

复制配置文件并编辑：

```bash
cp .env.example .env
```
在 `.env` 中至少配置一个 LLM Provider 的 API Key（如 `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY`）。也可以直接在 Web 端的「设置」页面中配置，值会自动写回 `.env` 文件。

### 3. 启动项目

```bash
# 启动所有服务（本地开发调试模式，自动创建管理员 admin/admin）
scripts/start.sh all --debug-auth

# 分步手动启动：
scripts/start.sh backend    # 启动 FastAPI 后端 (默认端口 8000)
scripts/start.sh frontend   # 启动 Vite 前端 (默认端口 3000)
```

项目运行后：
- 打开 Web 界面：[http://localhost:3000](http://localhost:3000)
- 若未使用 `--debug-auth`，首个注册的用户将自动获得管理员权限。

---

## 🐍 编程使用示例

你也可以在 Python 代码中直接调用 TradingV 的多智能体 Graph：

```python
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

config = DEFAULT_CONFIG.copy()
config["llm_provider"] = "deepseek"
config["deep_think_llm"] = "deepseek-reasoner"
config["quick_think_llm"] = "deepseek-chat"

# 实例化 Graph
ta = TradingAgentsGraph(
    selected_analysts=["market", "cn_social", "event", "news", "fundamentals"],
    config=config,
)

# 传入 A 股代码或名称进行分析
_, decision = ta.propagate("600519", "2026-06-09")
print(decision)
```

支持的模型列表和各 Provider 的模型 ID 请参考 [tradingagents/llm_clients/model_catalog.py](file:///root/workspace/TradingV/tradingagents/llm_clients/model_catalog.py)。

---

## 💾 数据持久化说明

- **Agent 决策日志**：每次运行的最终决策会追加在 `~/.tradingagents/memory/trading_memory.md`。
- **状态 Checkpoints**：基于 LangGraph 的崩溃断点续跑 SQLite 数据位于 `~/.tradingagents/cache/checkpoints/<TICKER>.db`。
- **Web 数据库**：Web Studio 的用户、持仓、定时任务及模拟交易记录等 SQLite 数据位于 `~/.tradingagents/web_state.db`。

---

## 🧰 技术栈

- **后端/核心**：Python 3.10+ · LangChain + LangGraph · FastAPI + WebSockets · SQLite · AKShare / Tushare / yfinance · Backtrader
- **前端 UI**：React + TypeScript + Vite · Kumo UI (`@cloudflare/kumo`) · Klinecharts
- **支持的模型 Provider**：OpenAI · Anthropic · Google Gemini · DeepSeek · 阿里通义千问 · 智谱 GLM · MiniMax · xAI Grok · OpenRouter · Ollama (本地部署)

---

## 🤝 参与贡献

1. 单元测试：执行 `pytest -m unit` (需配置 Python 环境)。
2. 若修改了 LangGraph 编排或公共 API Schema，请同步更新 `CHANGELOG.md` 的 `[Unreleased]` 章节。
3. 请遵循 Apache 2.0 开源协议相关条款。

---

## 上游致谢

本项目基于开源框架 **TradingAgents** (Tauric Research) 派生而来，在此向原作者表示感谢。
- 论文：*TradingAgents: Multi-Agents LLM Financial Trading Framework* [arXiv:2412.20138](https://arxiv.org/abs/2412.20138)
- 更多变更细节可查阅 [CHANGELOG.md](CHANGELOG.md)。

---

## 免责声明

TradingV 仅供研究、教育、个人学习与技术演示使用，不构成任何形式的投资或交易建议。
- Agent 输出的“买入/卖出”信号、目标价、止损价等，均为多智能体算法辩论的中间产物，不代表任何真实投资观点。
- 证券市场有风险，投资需谨慎。任何依据本项目输出做出的投资决策及其后果，均由使用者本人承担。
