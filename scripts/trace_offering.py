"""Find tagged offerings and print their categories and source URLs without network access."""
import argparse
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"


def trace(term, on):
    matches = 0
    for filename in json.loads((DATA / "index.json").read_bytes()):
        post = json.loads((DATA / filename).read_bytes())
        if on and post["date"] != on:
            continue
        items = [i for i in post["items"] if term.casefold() in i["name"].casefold()]
        if not items:
            continue
        for item in items:
            matches += 1
            print(f"{post['date']} | {item['name']}")
            print(" | ".join(item[k] for k in ("system", "faction", "type")))
            if item.get("madeToOrder"):
                print("Made to Order")
            if item.get("applicableSystems"):
                print("Applicable systems: " + ", ".join(item["applicableSystems"]))
            print(post["url"])
            if item.get("supplementalUrl"):
                print(item["supplementalUrl"])
            print()
    if not matches:
        raise SystemExit("No offerings matched.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", help="case-insensitive product name or substring")
    parser.add_argument("--date", help="restrict results to one ISO preview date")
    args = parser.parse_args()
    trace(args.name, args.date)
