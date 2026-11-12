import re
import time
import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import (MAX_PAGE_CHARS, MIN_PAGE_CHARS, MAX_SEARCH_ATTEMPTS, 
                    WEB_RESULTS, PAGES_TO_READ, MIN_PAGES, READ_MODE, 
                    MAX_CHARS_PER_PAGE, TOP_K)

def fetch_text(url):
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": "dns-rag-assistant/1.0"})
        r.raise_for_status()
    except Exception as e:
        print(f"Scartata: {url} ({e})")
        return ""
    
    content_type = r.headers.get("Content-Type", "").lower()
    if "html" in content_type:
        soup = BeautifulSoup(r.content, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form"]):
            tag.decompose()
        text = soup.get_text("\n")
    elif content_type.startswith("text/"):
        text = r.text
    else:
        return ""
        
    text = re.sub(r"\n{3,}", "\n\n", text).strip()[:MAX_PAGE_CHARS]
    return text if len(text) >= MIN_PAGE_CHARS else ""

def make_query(llm, full_query, failed_queries):
    prompt = (
        "Scrivi UNA query di ricerca web in inglese (massimo 10 parole) per trovare documentazione "
        "tecnica utile a rispondere alla richiesta seguente. Rispondi solo con la query.\n\n"
    )
    if failed_queries:
        prompt += ("Queste query NON hanno dato pagine utilizzabili: scrivine una DIVERSA, "
                   "con parole diverse e piu' generale: " + "; ".join(failed_queries) + "\n\n")
    prompt += "Richiesta: " + full_query
    query = (llm.invoke(prompt).content.strip().strip('"').splitlines() or [full_query])[0]
 
    if query in failed_queries:
        for alt in (full_query[:150], f"{query} documentation", f"{query} tutorial"):
            if alt not in failed_queries:
                return alt
    return query

def search_web(llm, embeddings, full_query):
    pages, failed_queries, seen_urls, last_results = [], [], set(), []
 
    for attempt in range(1, MAX_SEARCH_ATTEMPTS + 1):
        query = make_query(llm, full_query, failed_queries)
        failed_queries.append(query)
        print(f"Ricerca web (tentativo {attempt}): {query}")

        try:
            results = DDGS().text(query, region="us-en", max_results=WEB_RESULTS)
        except Exception:
            results = [] 
            
        if not results:
            print("Nessun risultato, provo con un'altra query")
            time.sleep(2)
            continue
            
        last_results = results

        for r in results:
            url = r.get("href", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            text = fetch_text(url)
            if text:
                pages.append((r, text))
            if len(pages) == PAGES_TO_READ:
                break

        if len(pages) >= MIN_PAGES:
            break
        print("Nessuna pagina leggibile, provo con un'altra query")
    
    print("Fonti web:", [r["href"] for r, _ in pages] or "nessuna pagina leggibile")

    if not last_results:
        return "Nessuna informazione utile trovata sul web per questa domanda."
    
    if not pages:
        return "\n\n".join(f"[Fonte: {r['title']} - {r['href']}]\n{r['body']}" for r in last_results[:PAGES_TO_READ])

    if READ_MODE == "page":
        return "\n\n".join(
            f"[Fonte: {r['title']} - {r['href']}]\n{text[:MAX_CHARS_PER_PAGE]}" for r, text in pages
        )

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = []
    for r, text in pages:
        chunks.extend(splitter.create_documents([text], metadatas=[{"title": r["title"], "url": r["href"]}]))
        
    store = InMemoryVectorStore.from_documents(chunks, embeddings)
    top = store.similarity_search(query, k=TOP_K)
    return "\n\n".join(f"[Fonte: {d.metadata['title']} - {d.metadata['url']}]\n{d.page_content}" for d in top)