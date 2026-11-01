"""Train and save the course recommendation TF-IDF index."""
from __future__ import annotations

import re
import pickle
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

ROOT = Path(__file__).resolve().parents[1]
DATASETS = ROOT / "app" / "datasets"
ARTIFACT = ROOT / "model_artifacts" / "course_recommender.pkl"


def main() -> None:
    courses = pd.read_csv(DATASETS / "courses.csv", dtype=str, keep_default_na=False)
    skills = pd.read_csv(DATASETS / "skills.csv", dtype=str, keep_default_na=False)
    skill_names = dict(zip(skills["skill_id"], skills["skill_name"]))

    rows = []
    for _, course in courses.iterrows():
        skill_ids = [value.strip() for value in course["skills"].split("|") if value.strip()]
        skill_text = " ".join(skill_names.get(skill_id, skill_id).replace("-", " ") for skill_id in skill_ids)
        text = " ".join(filter(None, [
            course["title"], course["description"], skill_text, course["category"],
            course["platform"], course["difficulty"], course["learning_type"],
        ]))
        rows.append({
            "course_id": course["course_id"],
            "text": re.sub(r"\s+", " ", text.lower()),
        })

    frame = pd.DataFrame(rows).sort_values("course_id").reset_index(drop=True)
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2), stop_words="english", max_features=4000, sublinear_tf=True,
    )
    matrix = vectorizer.fit_transform(frame["text"])

    ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    with ARTIFACT.open("wb") as artifact_file:
        pickle.dump({
        "version": 1,
        "course_ids": frame["course_id"].tolist(),
        "texts": frame["text"].tolist(),
        "vectorizer": vectorizer,
        "matrix": matrix,
        }, artifact_file, protocol=pickle.HIGHEST_PROTOCOL)
    print(f"Saved TF-IDF index for {len(frame)} courses to {ARTIFACT}")


if __name__ == "__main__":
    main()