📘 Regulation Parser & AI-Powered Control Mapping
A Practical GRC Engineering Tool for Automating Compliance Analysis

This project extracts regulatory text (PDF/TXT), splits it into clauses, tags requirements using keyword dictionaries, and then maps them to security frameworks (ISO 27001, NIST CSF, SOC 2) using keyword matching + semantic embeddings + cosine similarity.

It demonstrates real-world GRC automation, NLP processing, and control mapping workflows often seen in enterprise compliance operations.

🔥 Features
✔ 1. File Upload & Storage (Multer + SQLite)

Upload PDF/text regulations and store metadata:

Name

Path

Upload date

✔ 2. Automated Clause Extraction

Splits regulation text using patterns:
Article X
Section Y
Clause Z

Each clause becomes a requirement with status pending_analysis.

✔ 3. Keyword-Based Tagging

Each requirement is compared against a set of tags (e.g., access control, encryption, logging).
Matched requirements are marked as tagged and recorded in requirement_tags.

✔ 4. Keyword Control Mapping

Each tagged requirement is matched to controls in:

ISO 27001 Annex A

NIST CSF

SOC 2 Trust Principles

Mapping is stored in requirement_controls.

✔ 5. AI-Powered Semantic Mapping (OpenAI)

Each requirement and control is embedded using OpenAI embeddings and compared using cosine similarity.

The system enriches mappings by updating:
similarity_score = <cosine value>
source = 'hybrid'

Only strong matches (≥ 0.6) are recommended as final mappings.

POST /upload
POST api/parse/:regulationId
POST api/tag/:regulationId
POST api/map-controls/:regulationId
POST api/semantic-map/:regulationId
GET  api/semantic-results/:regulationId

Regulation Upload → Clause Extraction → Tagging → Control Mapping → Semantic Scoring

Regulation Upload → Clause Extraction → Tagging → Control Mapping → Semantic Scoring

Technologies:

Node.js + Express

SQLite (better-sqlite3)

OpenAI Embeddings

Cosine Similarity NLP

Multer (file uploads)

{
  requirement_id: 12,
  requirement_text: "The organization shall restrict privileged access...",
  tag_name: "Access Control",
  framework: "ISO 27001",
  control_code: "A.9.2.3",
  similarity_score: 0.84,
  source: "hybrid"
}


npm install
npm start

OPENAI_API_KEY=your_key


🏁 Status

✔ MVP complete
✔ Semantic mapping working
✔ Ready for UI build / dashboard (Phase 2)


📣 Author

Ademoyero Adefusika Vincent
Governance, Risk & Compliance Engineering
LinkedIn: www.linkedin.com/in/ademoyero-adefusika-a08a30301