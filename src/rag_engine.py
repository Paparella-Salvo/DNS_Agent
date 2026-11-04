import shutil
import re
import time
from pathlib import Path
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings, ChatOllama
from config import CHROMA_DIR, BATCH_SIZE, NUM_CTX, SYSTEM_PROMPT
from repo_manager import clone_repo, load_json
from web_search import search_web
from zone_check import trova_zona_corrente, controlla_e_correggi

def build_knowledge_base():
    clone_repo()
    json_documents = load_json()

    embeddings = OllamaEmbeddings(model="nomic-embed-text")

    if CHROMA_DIR.exists():
        shutil.rmtree(CHROMA_DIR)

    json_vector_store = Chroma(
        collection_name="dns_templates",
        embedding_function=embeddings,
        persist_directory=str(CHROMA_DIR)
    )
    
    for i in range(0, len(json_documents), BATCH_SIZE):
        json_vector_store.add_documents(json_documents[i:i + BATCH_SIZE])

    return json_vector_store, embeddings, json_documents

def _parola_intera_in_query(parola, query_lower):
    return re.search(r"\b" + re.escape(parola) + r"\b", query_lower) is not None

def provider_brand(provider_id):
    labels = provider_id.lower().split(".")
    if len(labels) == 1:
        return labels[0]
    labels = labels[:-1]
    while len(labels) > 1 and labels[-1] in {"co", "com", "org", "net", "gov", "edu", "ac"}:
        labels.pop()
    return labels[-1]

def find_matching_source(query, documents):
    query = query.lower()
    provider = {}

    for doc in documents:
        provider_id = doc.metadata.get("provider_id", "")
        if provider_id not in provider:
            provider[provider_id] = []
        provider[provider_id].append(doc)

    match = []
    for provider_id, docs in provider.items():
        name = docs[0].metadata.get("provider_name", "").lower()
        corrispondenza = False

        for candidato in (name, provider_brand(provider_id), provider_id.lower()):
            if _parola_intera_in_query(candidato, query):
                corrispondenza = True
                break

        if corrispondenza:
            match.extend(d.metadata["source"] for d in docs)

    return match

def ask(user_messages, history, json_vector_store, embeddings, model_name, json_documents):
    full_query = " ".join(user_messages)
    sources = find_matching_source(full_query, json_documents)
    
    if not sources:
        return "Nessun provider corrispondente", []

    template_docs = json_vector_store.similarity_search(
        full_query,
        k=len(sources),
        filter={"source": {"$in": sources}}
    )
    template_context = "\n\n".join(doc.page_content for doc in template_docs)

    llm = ChatOllama(model=model_name, temperature=0, num_ctx=NUM_CTX)
    web_context = search_web(llm, embeddings, full_query)

    messages = [
        ("system", SYSTEM_PROMPT + f"\n\nTEMPLATE JSON:\n{template_context}\n\nINFORMAZIONI DAL WEB:\n{web_context}"),
        *history,
    ]

    start_time = time.time()    
    answer = llm.invoke(messages).content
    answer, esito = controlla_e_correggi(answer, trova_zona_corrente(history))
    end_time = time.time()
    
    print(f"Tempo risposta agente: {end_time - start_time:.2f} secondi")
    return answer, template_docs