import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "reg-parser.db");
const db = new Database(dbPath);

// optional but good practice
db.pragma("foreign_keys = ON");

// schema
db.exec(`
  CREATE TABLE IF NOT EXISTS regulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    file_path TEXT,
    upload_date TEXT
  );

  CREATE TABLE IF NOT EXISTS requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    regulation_id INTEGER,
    clause_number INTEGER,
    text TEXT,
    status TEXT DEFAULT 'pending_analysis',
    FOREIGN KEY (regulation_id) REFERENCES regulations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    keyword TEXT,
    UNIQUE(name)
  );

  CREATE TABLE IF NOT EXISTS requirement_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requirement_id INTEGER,
    tag_id INTEGER,
    FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id)
  );

  -- Controls master table
  CREATE TABLE IF NOT EXISTS controls(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    framework TEXT,  -- e.g. 'ISO27001' , 'NIST-CSF' , 'SOC2'
    control_id TEXT,  -- e.g. 'A.9.2.3'
    title TEXT,
    description TEXT,
    UNIQUE(framework, control_id)
  );

  -- Table that tags the control with the tags table for matching
  CREATE TABLE IF NOT EXISTS control_tags(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    control_db_id INTEGER, -- mapped to the controls.id
    tag_id INTEGER,        -- mapped to the tags.id
    FOREIGN KEY (control_db_id) REFERENCES controls(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id)
  );

  -- Final mapping: requirements -> controls
  CREATE TABLE IF NOT EXISTS requirement_controls(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requirement_id INTEGER,
    control_id INTEGER,
    similarity_score REAL,  -- 1.0 for pure keyword; later cosine for semantics
    source TEXT,            -- 'keyword' | 'semantic' | 'hybrid'
    FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE,
    FOREIGN KEY (control_id) REFERENCES controls(id)
  );
`);




// seed once
const count = db.prepare("SELECT COUNT(*) AS c FROM tags").get().c;

if (count === 0) {
  db.exec(`
    INSERT INTO tags(name, keyword) VALUES
      ('Access control', 'access'),
      ('Encryption', 'encrypt'),
      ('Logging & Monitoring', 'log'),
      ('Privacy / Personal Data', 'personal data'),
      ('Incident Response', 'incident');
  `);
}

const control_count = db.prepare("SELECT COUNT(*) AS count FROM controls").get().count;

if (control_count === 0) {
  db.exec(`
    INSERT INTO controls (framework, control_id, title, description) VALUES
    -- Access control
    ('ISO27001', 'A.9.1.1', 'Access control policy', 'Establish, document and review an access control policy.'),
    ('ISO27001', 'A.9.2.3', 'Management of privileged access rights', 'The allocation and use of privileged access rights shall be restricted and controlled.'),
    ('NIST-CSF', 'PR.AC-1', 'Identity and credentials management', 'Identities and credentials are issued, managed, verified, revoked, and audited.'),

    -- Encryption / protection
    ('ISO27001', 'A.10.1.1', 'Policy on the use of cryptographic controls', 'A policy on the use of cryptographic controls for protection of information shall be developed.'),
    ('NIST-CSF', 'PR.DS-1', 'Data-at-rest protection', 'Data-at-rest is protected.'),

    -- Logging / monitoring
    ('ISO27001', 'A.12.4.1', 'Event logging', 'Event logs recording user activities, exceptions, faults and information security events shall be produced, kept and regularly reviewed.'),
    ('NIST-CSF', 'DE.AE-1', 'Anomalies and events detected', 'A baseline of network operations and expected data flows is established and managed.'),

    -- Incident response
    ('ISO27001', 'A.16.1.1', 'Responsibilities and procedures', 'Management responsibilities and procedures shall be established to ensure a quick, effective and orderly response to information security incidents.'),
    ('NIST-CSF', 'RS.RP-1', 'Response plan', 'Response plan is executed during or after an incident.');
  `);
}

export default db;
