#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 docx 解析出的命令批量写入云端 eo_命令库。

用法：
  python add_commands_to_cloud.py --limit 1     # 只写前 1 条（格式验证）
  python add_commands_to_cloud.py               # 写全部
"""
import argparse
import json
import os
import sys
import time

SKILL = r"D:/Program Files/WorkBuddy/resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/library"
if SKILL not in sys.path:
    sys.path.insert(0, SKILL)
from _common import http_request, unwrap_data  # noqa: E402

DB = "1XvgqzwVPDu9wSbijefuee"
API = "/space/api/agent/v1/batch-add-records"
HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "added_state.json")
TODAY = "2026-10-23"


def build(rows):
    out = []
    for r in rows:
        out.append({
            "日期": {"date": TODAY},
            "设备类型": {"select": r["section"]},
            "标题": {"text": r["title"]},
            "命令内容": {"text": r["content"]},
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--batch", type=int, default=8)
    args = ap.parse_args()

    rows = json.load(open(os.path.join(HERE, "records.json"), encoding="utf-8"))
    done = []
    if os.path.exists(STATE):
        done = json.load(open(STATE, encoding="utf-8")).get("done", [])
    todo = [r for r in rows if (r["section"], r["num"]) not in [tuple(d) for d in done]]
    if args.limit:
        todo = todo[:args.limit]

    print("待写入 %d 条（已完成 %d 条）" % (len(todo), len(done)))
    ok = 0
    for i in range(0, len(todo), args.batch):
        chunk = todo[i:i + args.batch]
        body = {"databaseId": DB, "records": build(chunk)}
        for attempt in range(3):
            try:
                res = unwrap_data(http_request("POST", API, body=body))
                ids = res.get("recordIds") or res.get("ids") or res
                print("  批次 %d 成功: %s" % (i // args.batch + 1, str(ids)[:120]))
                for r in chunk:
                    done.append([r["section"], r["num"]])
                ok += len(chunk)
                break
            except Exception as e:
                print("  批次 %d 失败(第%d次): %s" % (i // args.batch + 1, attempt + 1, e))
                time.sleep(2)
        else:
            print("  批次 %d 放弃，已写入 %d 条" % (i // args.batch + 1, ok))
            break
        json.dump({"done": done}, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    json.dump({"done": done}, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("本次成功写入 %d 条，累计 %d/%d" % (ok, len(done), len(rows)))


if __name__ == "__main__":
    main()
