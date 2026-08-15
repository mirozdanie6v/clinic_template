#!/usr/bin/env python3
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CLIENT = ROOT / "clients" / "evo"
OUT = CLIENT / "assets" / "visual"
TMP = pathlib.Path(tempfile.mkdtemp(prefix="evo-assets-"))

PALETTE = {
    "cream": "#F8F6F1",
    "olive": "#49600B",
    "deep": "#354707",
    "bronze": "#BC936C",
    "text": "#26271F",
}

CATEGORY_OUTPUTS = {
    "official-cosmetology-category": "service-cosmetology.webp",
    "official-hair-category": "service-hair.webp",
    "official-laser-category": "service-laser.webp",
    "official-manicure-category": "service-manicure.webp",
    "official-pedicure-category": "service-pedicure.webp",
    "official-podology-category": "service-podology.webp",
    "official-pmu-category": "service-pmu.webp",
    "official-brows-category": "service-brows-lashes.webp",
    "official-tattoo-category": "service-tattoo.webp",
    "official-tattoo-removal-category": "service-tattoo-removal.webp",
    "official-gift-category": "service-gift.webp",
}

PORTFOLIO_OUTPUTS = {
    "official-manicure-01": "manicure-01.webp",
    "official-manicure-02": "manicure-02.webp",
    "official-laser-01": "laser-01.webp",
    "official-cosmetology-01": "cosmetology-01.webp",
    "official-tattoo-removal-01": "tattoo-removal-01.webp",
}


def run(*args):
    subprocess.run([str(a) for a in args], check=True)


def download(url: str, name: str) -> pathlib.Path:
    suffix = pathlib.Path(urllib.parse.urlparse(url).path).suffix or ".img"
    target = TMP / f"{name}{suffix}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 EVO asset producer"})
    with urllib.request.urlopen(request, timeout=45) as response, open(target, "wb") as handle:
        shutil.copyfileobj(response, handle)
    return target


def convert_image(src: pathlib.Path, dest: pathlib.Path, width: int, height: int, saturation: int = 88, brightness: int = 103):
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(
        "convert", src,
        "-auto-orient",
        "-colorspace", "sRGB",
        "-resize", f"{width}x{height}^",
        "-gravity", "center",
        "-extent", f"{width}x{height}",
        "-modulate", f"{brightness},{saturation},100",
        "-contrast-stretch", "0x0.6%",
        "-strip",
        "-quality", "88",
        dest,
    )


def initials(name: str) -> str:
    parts = [part for part in name.replace("-", " ").split() if part]
    if not parts:
        return "EVO"
    value = "".join(part[0].upper() for part in parts[:2])
    return value or "EVO"


def placeholder(dest: pathlib.Path, name: str):
    dest.parent.mkdir(parents=True, exist_ok=True)
    label = initials(name)
    run(
        "convert",
        "-size", "1000x1250", f"xc:{PALETTE['cream']}",
        "-fill", PALETTE["olive"],
        "-font", "DejaVu-Sans",
        "-gravity", "center",
        "-pointsize", "118",
        "-annotate", "+0-30", label,
        "-fill", PALETTE["bronze"],
        "-pointsize", "32",
        "-annotate", "+0+105", "EVO BEAUTY SPACE",
        "-stroke", PALETTE["olive"],
        "-strokewidth", "3",
        "-fill", "none",
        "-draw", "roundrectangle 34,34 966,1216 42,42",
        "-strip",
        "-quality", "90",
        dest,
    )


def load_json(path: pathlib.Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    assets = load_json(CLIENT / "data-pack" / "assets.json")
    by_id = {item["id"]: item for item in assets.get("manifest", [])}
    produced = []

    hero = by_id["official-home-hero"]
    hero_src = download(hero["remoteUrl"], "hero")
    hero_out = OUT / "hero-master.webp"
    convert_image(hero_src, hero_out, 1600, 2000, saturation=86, brightness=104)
    produced.append({"id": "evo-hero-master", "role": "hero", "source": "official-home-hero", "path": str(hero_out.relative_to(ROOT)), "mode": "EDIT"})

    for asset_id, filename in CATEGORY_OUTPUTS.items():
        item = by_id[asset_id]
        src = download(item["remoteUrl"], asset_id)
        dest = OUT / filename
        convert_image(src, dest, 1200, 1500, saturation=84, brightness=104)
        produced.append({"id": f"cover-{asset_id}", "role": "service-family-cover", "source": asset_id, "path": str(dest.relative_to(ROOT)), "mode": "EDIT"})

    portfolio_dir = OUT / "portfolio"
    for asset_id, filename in PORTFOLIO_OUTPUTS.items():
        item = by_id[asset_id]
        src = download(item["remoteUrl"], asset_id)
        dest = portfolio_dir / filename
        convert_image(src, dest, 1200, 1200, saturation=90, brightness=102)
        produced.append({"id": f"portfolio-{asset_id}", "role": "portfolio", "source": asset_id, "path": str(dest.relative_to(ROOT)), "mode": "EDIT"})

    portraits_dir = OUT / "specialists"
    staff_count = 0
    placeholder_count = 0
    for branch in ("north", "center", "saigon"):
        staff_doc = load_json(CLIENT / "data" / branch / "staff.json")
        for person in staff_doc.get("staff", []):
            staff_count += 1
            dest = portraits_dir / f"{branch}-{person['id']}.webp"
            avatar = str(person.get("avatar") or "").strip()
            if not avatar or "no-master" in avatar:
                placeholder(dest, person.get("name") or "EVO")
                placeholder_count += 1
                mode = "PLACEHOLDER"
            else:
                try:
                    src = download(avatar, f"{branch}-{person['id']}")
                    convert_image(src, dest, 1000, 1250, saturation=88, brightness=103)
                    mode = "EDIT"
                except Exception as exc:
                    print(f"portrait download failed for {branch}/{person['id']}: {exc}; using branded placeholder")
                    placeholder(dest, person.get("name") or "EVO")
                    placeholder_count += 1
                    mode = "PLACEHOLDER"
            produced.append({"id": f"specialist-{branch}-{person['id']}", "role": "specialist-portrait", "source": avatar or None, "path": str(dest.relative_to(ROOT)), "mode": mode, "name": person.get("name")})

    manifest = {
        "version": 1,
        "artDirection": "EVO Quiet Premium",
        "generatedAt": os.environ.get("GITHUB_SHA", "local"),
        "policy": "Real EVO source imagery is preferred. Generated human identities and generated treatment outcomes are prohibited.",
        "counts": {
            "hero": 1,
            "serviceFamilyCovers": len(CATEGORY_OUTPUTS),
            "portfolio": len(PORTFOLIO_OUTPUTS),
            "specialistRecords": staff_count,
            "specialistPlaceholders": placeholder_count,
            "totalOutputs": len(produced),
        },
        "outputs": produced,
    }
    (OUT / "production-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest["counts"], ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    finally:
        shutil.rmtree(TMP, ignore_errors=True)
