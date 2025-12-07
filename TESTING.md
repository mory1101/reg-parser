# 🧪 Testing Guide – Regulation Parser & Control Mapper

This document explains how to run and manually test the full pipeline:

> Upload → Parse → Tag → Map Controls → Semantic Mapping → Results

---

## 1. Prerequisites

- Node.js (v18+)
- SQLite
- Git
- An OpenAI API key (for semantic mapping), OR comment out `/semantic-map` if unavailable.

---

## 2. Setup

### 2.1 Clone the repo

```bash
git clone https://github.com/mory1101/reg-parser.git
cd reg-parser


2.2 Install Dependencies
npm install

2.3 Environment Variables 
Creae a .env file in the project root:
OPENAI_API_KEY=your_openai_api_key_here (If you do not have API quota, you can still test up to the keyword-based control mapping step.)

3. Sample Regulation File
Create a simple test file in the project root, e.g. test-regulation.txt:
Article 1 – Access control and authentication
The organization shall restrict access to systems and data based on business need-to-know.
All user accounts must be uniquely identifiable and protected with strong authentication.

Section 2 – Logging and monitoring
All security-relevant events (logins, failed logins, admin actions) must be logged.
Logs must be protected against tampering and retained for at least 12 months.

Clause 3 – Encryption of data at rest and in transit
Confidential data must be encrypted at rest using industry-accepted algorithms.
Data in transit over public networks must be protected with TLS or equivalent encryption.

Article 4 – Third-party and vendor risk management
Vendors with access to confidential data must undergo security due diligence.
Security and privacy requirements must be defined in contracts with third parties.
Vendors must notify the organization of security incidents in a timely manner.


4. Start the Server
npm start

Assume the API base URL is: http://localhost:5000 (adjust if your app uses a different port or prefix)

6. End-to-End Test Flow

6.1 Upload the regulation file

Endpoint: POST api/upload
Body (form-data)

key: file (type: File)

value: test-regulation.txt

Example curl: curl -X POST http://localhost:3000/upload \
  -F "file=@test-regulation.txt"

Expected response
{
  "message": "File uploaded successfully",
  "regulation_id": 1
}
Note the regulation_id (e.g. 1) – you’ll reuse it for all following calls.

6.2 Parse into requirements
Endpoint: POST /parse/:regulationId ( use the regulationId received from the /api/upload endoing)
Example: curl -X POST http://localhost:5000/parse/1

Expected response : {
  "message": "Regulation parsed into requirements successfully",
  "regulation_id": "1",
  "requirements_count": 4
}


6.3 Tag requirements
Endpoint : POST /tag/:regulationId (using postman) or curl -X POST http://localhost:5000/tag/1
Expected response : {
  "message": "Tagging completed",
  "regulation_id": "1",
  "tagged_requirements": 4
}

6.4 Keyword-based control mapping
Endpoint: POST /map-controls/:regulationId or curl -X POST http://localhost:5000/map-controls/1
{
  "message": "Keyword-based control mapping completed",
  "regulation_id": "1",
  "mappings_inserted": <number >= 1>
}

6.5 Semantic mapping (cosine + embeddings)

This step requires a valid OpenAI API key and available quota.
Endpoint : POST /semantic-map/:regulationId or curl -X POST http://localhost:5000/semantic-map/1
Expected response: {
  "message": "Semantic cosine mapping completed",
  "regulation_id": "1",
  "mappings_updated": <number>,
  "threshold_range": "0.6–1.0",
  "mapping": [ ... ]
}

6.6 Fetch strong matches (GET route)
curl http://localhost:5000/semantic-results/1

7. Idempotency Checks

Re-run /tag/:id → should not crash.

Re-run /map-controls/:id → should not insert duplicate mappings (thanks to existence check).

Re-run /semantic-map/:id → should still succeed because it now reads source IN ('keyword','hybrid').


8. Common Issues
8.1 No pending requirements found

Ensure /parse/:regulationId has been run.

Ensure regulation_id matches the one returned by /upload.

8.2 No tagged requirements found

Check that tags.keyword values actually appear in the requirement text.

Confirm that /tag/:regulationId ran successfully.

8.3 No controls found

Make sure the controls table is seeded before /map-controls.

8.4 OpenAI 429 or insufficient_quota

Semantic mapping will fail if the OpenAI account has no API credits.

You can still test the pipeline up to /map-controls without embeddings.
























