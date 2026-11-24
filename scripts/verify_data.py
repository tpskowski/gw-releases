"""Validate the weekly release lists and their source URLs without network access."""
import argparse
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
TYPES = {"Model", "Boxed set", "Rulebook", "Fiction", "Accessory", "Magazine", "Other"}
REQUIRED = {"name", "system", "type", "faction"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def article_url(value):
    url = urlsplit(value)
    return url.scheme == "https" and url.hostname == "www.warhammer-community.com" and "/articles/" in url.path


def verify(write_manifest=False):
    queue = re.findall(r"^(\d{4}-\d\d-\d\d)\s+\[(https://[^\]]+)\]",
                       (ROOT / "source-list.txt").read_text(encoding="utf-8-sig"), re.M)
    files = [day + ".json" for day, _ in queue]
    require(files and files == sorted(set(files)), "Duplicate or unordered preview dates")
    require({p.name for p in DATA.iterdir()} == {"index.json", *files}, "Files differ from source queue")
    count = mto = 0
    for day, url in queue:
        date.fromisoformat(day)
        week = json.loads((DATA / (day + ".json")).read_bytes())
        require(set(week) == {"date", "url", "items"} and week["date"] == day
                and week["url"] == url and article_url(url), f"{day}: invalid weekly record")
        require(isinstance(week["items"], list), f"{day}: expected item list")
        names = set()
        for item in week["items"]:
            require(REQUIRED <= item.keys() <= REQUIRED | {"madeToOrder", "applicableSystems", "supplementalUrl"},
                    f"{day}: unexpected item fields")
            require(all(isinstance(item[k], str) and item[k].strip() == item[k] and item[k] for k in REQUIRED),
                    f"{day}: empty or invalid tag")
            require(item["type"] in TYPES and item["name"].casefold() not in names, f"{day}: invalid or duplicate item")
            names.add(item["name"].casefold())
            if "madeToOrder" in item:
                require(item["madeToOrder"] is True, f"{day}: expected confirmed Made to Order flag")
            if "supplementalUrl" in item:
                require(article_url(item["supplementalUrl"]), f"{day}: invalid supplemental URL")
            if "applicableSystems" in item:
                systems = item["applicableSystems"]
                require(isinstance(systems, list) and all(isinstance(s, str) and s.strip() for s in systems)
                        and len(systems) == len(set(systems)) and item["system"] in systems, f"{day}: invalid systems")
            count += 1
            mto += item.get("madeToOrder", False)
    manifest = DATA / "index.json"
    if write_manifest:
        manifest.write_text(json.dumps(files, indent=2) + "\n", encoding="utf-8")
    else:
        require(json.loads(manifest.read_bytes()) == files, "Index differs from source queue")
    print(f"{len(files)} weekly lists, {count} offerings, {mto} confirmed Made to Order")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-manifest", action="store_true")
    verify(parser.parse_args().write_manifest)
