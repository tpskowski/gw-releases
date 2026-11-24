# GW Release Tracker

The explorer contains 1,830 offerings from 99 Sunday Previews from 5 January 2025 through 22 November 2026. Use the chart's grouping control and combine filters to answer questions such as "Which factions received rulebooks during January?"

## Data model and counting rules

The weekly archive is in `public/data/YYYY-MM-DD.json`. Each file lists the products announced in one preview, with its publication date and original URL. The manifest `index.json` lists the reviewed files the site loads.

| Record | Fields | Meaning |
| --- | --- | --- |
| Article | date, url, items | Publication date, source URL and list of offerings. |
| Offering | name, system, type, faction | One separately announced product within its parent article. The parent supplies its date and source link. |

A single unit kit counts as one model offering, regardless of miniature count. A multi-unit army box counts once as a boxed set. Rulebooks, fiction, accessories and magazines each have their own category. Paints, brushes and play aids count as accessories. Clothing and plush merchandise count as Other. A collector's edition listed separately counts separately. Ordinary print, ebook and audiobook formats of a title count together. Returning and Made to Order products count when offered. Exclude broadcast previews and items mentioned only as contents of another product.

Products explicitly shared between games can carry an additional applicableSystems list. Game-system charts count shared offerings once in each listed game. Overall totals and other groupings count each offering once. The Accessories game-system group covers system-neutral accessories. Game-specific accessories retain their game tag. Other also includes standalone games such as Hunt for the Arkenstone and Warhammer Quest: Darkwater. Use a single primary faction per offering. Use Various for cross-faction products and Unspecified when attribution is unclear. For fiction, use the setting for the system and an identifiable featured faction where available. Counts measure announcement activity. A later standalone offering of a unit from an earlier army box is another announcement. Retail availability and preorder dates would need separate sourced fields.

## Made to Order

The Order status filter and both chart grouping controls distinguish **Made to Order** from **Not identified as Made to Order**. Set `madeToOrder` to true when the source explicitly identifies the product as Made to Order. An omitted flag means the announcement did not establish that status. A limited order window or a Print on Demand edition alone does not qualify. [Made to Order list](made-to-order.csv).

## Checking and adding announcements

To look up an offering and its source:

```sh
python scripts/trace_offering.py "State Troops" --date 2025-01-12
```

For each new week, add its date and URL to `source-list.txt` in the existing format and create a dated JSON file under `public/data/`. Record product names and category tags. Use `supplementalUrl` when another announcement helps identify an offering. Keep article prose, screenshots and publisher artwork out of the workspace. A preview with no offerings has an empty list.

Run `python scripts/verify_data.py --write-manifest` to update the index. GitLab CI validates the weekly files before publishing.

## Local preview

From the repository root, run:

```sh
python -m http.server 4321 --bind 127.0.0.1 --directory public
```

Open [the local explorer](http://127.0.0.1:4321/). No package installation or build step is required.

## GitLab Pages

Push these files to the default branch of a GitLab project with Pages and CI runners enabled. The supplied pipeline publishes the static files in `public/`. Relative asset and data paths support project subdirectories. Open **Deploy > Pages** for the deployed URL and select public Pages access for anonymous visitors if access control is enabled. [GitLab Pages CI reference](https://docs.gitlab.com/ci/yaml/#pages)
