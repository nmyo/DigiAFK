#!/usr/bin/env python3
"""通过 Vercel REST API 部署 DigiAFK（不需要安装 Vercel CLI）。

流程与官方 API 一致：
  1. POST /v2/files          逐个上传文件，用 SHA1 作为 x-vercel-digest
  2. POST /v13/deployments   用 sha + size 引用这些文件创建部署
  3. GET  /v13/deployments/<id>  轮询直到 READY / ERROR

用法：
  export VERCEL_TOKEN=xxxxxxxx            # https://vercel.com/account/tokens
  python3 scripts/deploy_vercel.py --prod
  python3 scripts/deploy_vercel.py --prod --project digiafk --team team_xxx
  python3 scripts/deploy_vercel.py --dry-run        # 只列出将要上传的文件

只依赖 Python 3 标准库。
"""

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = os.environ.get("VERCEL_API_BASE", "https://api.vercel.com").rstrip("/")
ROOT = Path(__file__).resolve().parent.parent
# 只上传部署实际需要的文件：vercel.json + site/ 整个目录。
INCLUDE_FILES = ["vercel.json"]
INCLUDE_DIRS = ["site"]
EXCLUDE_DIRS = {"node_modules", ".git", ".vercel", "__pycache__"}


def collect_files():
    files = []
    for name in INCLUDE_FILES:
        path = ROOT / name
        if path.is_file():
            files.append(path)
    for name in INCLUDE_DIRS:
        base = ROOT / name
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            rel_parts = path.relative_to(ROOT).parts
            if any(part in EXCLUDE_DIRS for part in rel_parts):
                continue
            files.append(path)
    return files


def call(method, path, token, team=None, body=None, headers=None, retries=3):
    url = API + path
    if team:
        url += ("&" if "?" in url else "?") + "teamId=" + team
    hdrs = {"Authorization": "Bearer " + token}
    if headers:
        hdrs.update(headers)
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read()
                return json.loads(raw) if raw.strip() else {}
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", "replace")[:500]
            last = "HTTP %s %s" % (err.code, detail)
            # 429 限流与 5xx 重试，其余直接失败（401/403 重试没有意义）
            if err.code == 429 or err.code >= 500:
                time.sleep(2 * (attempt + 1))
                continue
            raise SystemExit("请求失败：%s %s\n%s" % (method, path, last))
        except urllib.error.URLError as err:
            last = str(err)
            time.sleep(2 * (attempt + 1))
    raise SystemExit("请求失败：%s %s\n%s" % (method, path, last))


def main():
    parser = argparse.ArgumentParser(description="通过 Vercel API 部署 DigiAFK")
    parser.add_argument("--token", default=None, help="Vercel 访问令牌，默认读 VERCEL_TOKEN")
    parser.add_argument("--project", default="digiafk", help="Vercel 项目名（默认 digiafk）")
    parser.add_argument("--team", default=None, help="团队 ID 或 slug，个人账号留空")
    parser.add_argument("--prod", action="store_true", help="部署到正式环境（默认预览）")
    parser.add_argument("--dry-run", action="store_true", help="只列出文件，不发请求")
    args = parser.parse_args()

    files = collect_files()
    if not files:
        raise SystemExit("没有找到可部署的文件，请在项目根目录运行。")

    total = sum(p.stat().st_size for p in files)
    print("待部署 %d 个文件，共 %.1f KB" % (len(files), total / 1024))
    if args.dry_run:
        for path in files:
            print("  %-52s %8.1f KB" % (path.relative_to(ROOT), path.stat().st_size / 1024))
        return

    token = args.token or os.environ.get("VERCEL_TOKEN")
    if not token:
        raise SystemExit("缺少令牌：请设置 VERCEL_TOKEN 或传 --token（https://vercel.com/account/tokens）")

    manifest = []
    for index, path in enumerate(files, 1):
        blob = path.read_bytes()
        digest = hashlib.sha1(blob).hexdigest()
        call(
            "POST",
            "/v2/files",
            token,
            team=args.team,
            body=blob,
            headers={
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(blob)),
                "x-vercel-digest": digest,
            },
        )
        manifest.append(
            {
                "file": path.relative_to(ROOT).as_posix(),
                "sha": digest,
                "size": len(blob),
            }
        )
        print("  [%d/%d] %s" % (index, len(files), path.relative_to(ROOT)))

    payload = {
        "name": args.project,
        "files": manifest,
        # 首次部署必须给 projectSettings；之后会沿用项目设置。
        "projectSettings": {
            "framework": None,
            "buildCommand": None,
            "installCommand": None,
            "outputDirectory": "site",
        },
    }
    if args.prod:
        payload["target"] = "production"

    print("创建部署（%s）…" % ("production" if args.prod else "preview"))
    deployment = call(
        "POST",
        "/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1",
        token,
        team=args.team,
        body=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    dep_id = deployment.get("id")
    url = deployment.get("url") or ""
    print("部署 ID：%s" % dep_id)
    print("预览地址：https://%s" % url)

    deadline = time.time() + 600
    state = deployment.get("readyState", "QUEUED")
    while state not in ("READY", "ERROR", "CANCELED") and time.time() < deadline:
        time.sleep(3)
        info = call("GET", "/v13/deployments/" + dep_id, token, team=args.team)
        state = info.get("readyState", state)
        print("  状态：%s" % state)
        if state == "ERROR":
            raise SystemExit("部署失败：%s" % (info.get("errorMessage") or "见 Vercel 控制台日志"))

    if state != "READY":
        raise SystemExit("部署未在 10 分钟内完成，当前状态：%s" % state)
    print("\n部署完成：https://%s" % url)
    if args.prod:
        print("正式域名：https://%s.vercel.app" % args.project)


if __name__ == "__main__":
    sys.exit(main())
