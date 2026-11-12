import json
from git import Repo
from langchain_core.documents import Document
from config import MY_REPO, REPO_URL

def clone_repo():
    if MY_REPO.exists():
        print(f"Repository già presente in {MY_REPO}")
        repo = Repo(MY_REPO)
        repo.remotes.origin.pull()
    else:
        print(f"Aggiungo {REPO_URL}")
        Repo.clone_from(REPO_URL, str(MY_REPO), depth=1)

def load_json():
    json_file = sorted(MY_REPO.glob("*.json"))
    print(f"Sono presenti {len(json_file)} file nella cartella {MY_REPO.name}")

    documents = []
    for path in json_file:
        text = path.read_text(encoding="utf-8")
        data = json.loads(text)
        documents.append(
            Document(
                page_content=text,
                metadata={
                    "source": path.name,
                    "provider_id": data.get("providerId", ""),
                    "provider_name": data.get("providerName", ""),
                    "service_id": data.get("serviceId", ""),
                    "service_name": data.get("serviceName", ""),
                    "description": data.get("description", "")
                }
            )
        )
    return documents