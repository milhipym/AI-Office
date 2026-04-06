#!/usr/bin/env python3
"""
AI Office Server Verification Script
- Starts the Flask server as a subprocess (no API key needed)
- Tests all API endpoints
- Reports pass/fail summary
"""

import json
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request

BASE_URL = "http://127.0.0.1:5000"
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
server_process = None

# Shared state between tests
shared = {}

# Results
results = []


def http_request(path, method="GET", body=None):
    """Send HTTP request, return (status_code, parsed_json_or_text)."""
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method=method)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(content)
            except json.JSONDecodeError:
                return resp.status, content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(content)
        except json.JSONDecodeError:
            return e.code, content


def record(name, passed, detail=""):
    results.append((name, passed, detail))
    status = "\033[92mPASS\033[0m" if passed else "\033[91mFAIL\033[0m"
    suffix = f" - {detail}" if detail and not passed else ""
    print(f"  [{status}] {name}{suffix}")


# ================================================================
# Server lifecycle
# ================================================================

def start_server():
    global server_process
    env = os.environ.copy()
    env["OPENAI_API_KEY"] = ""  # run without API key
    server_process = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=PROJECT_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Wait for server to be ready
    for i in range(15):
        time.sleep(1)
        try:
            status, _ = http_request("/api/status")
            if status == 200:
                return True
        except Exception:
            pass

    print("ERROR: Server did not start within 15 seconds")
    stop_server()
    return False


def stop_server():
    global server_process
    if server_process:
        server_process.terminate()
        try:
            server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_process.kill()
        server_process = None


# ================================================================
# Tests
# ================================================================

def test_dependencies():
    """Check that required packages can be imported."""
    missing = []
    for mod in ["flask", "openai", "dotenv"]:
        try:
            __import__(mod)
        except ImportError:
            missing.append(mod)
    record("dependencies_installed", len(missing) == 0,
           f"Missing: {missing}" if missing else "")


def test_server_status():
    """GET /api/status returns correct structure."""
    status, data = http_request("/api/status")
    ok = (status == 200
          and isinstance(data, dict)
          and "agent_count" in data
          and data["agent_count"] == 7
          and data["openai_configured"] is False)
    record("server_status", ok,
           f"status={status}, data={data}" if not ok else "")


def test_index_page():
    """GET / returns HTML page."""
    status, data = http_request("/")
    ok = status == 200 and isinstance(data, str) and "<html" in data.lower()
    record("index_page_loads", ok,
           f"status={status}" if not ok else "")


# -- Agents --

def test_get_agents():
    """GET /api/agents returns 7 agents without personality."""
    status, data = http_request("/api/agents")
    ok = (status == 200
          and isinstance(data, list)
          and len(data) == 7
          and all("id" in a and "name" in a and "role" in a for a in data)
          and all("personality" not in a for a in data))
    record("get_agents", ok,
           f"status={status}, count={len(data) if isinstance(data, list) else 'N/A'}" if not ok else "")


def test_get_agent_detail():
    """GET /api/agents/ceo_agent returns detail, with personality on ?edit=true."""
    status, data = http_request("/api/agents/ceo_agent")
    has_no_personality = "personality" not in data
    status2, data2 = http_request("/api/agents/ceo_agent?edit=true")
    has_personality = "personality" in data2
    ok = status == 200 and has_no_personality and status2 == 200 and has_personality
    record("get_agent_detail", ok,
           f"no_personality={has_no_personality}, with_edit={has_personality}" if not ok else "")


def test_get_agent_not_found():
    """GET /api/agents/nonexistent returns 404."""
    status, _ = http_request("/api/agents/nonexistent_xyz")
    record("get_agent_404", status == 404, f"status={status}")


def test_agent_crud():
    """POST/PUT/DELETE agent lifecycle."""
    # Create
    status, data = http_request("/api/agents", "POST", {
        "name": "TEST_AGENT",
        "role": "Tester",
        "team": "build",
    })
    ok_create = status == 201 and "id" in data
    agent_id = data.get("id", "")
    shared["test_agent_id"] = agent_id

    # Verify in list
    _, agents = http_request("/api/agents")
    ok_in_list = any(a["id"] == agent_id for a in agents)

    # Update
    status, data = http_request(f"/api/agents/{agent_id}", "PUT", {
        "name": "TEST_UPDATED"
    })
    ok_update = status == 200 and data.get("name") == "TEST_UPDATED"

    # Delete
    status, data = http_request(f"/api/agents/{agent_id}", "DELETE")
    ok_delete = status == 200 and data.get("success") is True

    # Verify deleted
    status, _ = http_request(f"/api/agents/{agent_id}")
    ok_gone = status == 404

    # Verify original agents intact
    _, agents = http_request("/api/agents")
    ok_count = len(agents) == 7

    ok = ok_create and ok_in_list and ok_update and ok_delete and ok_gone and ok_count
    detail = []
    if not ok_create: detail.append("create failed")
    if not ok_in_list: detail.append("not in list")
    if not ok_update: detail.append("update failed")
    if not ok_delete: detail.append("delete failed")
    if not ok_gone: detail.append("still exists after delete")
    if not ok_count: detail.append(f"agent count={len(agents)}, expected 7")
    record("agent_crud_lifecycle", ok, ", ".join(detail) if detail else "")


# -- Chat --

def test_get_chat():
    """GET /api/chat returns initial messages."""
    status, data = http_request("/api/chat")
    ok = (status == 200
          and isinstance(data, list)
          and len(data) >= 6
          and all("msg_id" in m and "agent" in m and "message" in m for m in data))
    record("get_chat", ok,
           f"status={status}, count={len(data) if isinstance(data, list) else 'N/A'}" if not ok else "")


def test_chat_polling():
    """GET /api/chat/new?after= works for polling."""
    # Get all
    status1, data1 = http_request("/api/chat/new?after=0")
    ok1 = status1 == 200 and isinstance(data1, list) and len(data1) >= 6

    # Get none (high after value)
    status2, data2 = http_request("/api/chat/new?after=999999")
    ok2 = status2 == 200 and isinstance(data2, list) and len(data2) == 0

    ok = ok1 and ok2
    record("chat_polling", ok,
           f"all={len(data1) if isinstance(data1, list) else '?'}, none={len(data2) if isinstance(data2, list) else '?'}" if not ok else "")


def test_send_chat():
    """POST /api/chat sends message and creates task."""
    status, data = http_request("/api/chat", "POST", {
        "message": "test verification message",
        "agent": "ceo_agent",
    })
    ok = (status == 200
          and isinstance(data, dict)
          and "user_message" in data
          and "ai_response" in data
          and "task" in data
          and "id" in data.get("task", {}))

    if ok:
        shared["task_id"] = data["task"]["id"]
        # Verify fallback ack (no API key)
        ack_msg = data["ai_response"].get("message", "")
        ok = ok and len(ack_msg) > 0

    record("send_chat", ok,
           f"status={status}, keys={list(data.keys()) if isinstance(data, dict) else 'N/A'}" if not ok else "")


def test_chat_history_updated():
    """After sending, chat history includes new messages."""
    status, data = http_request("/api/chat")
    has_user_cmd = any(m.get("type") == "command" and "test verification" in m.get("message", "") for m in data)
    has_ack = any(m.get("agent") == "ceo_agent" and m.get("type") == "report" for m in data)
    ok = status == 200 and has_user_cmd and has_ack
    record("chat_history_updated", ok,
           f"user_cmd={has_user_cmd}, ack={has_ack}" if not ok else "")


# -- Tasks --

def test_get_tasks():
    """GET /api/tasks returns task list."""
    status, data = http_request("/api/tasks")
    ok = status == 200 and isinstance(data, list) and len(data) >= 1
    record("get_tasks", ok,
           f"status={status}, count={len(data) if isinstance(data, list) else 'N/A'}" if not ok else "")


def test_get_task_detail():
    """GET /api/tasks/<id> returns task structure."""
    task_id = shared.get("task_id", "nonexistent")
    status, data = http_request(f"/api/tasks/{task_id}")
    ok = (status == 200
          and isinstance(data, dict)
          and data.get("id") == task_id
          and "stages" in data
          and isinstance(data.get("stages"), list)
          and len(data["stages"]) == 3
          and data.get("total_stages") == 3
          and data.get("agent_id") == "ceo_agent")
    record("get_task_detail", ok,
           f"status={status}, id={data.get('id', '?')}" if not ok else "")


def test_get_task_not_found():
    """GET /api/tasks/nonexistent returns 404."""
    status, _ = http_request("/api/tasks/nonexistent_xyz")
    record("get_task_404", status == 404, f"status={status}")


# -- Rooms / Furniture / Layout --

def test_get_rooms():
    """GET /api/rooms returns room definitions."""
    status, data = http_request("/api/rooms")
    expected_rooms = {"main_office", "meeting_room", "content_room", "dev_room"}
    ok = (status == 200
          and isinstance(data, dict)
          and expected_rooms.issubset(set(data.keys()))
          and all("name" in r and "x" in r and "y" in r for r in data.values()))
    record("get_rooms", ok,
           f"status={status}, keys={list(data.keys()) if isinstance(data, dict) else 'N/A'}" if not ok else "")


def test_get_furniture():
    """GET /api/furniture returns furniture list."""
    status, data = http_request("/api/furniture")
    ok = (status == 200
          and isinstance(data, list)
          and len(data) == 14
          and all("id" in f and "name" in f and "category" in f for f in data))
    record("get_furniture", ok,
           f"status={status}, count={len(data) if isinstance(data, list) else 'N/A'}" if not ok else "")


def test_get_layout():
    """GET /api/layout returns layout structure."""
    status, data = http_request("/api/layout")
    ok = (status == 200
          and isinstance(data, dict)
          and "layout" in data
          and "placed" in data
          and isinstance(data["layout"], list)
          and len(data["layout"]) == 10
          and isinstance(data["placed"], dict)
          and len(data["placed"]) > 0)
    record("get_layout", ok,
           f"status={status}" if not ok else "")


def test_save_layout():
    """POST /api/layout saves and persists changes."""
    # Save with a new furniture placement
    new_placed = {"99,99": "plant"}
    status, data = http_request("/api/layout", "POST", {"placed": new_placed})
    ok_save = status == 200 and data.get("success") is True

    # Verify it persisted
    status2, data2 = http_request("/api/layout")
    ok_read = (status2 == 200
               and data2.get("placed", {}).get("99,99") == "plant")

    # Restore original (send back without the test key won't work, but that's fine for testing)
    ok = ok_save and ok_read
    record("save_layout", ok,
           f"save_status={status}, read_back={'99,99' in data2.get('placed', {})}" if not ok else "")


# -- Model Servers --

def test_get_model_servers():
    """GET /api/model-servers returns default server with masked key."""
    status, data = http_request("/api/model-servers")
    ok = (status == 200
          and isinstance(data, dict)
          and "default" in data
          and data["default"].get("api_key") == ""
          and "api_key_masked" in data["default"])
    record("get_model_servers", ok,
           f"status={status}" if not ok else "")


def test_model_server_crud():
    """POST/PUT/DELETE model server lifecycle."""
    # Create
    status, data = http_request("/api/model-servers", "POST", {
        "id": "test_srv",
        "name": "Test Server",
        "type": "custom",
        "api_base": "http://localhost:11434/v1",
        "api_key": "test-key-12345",
        "models": "model-a,model-b",
    })
    ok_create = status == 200 and data.get("success") is True

    # Verify exists
    _, servers = http_request("/api/model-servers")
    ok_exists = "test_srv" in servers

    # Update
    status, data = http_request("/api/model-servers/test_srv", "PUT", {
        "name": "Updated Server",
    })
    ok_update = status == 200 and data.get("success") is True

    # Delete
    status, data = http_request("/api/model-servers/test_srv", "DELETE")
    ok_delete = status == 200 and data.get("success") is True

    # Verify gone
    _, servers = http_request("/api/model-servers")
    ok_gone = "test_srv" not in servers

    ok = ok_create and ok_exists and ok_update and ok_delete and ok_gone
    detail = []
    if not ok_create: detail.append("create failed")
    if not ok_exists: detail.append("not found after create")
    if not ok_update: detail.append("update failed")
    if not ok_delete: detail.append("delete failed")
    if not ok_gone: detail.append("still exists after delete")
    record("model_server_crud", ok, ", ".join(detail) if detail else "")


def test_delete_default_server():
    """DELETE /api/model-servers/default should be blocked."""
    status, data = http_request("/api/model-servers/default", "DELETE")
    ok = status == 400 and "error" in data
    record("delete_default_server_blocked", ok, f"status={status}")


def test_test_server_not_found():
    """POST /api/model-servers/nonexistent/test returns 404."""
    status, data = http_request("/api/model-servers/nonexistent_xyz/test", "POST")
    ok = status == 404
    record("test_server_not_found", ok, f"status={status}")


# -- Org Chart --

def test_org_chart():
    """GET /api/org returns organization chart."""
    status, data = http_request("/api/org")
    ok = (status == 200
          and isinstance(data, dict)
          and "ceo" in data
          and "direct" in data
          and "teams" in data
          and "level_names" in data
          and isinstance(data["direct"], list)
          and len(data["direct"]) == 2  # ceo_agent, cto_agent (level 2)
          and isinstance(data["teams"], list)
          and len(data["teams"]) >= 3)  # build, content, academy
    record("org_chart", ok,
           f"status={status}, direct={len(data.get('direct', []))}, teams={len(data.get('teams', []))}" if not ok else "")


# ================================================================
# Main
# ================================================================

def main():
    print("\n" + "=" * 56)
    print("  AI Office Server Verification")
    print("=" * 56 + "\n")

    # Phase 1: Dependencies
    print("[1/4] Checking dependencies...")
    test_dependencies()

    # Phase 2: Start server
    print("\n[2/4] Starting server...")
    if not start_server():
        record("server_start", False, "Server failed to start")
        print_summary()
        return 1

    record("server_start", True)

    try:
        # Phase 3: Run all tests
        print("\n[3/4] Running API tests...")
        print("  --- Status & Page ---")
        test_server_status()
        test_index_page()

        print("  --- Agents ---")
        test_get_agents()
        test_get_agent_detail()
        test_get_agent_not_found()
        test_agent_crud()

        print("  --- Chat ---")
        test_get_chat()
        test_chat_polling()
        test_send_chat()
        test_chat_history_updated()

        print("  --- Tasks ---")
        test_get_tasks()
        test_get_task_detail()
        test_get_task_not_found()

        print("  --- Rooms / Furniture / Layout ---")
        test_get_rooms()
        test_get_furniture()
        test_get_layout()
        test_save_layout()

        print("  --- Model Servers ---")
        test_get_model_servers()
        test_model_server_crud()
        test_delete_default_server()
        test_test_server_not_found()

        print("  --- Organization ---")
        test_org_chart()

    finally:
        # Phase 4: Cleanup
        print("\n[4/4] Stopping server...")
        stop_server()

    return print_summary()


def print_summary():
    passed = sum(1 for _, p, _ in results if p)
    failed = sum(1 for _, p, _ in results if not p)
    total = len(results)

    print("\n" + "=" * 56)
    print(f"  Results: {passed}/{total} passed", end="")
    if failed:
        print(f", \033[91m{failed} failed\033[0m")
    else:
        print(f" \033[92m(all passed!)\033[0m")
    print("=" * 56 + "\n")

    if failed:
        print("  Failed tests:")
        for name, p, detail in results:
            if not p:
                print(f"    - {name}: {detail}")
        print()

    return 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        stop_server()
        sys.exit(1)
