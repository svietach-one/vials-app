#!/usr/bin/env python3
"""Cosmetics product scraper for Ziaja, Belita, and Bielenda.

Collects product title, INCI ingredient list, and EAN-13 barcode from a
list of product URLs, using Playwright (async) for JS-rendered/tabbed
content and BeautifulSoup for parsing. Results are saved to an .xlsx file.
"""

import argparse
import asyncio
import logging
import re
import sys
from dataclasses import dataclass
from typing import List, Optional
from urllib.parse import urlparse

import pandas as pd
from bs4 import BeautifulSoup
from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError, async_playwright

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cosmetics_scraper")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 CosmeticsResearchBot/1.0"
)

# Ziaja embeds the EAN-13 directly in the URL path, e.g. /p/5901887005391/...
BARCODE_URL_RE = re.compile(r"/(\d{13})(?:/|$)")
# Belita / Bielenda expose it as a labeled field: "Ean 5902169039714", "Штрих-код: 4810151038526"
BARCODE_LABEL_RE = re.compile(
    r"(?:EAN|Ean|Kod\s*kreskowy|Barcode|Штрих-?\s*код)\s*[:\-]?\s*(\d{12,13})",
    re.IGNORECASE,
)
BARCODE_STANDALONE_RE = re.compile(r"\b(\d{13})\b")

# Tab/accordion controls and headings that reveal or label the ingredient list.
INGREDIENT_TAB_RE = re.compile(r"sk[łl]ad|inci|ingredients|composition|состав|компонент", re.IGNORECASE)
# INCI lists conventionally open with "Aqua" / "Aqua (Water)" / "Aqua/Water".
INGREDIENT_START_RE = re.compile(r"^\s*aqua\b", re.IGNORECASE)
# Some Belita pages only link out to a separate composition page ("Узнать состав").
COMPOSITION_LINK_RE = re.compile(r"узнать состав|sk[łl]ad|composition|ingredients", re.IGNORECASE)


@dataclass
class ProductResult:
    url: str
    site: str = ""
    title: str = ""
    barcode: str = ""
    ingredients: str = ""
    status: str = "OK"
    error: str = ""


def detect_site(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if "ziaja" in host:
        return "ziaja"
    if "belita" in host:
        return "belita"
    if "bielenda" in host:
        return "bielenda"
    return "unknown"


def extract_barcode_from_url(url: str) -> Optional[str]:
    match = BARCODE_URL_RE.search(urlparse(url).path)
    return match.group(1) if match else None


def extract_barcode_from_text(text: str) -> Optional[str]:
    match = BARCODE_LABEL_RE.search(text)
    if match:
        return match.group(1)
    match = BARCODE_STANDALONE_RE.search(text)
    return match.group(1) if match else None


def extract_title(soup: BeautifulSoup) -> str:
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)
    if soup.title:
        return soup.title.get_text(strip=True)
    return ""


def _candidate_ingredient_blocks(soup: BeautifulSoup):
    for tag in soup.find_all(["p", "div", "li", "span", "td", "dd"]):
        text = tag.get_text(" ", strip=True)
        if not text:
            continue
        if INGREDIENT_START_RE.search(text) or (text.count(",") >= 8 and "aqua" in text.lower()):
            yield text


def extract_ingredients_from_soup(soup: BeautifulSoup) -> str:
    # Prefer the longest block that looks like a full INCI list (most complete match).
    candidates = list(_candidate_ingredient_blocks(soup))
    if candidates:
        return max(candidates, key=len)

    # Fallback: a heading labeled "Skład"/"INCI"/"Состав" followed by the list text.
    for heading in soup.find_all(["h2", "h3", "h4", "strong", "dt", "b"]):
        if INGREDIENT_TAB_RE.search(heading.get_text(strip=True)):
            sibling = heading.find_next_sibling()
            if sibling:
                text = sibling.get_text(" ", strip=True)
                if text:
                    return text
    return ""


def find_composition_link(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    for a in soup.find_all("a", href=True):
        if COMPOSITION_LINK_RE.search(a.get_text(strip=True)):
            href = a["href"]
            if href.startswith("http"):
                return href
            parsed = urlparse(base_url)
            return f"{parsed.scheme}://{parsed.netloc}{href}"
    return None


async def _try_reveal_ingredient_tab(page: Page) -> None:
    """Click a tab/accordion control that likely reveals the INCI list, if present."""
    try:
        locator = page.get_by_text(INGREDIENT_TAB_RE)
        count = await locator.count()
        for i in range(min(count, 5)):
            candidate = locator.nth(i)
            if await candidate.is_visible():
                await candidate.click(timeout=2000)
                await page.wait_for_timeout(500)
                break
    except Exception:
        # No matching tab, or it's already expanded — not fatal.
        pass


async def scrape_product(page: Page, url: str) -> ProductResult:
    result = ProductResult(url=url, site=detect_site(url))
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_load_state("networkidle", timeout=8000)
        except PlaywrightTimeoutError:
            pass

        await _try_reveal_ingredient_tab(page)

        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")

        result.title = extract_title(soup)
        result.barcode = extract_barcode_from_url(url) or extract_barcode_from_text(html) or ""
        result.ingredients = extract_ingredients_from_soup(soup)

        if not result.ingredients:
            comp_link = find_composition_link(soup, url)
            if comp_link and comp_link != url:
                await page.goto(comp_link, wait_until="domcontentloaded", timeout=30000)
                await _try_reveal_ingredient_tab(page)
                sub_html = await page.content()
                sub_soup = BeautifulSoup(sub_html, "html.parser")
                result.ingredients = extract_ingredients_from_soup(sub_soup)
                if not result.barcode:
                    result.barcode = extract_barcode_from_text(sub_html) or ""

        if not result.title or not result.ingredients or not result.barcode:
            result.status = "PARTIAL"
    except Exception as exc:  # noqa: BLE001 - record any per-URL failure without aborting the batch
        result.status = "ERROR"
        result.error = f"{type(exc).__name__}: {exc}"
        logger.error("Failed to scrape %s: %s", url, result.error)
    return result


async def worker(sem: asyncio.Semaphore, browser, url: str) -> ProductResult:
    async with sem:
        context = await browser.new_context(user_agent=USER_AGENT, locale="en-US")
        page = await context.new_page()
        try:
            result = await scrape_product(page, url)
        finally:
            await context.close()
        logger.info("Done: %s -> status=%s", url, result.status)
        return result


async def scrape_all(urls: List[str], concurrency: int) -> List[ProductResult]:
    sem = asyncio.Semaphore(concurrency)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            tasks = [worker(sem, browser, url) for url in urls]
            return await asyncio.gather(*tasks)
        finally:
            await browser.close()


def load_urls(path: str) -> List[str]:
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


def save_to_excel(results: List[ProductResult], output_path: str) -> None:
    df = pd.DataFrame([r.__dict__ for r in results])
    df = df[["url", "site", "title", "barcode", "ingredients", "status", "error"]]
    df.to_excel(output_path, index=False, engine="openpyxl")
    logger.info("Saved %d rows to %s", len(df), output_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape cosmetics product data into Excel.")
    parser.add_argument("--input", "-i", default="urls.txt", help="Text file with one product URL per line.")
    parser.add_argument("--output", "-o", default="products.xlsx", help="Path to the output .xlsx file.")
    parser.add_argument("--concurrency", "-c", type=int, default=4, help="Max concurrent browser pages.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    urls = load_urls(args.input)
    if not urls:
        logger.error("No URLs found in %s", args.input)
        sys.exit(1)

    logger.info("Scraping %d URLs with concurrency=%d", len(urls), args.concurrency)
    results = asyncio.run(scrape_all(urls, args.concurrency))
    save_to_excel(results, args.output)


if __name__ == "__main__":
    main()
