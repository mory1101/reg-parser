import express from 'express';
import multer from 'multer';
import db from '../db.js';
import fs from 'fs';
import { getEmbeddingForText, cosineSimilarity } from '../utils/embeddings.js';

const router = express.Router();

// --- Multer Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads'),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// ---------- Upload Route ----------
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }

    const { originalname, path: filePath } = req.file;
    const uploadDate = new Date().toISOString();

    const stmt = db.prepare(
      `INSERT INTO regulations (name, file_path, upload_date)
       VALUES (?, ?, ?)`
    );

    const result = stmt.run(originalname, filePath, uploadDate);

    console.log('Insert result:', result);

    res.json({
      message: "File uploaded successfully",
      regulation_id: Number(result.lastInsertRowid)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upload Failed' });
  }
});

// ---------- Parse Route ----------
router.post('/parse/:regulationId', (req, res) => {
  try {
    const regulationId = req.params.regulationId;

    const stmt = db.prepare(
      `SELECT file_path FROM regulations WHERE id = ?`
    );
    const row = stmt.get(regulationId);

    if (!row) {
      return res.status(400).json({ error: 'Regulation not found' });
    }

    const filePath = row.file_path;

    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return res.status(500).json({ error: 'Could not read file' });
      }

      const rawClauses = data
        .split(/Article\s+\d+|Section\s+\d+|Clause\s+\d+/gi)
        .map(c => c.trim())
        .filter(c => c.length > 0);

      console.log(rawClauses);

      if (rawClauses.length === 0) {
        return res.status(400).json({ error: 'No clauses found in file' });
      }

      const insertStmt = db.prepare(`
        INSERT INTO requirements (regulation_id, clause_number, text, status)
        VALUES (?, ?, ?, 'pending_analysis')
      `);

      let clauseNumber = 1;
      let insertedCount = 0;

      try {
        for (const clauseText of rawClauses) {
          insertStmt.run(regulationId, clauseNumber, clauseText);
          clauseNumber++;
          insertedCount++;
        }
      } catch (error) {
        console.error('Error inserting requirement:', error);
        return res.status(500).json({ error: 'Insert into requirements failed' });
      }

      return res.json({
        message: 'Regulation parsed into requirements successfully',
        regulation_id: regulationId,
        requirements_count: insertedCount
      });
    });
  } catch (error) {
    console.error('Error fetching regulation:', error);
    return res.status(500).json({ error: 'Database error' });
  }
});

// ---------- Tag Route ----------
router.post('/tag/:regulationId', (req, res) => {
  const regulationId = req.params.regulationId;

  try {
    const getRequirements = db.prepare(`
      SELECT id, text 
      FROM requirements 
      WHERE regulation_id = ? AND status = 'pending_analysis'
    `);

    const getReqResult = getRequirements.all(regulationId);

    if (!getReqResult || getReqResult.length === 0) {
      return res.status(400).json({ error: 'No pending requirements found for this regulation' });
    }

    const getTags = db.prepare(`SELECT id, name, keyword FROM tags`);
    const getTagResult = getTags.all();

    if (!getTagResult || getTagResult.length === 0) {
      return res.status(400).json({ error: 'No tags were found' });
    }

    const insertReqTagStmt = db.prepare(`
      INSERT INTO requirement_tags (requirement_id, tag_id)
      VALUES (?, ?)
    `);

    const updateReqStatusStmt = db.prepare(`
      UPDATE requirements
      SET status = 'tagged'
      WHERE id = ?
    `);

    let taggedCount = 0;

    for (const reqRow of getReqResult) {
      const requirementId = reqRow.id;
      const textLower = String(reqRow.text).toLowerCase();
      console.log("REQ RAW TYPE:", typeof textLower);
      console.log("REQ SAMPLE:", String(reqRow.text).slice(0, 200));

      let hasTag = false;

      for (const tagRow of getTagResult) {
        const keyword = (tagRow.keyword || '').toLowerCase();
        if (!keyword) continue;

        if (textLower.includes(keyword)) {
          hasTag = true;
          insertReqTagStmt.run(requirementId, tagRow.id);
        }
      }

      if (hasTag) {
        taggedCount++;
        updateReqStatusStmt.run(requirementId);
      }
    }

    return res.json({
      message: 'Tagging completed',
      regulation_id: regulationId,
      tagged_requirements: taggedCount
    });

  } catch (error) {
    console.error('Tagging error:', error);
    return res.status(500).json({ error: 'Error during tagging process' });
  }
});

// ---------- Keyword Map Controls Route ----------
router.post('/map-controls/:regulationId', (req, res) => {
  const regulationId = req.params.regulationId;

  try {
    const getReqTagInfoStmt = db.prepare(`
      SELECT
        rt.requirement_id,
        r.text AS requirement_text,
        t.name AS tag_name,
        t.keyword AS tag_keyword
      FROM requirement_tags rt
      JOIN requirements r ON r.id = rt.requirement_id
      JOIN tags t ON t.id = rt.tag_id
      WHERE r.regulation_id = ?
        AND r.status = 'tagged'
    `);

    const reqTagInfoRows = getReqTagInfoStmt.all(regulationId);

    if (!reqTagInfoRows || reqTagInfoRows.length === 0) {
      return res.status(400).json({ error: 'No tagged requirements found for this regulation ' });
    }

    const getControlsStmt = db.prepare(`
      SELECT id, framework, control_id, title, description
      FROM controls
    `);

    const controlRows = getControlsStmt.all();

    if (!controlRows || controlRows.length === 0) {
      return res.status(400).json({ error: 'No controls found. Seed the controls table first.' });
    }
    console.log("All the rows for control set ", controlRows);

    const insertMapStmt = db.prepare(`
      INSERT INTO requirement_controls( requirement_id, control_id, similarity_score, source)
      VALUES(?,?,?,?)
    `);

    const existsStmt = db.prepare(`
      SELECT COUNT(*) AS count
      FROM requirement_controls
      WHERE requirement_id = ? AND control_id = ? AND source = ?
    `);

    const source = 'keyword';
    const similarityScore = 1.0;
    let mappingsInserted = 0;

    const mapTransaction = db.transaction(() => {
      for (const row of reqTagInfoRows) {
        const requirementId = row.requirement_id;
        const tagName = row.tag_name || '';
        const tagKeyword = row.tag_keyword || '';

        const tagNameLower = tagName.toLowerCase();
        const tagKeywordLower = tagKeyword.toLowerCase();

        for (const ctrl of controlRows) {
          const ctrlText = [
            ctrl.control_id,
            ctrl.title || '',
            ctrl.description || ''
          ].join(' ').toLowerCase();

          if (
            (tagKeywordLower && ctrlText.includes(tagKeywordLower)) ||
            (tagNameLower && ctrlText.includes(tagNameLower))
          ) {
            const existsRow = existsStmt.get(requirementId, ctrl.id, source);
            if (existsRow.count > 0) {
              continue; // already mapped
            }

            insertMapStmt.run(requirementId, ctrl.id, similarityScore, source);
            mappingsInserted++;
          }
        }
      }
    });

    mapTransaction();

    return res.json({
      message: 'Keyword-based control mapping completed',
      regulation_id: regulationId,
      mappings_inserted: mappingsInserted
    });

  } catch (error) {
    console.error('Error in map-controls:', error);
    return res.status(500).json({ error: 'Error during control mapping' });
  }
});

// ---------- Semantic Map Route ----------
router.post('/semantic-map/:regulationId', async (req, res) => {
  const regulationId = req.params.regulationId;

  try {
    const getMappingsStmt = db.prepare(`
      SELECT
        rc.id               AS mapping_id,
        r.text              AS requirement_text,
        c.title             AS control_title,
        c.description       AS control_description
      FROM requirement_controls rc
      JOIN requirements r ON r.id = rc.requirement_id
      JOIN controls c      ON c.id = rc.control_id
      WHERE r.regulation_id = ?
        AND rc.source = 'keyword'
    `);

    const mappingRows = getMappingsStmt.all(regulationId);

    if (!mappingRows || mappingRows.length === 0) {
      return res.status(400).json({
        error: 'No keyword-based mappings found for this regulation. Run /map-controls first.'
      });
    }

    const updateMappingStmt = db.prepare(`
      UPDATE requirement_controls
      SET similarity_score = ?, source = ?
      WHERE id = ?
    `);

    let updatedCount = 0;

    const updateTransaction = db.transaction((updates) => {
      for (const u of updates) {
        updateMappingStmt.run(u.score, u.source, u.mappingId);
      }
    });

    const updates = [];

    for (const row of mappingRows) {
      const mappingId = row.mapping_id;

      const requirementText = row.requirement_text || '';
      const controlText = ((row.control_title || '') + ' ' + (row.control_description || '')).trim();

      if (!requirementText || !controlText) {
        continue;
      }

      const reqEmbedding = await getEmbeddingForText(requirementText);
      const ctrlEmbedding = await getEmbeddingForText(controlText);

      const score = cosineSimilarity(reqEmbedding, ctrlEmbedding);

      updates.push({
        mappingId,
        score,
        source: 'hybrid'
      });

      updatedCount++;
    }

    updateTransaction(updates);

  
    return res.json({
      message: 'Semantic cosine mapping completed',
      regulation_id: regulationId,
      mappings_updated: updatedCount,
      threshold_range: '0.6–1.0',
      
    });

  } catch (error) {
    console.error('Error in /semantic-map:', error);
    return res.status(500).json({ error: 'Error during semantic mapping' });
  }
});

router.get('/semantic-results/:regulationId' , (req,res) =>{

  const regulationId = req.params.regulationId;

    try{  
      const resultStmt = db.prepare(`
      SELECT
        r.id            AS requirement_id,
        r.text          AS requirement_text,
        t.name          AS tag_name,
        c.framework     AS framework,
        c.control_id    AS control_code,
        c.title         AS control_title,
        rc.similarity_score,
        rc.source
      FROM requirement_controls rc
      JOIN requirements r
        ON rc.requirement_id = r.id
      LEFT JOIN requirement_tags rt
        ON rt.requirement_id = r.id
      LEFT JOIN tags t
        ON t.id = rt.tag_id
      JOIN controls c
        ON rc.control_id = c.id
      WHERE r.regulation_id = ?
        AND rc.similarity_score >= ?
      ORDER BY r.id, c.framework, c.control_id
    `);

    const rows = resultStmt.all(regulationId, 0.2);

    return res.status(500).json({Rows: rows});



    }catch(error){
      return res.status(400).json({Error: "That resource can't be found!"});

    }
  });

   

export default router;
