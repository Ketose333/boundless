#!/usr/bin/env python3
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

PROJECT = os.getenv("VERCEL_PROJECT", "boundless")
TEAM_SLUG = os.getenv("VERCEL_TEAM_SLUG", "ketose333")  # 없으면 ""
TEAM_ID = os.getenv("VERCEL_TEAM_ID", "")


def get_token() -> str:
    token = os.getenv("VERCEL_TOKEN")
    if token:
        return token

    candidates = [
        pathlib.Path.home() / ".vercel" / "auth.json",
        pathlib.Path.home() / ".config" / "com.vercel.cli" / "auth.json",
        pathlib.Path.home() / ".local" / "share" / "com.vercel.cli" / "auth.json",
    ]

    for auth_path in candidates:
        if not auth_path.exists():
            continue
        try:
            data = json.loads(auth_path.read_text())
            tok = data.get("token") or data.get("accessToken") or ""
            if tok:
                return tok
        except Exception:
            pass

    return ""


def _with_query(path: str, query: dict | None = None) -> str:
    if not query:
        return path
    q = urllib.parse.urlencode({k: v for k, v in query.items() if v not in (None, "")})
    if not q:
        return path
    return f"{path}{'&' if '?' in path else '?'}{q}"


def api(token: str, path: str, method: str = "GET", query: dict | None = None):
    base = "https://api.vercel.com"
    url = base + _with_query(path, query)
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            body = e.read().decode()
            parsed = json.loads(body)
            detail = parsed.get("error", {}).get("message") or parsed.get("message") or body
        except Exception:
            detail = str(e)
        raise RuntimeError(f"HTTP {e.code} {e.reason}: {detail}") from e


def get_local_project_id() -> str:
    p = pathlib.Path(".vercel/project.json")
    if not p.exists():
        return ""
    try:
        j = json.loads(p.read_text())
        return str(j.get("projectId") or "").strip()
    except Exception:
        return ""


def resolve_team_id(token: str) -> str:
    if TEAM_ID:
        return TEAM_ID
    if not TEAM_SLUG:
        return ""

    # 1) direct slug lookup
    try:
        team = api(token, f"/v2/teams/{urllib.parse.quote(TEAM_SLUG)}")
        tid = str(team.get("id") or "").strip()
        if tid:
            return tid
    except Exception:
        pass

    # 2) fallback list lookup
    try:
        teams = api(token, "/v2/teams", query={"limit": 100}).get("teams", [])
        for t in teams:
            if t.get("slug") == TEAM_SLUG or t.get("name") == TEAM_SLUG:
                tid = str(t.get("id") or "").strip()
                if tid:
                    return tid
    except Exception:
        pass

    return ""


def main():
    token = get_token()
    if not token:
        print("ERROR: 토큰을 찾지 못함. `vercel login` 후 다시 실행하거나 VERCEL_TOKEN을 export 해줘.")
        print("hint: export VERCEL_TOKEN='<your_token>'")
        sys.exit(1)

    team_id = resolve_team_id(token)
    preferred_team_q = {"teamId": team_id} if team_id else None

    project_id = get_local_project_id()
    if not project_id:
        try:
            proj = api(token, f"/v9/projects/{urllib.parse.quote(PROJECT)}", query=preferred_team_q)
        except RuntimeError as e:
            if "403" in str(e) and preferred_team_q:
                print("WARN: teamId 권한 오류. teamId 없이 재시도함")
                proj = api(token, f"/v9/projects/{urllib.parse.quote(PROJECT)}", query=None)
                preferred_team_q = None
            else:
                raise
        project_id = proj["id"]

    # teamId/권한 꼬임이 잦아서 deployments 조회를 teamId 포함/미포함 순서로 모두 시도한다.
    query_candidates = []
    if preferred_team_q:
        query_candidates.append(preferred_team_q)
    query_candidates.append(None)

    deps = None
    active_team_q = None
    last_err = None

    for q in query_candidates:
        try:
            deps = api(
                token,
                "/v6/deployments",
                query={
                    "projectId": project_id,
                    "target": "production",
                    "limit": 100,
                    **(q or {}),
                },
            ).get("deployments", [])
            active_team_q = q
            break
        except RuntimeError as e:
            last_err = e
            continue

    if deps is None:
        raise RuntimeError(
            "deployments 조회 권한이 없어 진행할 수 없음. "
            "현재 VERCEL_TOKEN 계정이 이 프로젝트 접근 권한을 갖는지 확인해줘. "
            f"last_error={last_err}"
        )

    if not deps:
        print("production deployment 없음")
        return

    deps_sorted = sorted(deps, key=lambda d: d.get("createdAt", 0), reverse=True)
    keep = deps_sorted[0]
    delete_list = deps_sorted[1:]

    print(f"KEEP: {keep['uid']} ({keep.get('url')})")
    print(f"DELETE COUNT: {len(delete_list)}")

    for d in delete_list:
        uid = d["uid"]
        api(token, f"/v13/deployments/{uid}", method="DELETE", query=active_team_q)
        print("deleted:", uid)

    print("done")


if __name__ == "__main__":
    try:
      main()
    except Exception as e:
      print(f"ERROR: {e}")
      sys.exit(1)
