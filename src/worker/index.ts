import { Hono } from "hono";
import OpenAI from "openai";
import type { Env } from "@/shared/types";

const app = new Hono<{ Bindings: Env }>();

// Create a new interrogation session
app.post("/api/sessions", async (c) => {
  const { suspect_name, investigator_name } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    `INSERT INTO interrogation_sessions (suspect_name, investigator_name, session_date, status) 
     VALUES (?, ?, date('now'), 'active')`
  )
    .bind(suspect_name, investigator_name)
    .run();

  return c.json({ id: result.meta.last_row_id });
});

// Get all sessions
app.get("/api/sessions", async (c) => {
  const sessions = await c.env.DB.prepare(
    `SELECT * FROM interrogation_sessions ORDER BY created_at DESC`
  ).all();

  return c.json(sessions.results);
});

// Get a specific session
app.get("/api/sessions/:id", async (c) => {
  const id = c.req.param("id");
  
  const session = await c.env.DB.prepare(
    `SELECT * FROM interrogation_sessions WHERE id = ?`
  )
    .bind(id)
    .first();

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const questions = await c.env.DB.prepare(
    `SELECT * FROM questions WHERE session_id = ? ORDER BY created_at ASC`
  )
    .bind(id)
    .all();

  // Get video analysis if available (stored in R2 or returned from video upload)
  let videoAnalysis = null;
  try {
    const videoMetadata = await c.env.R2_BUCKET.list({ prefix: `sessions/${id}/` });
    // Analysis would be stored separately, for now we return null
    // The client will load it from the local JSON file
  } catch (error) {
    // Ignore errors, analysis might not be stored in R2
  }

  return c.json({ session, questions: questions.results, videoAnalysis });
});

// Add a question and answer
app.post("/api/sessions/:id/questions", async (c) => {
  const sessionId = c.req.param("id");
  const { question_text, answer_text } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    `INSERT INTO questions (session_id, question_text, answer_text, timestamp) 
     VALUES (?, ?, ?, datetime('now'))`
  )
    .bind(sessionId, question_text, answer_text)
    .run();

  return c.json({ id: result.meta.last_row_id });
});

// Save behavioral analysis data
app.post("/api/sessions/:id/behavioral", async (c) => {
  const sessionId = c.req.param("id");
  const { question_id, facial_expression_data, eye_movement_data, stress_indicators, confidence_score } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    `INSERT INTO behavioral_analysis (session_id, question_id, facial_expression_data, eye_movement_data, stress_indicators, confidence_score) 
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(sessionId, question_id, facial_expression_data, eye_movement_data, stress_indicators, confidence_score)
    .run();

  return c.json({ id: result.meta.last_row_id });
});

// Analyze session with AI
app.post("/api/sessions/:id/analyze", async (c) => {
  const sessionId = c.req.param("id");
  
  // Get all questions and answers
  const questions = await c.env.DB.prepare(
    `SELECT * FROM questions WHERE session_id = ? ORDER BY created_at ASC`
  )
    .bind(sessionId)
    .all();

  if (!questions.results || questions.results.length === 0) {
    return c.json({ error: "No questions found for this session" }, 400);
  }

  // Prepare conversation for analysis
  const conversation = questions.results?.map((q: { question_text: string; answer_text: string }) => 
    `السؤال: ${q.question_text}\nالإجابة: ${q.answer_text}`
  ).join("\n\n") || "";

  // Use OpenAI to analyze for contradictions and deception
  const client = new OpenAI({
    apiKey: c.env.OPENAI_API_KEY,
  });

  try {
    const response = await client.responses.create({
      model: "gpt-5",
      input: [
        {
          role: "system",
          content: `أنت خبير في تحليل الاستجوابات واكتشاف التناقضات والخداع. قم بتحليل المحادثة التالية واكتشف:
1. التناقضات في الإجابات
2. مؤشرات الخداع المحتملة
3. التقييم العام لمصداقية المشتبه به
4. التوصيات للمحقق

قدم التحليل بصيغة JSON بالتنسيق التالي:
{
  "contradictions": ["تناقض 1", "تناقض 2"],
  "deception_indicators": ["مؤشر 1", "مؤشر 2"],
  "credibility_score": 0.75,
  "sentiment": "قلق",
  "recommendations": ["توصية 1", "توصية 2"],
  "summary": "ملخص التحليل"
}`
        },
        {
          role: "user",
          content: conversation
        }
      ]
    });

    const analysis = JSON.parse(response.output_text);

    // Save NLP analysis
    await c.env.DB.prepare(
      `INSERT INTO nlp_analysis (session_id, contradictions, sentiment_analysis, deception_indicators, overall_score) 
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        sessionId,
        JSON.stringify(analysis.contradictions),
        analysis.sentiment,
        JSON.stringify(analysis.deception_indicators),
        analysis.credibility_score
      )
      .run();

    // Generate comprehensive report
    const reportData = {
      session_id: sessionId,
      nlp_analysis: analysis,
      timestamp: new Date().toISOString()
    };

    await c.env.DB.prepare(
      `INSERT INTO session_reports (session_id, report_data, summary, recommendations) 
       VALUES (?, ?, ?, ?)`
    )
      .bind(
        sessionId,
        JSON.stringify(reportData),
        analysis.summary,
        JSON.stringify(analysis.recommendations)
      )
      .run();

    return c.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    return c.json({ error: "Failed to analyze session" }, 500);
  }
});

// Get session report
app.get("/api/sessions/:id/report", async (c) => {
  const sessionId = c.req.param("id");
  
  const report = await c.env.DB.prepare(
    `SELECT * FROM session_reports WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(sessionId)
    .first();

  if (!report) {
    return c.json({ error: "Report not found" }, 404);
  }

  return c.json(JSON.parse(report.report_data as string));
});

// Update session status
app.patch("/api/sessions/:id", async (c) => {
  const sessionId = c.req.param("id");
  const { status } = await c.req.json();
  
  await c.env.DB.prepare(
    `UPDATE interrogation_sessions SET status = ?, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(status, sessionId)
    .run();

  return c.json({ success: true });
});

// Save video recording metadata and analysis
app.post("/api/sessions/:id/video", async (c) => {
  const sessionId = c.req.param("id");
  
  try {
    const formData = await c.req.formData();
    const videoFile = formData.get("video") as File;
    const analysisFile = formData.get("analysis") as File;
    
    if (!videoFile) {
      return c.json({ error: "No video file provided" }, 400);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `session-${sessionId}-${timestamp}.webm`;
    const fileSize = videoFile.size;
    
    // Save analysis JSON to R2 if provided
    let analysisData = null;
    if (analysisFile) {
      const analysisText = await analysisFile.text();
      analysisData = JSON.parse(analysisText);
      
      // Save to R2 for later retrieval
      const analysisFilename = `sessions/${sessionId}/analysis-${timestamp}.json`;
      await c.env.R2_BUCKET.put(analysisFilename, analysisText, {
        httpMetadata: {
          contentType: 'application/json',
        },
        customMetadata: {
          sessionId: sessionId,
          uploadedAt: new Date().toISOString(),
        },
      });
    }
    
    return c.json({ 
      success: true, 
      filename: filename,
      size: fileSize,
      sizeMB: (fileSize / 1024 / 1024).toFixed(2),
      sessionId: sessionId,
      savedAt: new Date().toISOString(),
      analysis: analysisData,
      note: "Video saved locally, analysis saved to cloud"
    });
  } catch (error) {
    console.error("Error saving video metadata:", error);
    return c.json({ error: "Failed to save video metadata" }, 500);
  }
});

// Get video analysis for a session
app.get("/api/sessions/:id/video-analysis", async (c) => {
  const sessionId = c.req.param("id");
  
  try {
    const prefix = `sessions/${sessionId}/analysis-`;
    const objects = await c.env.R2_BUCKET.list({ prefix });
    
    if (objects.objects.length === 0) {
      return c.json({ error: "No analysis found for this session" }, 404);
    }
    
    // Get the most recent analysis file
    const latest = objects.objects.sort((a, b) => 
      new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime()
    )[0];
    
    const analysisObject = await c.env.R2_BUCKET.get(latest.key);
    if (!analysisObject) {
      return c.json({ error: "Analysis file not found" }, 404);
    }
    
    const analysisText = await analysisObject.text();
    const analysisData = JSON.parse(analysisText);
    
    return c.json(analysisData);
  } catch (error) {
    console.error("Error retrieving video analysis:", error);
    return c.json({ error: "Failed to retrieve video analysis" }, 500);
  }
});

// List all videos for a session
app.get("/api/sessions/:id/videos", async (c) => {
  const sessionId = c.req.param("id");
  
  try {
    const prefix = `sessions/${sessionId}/`;
    const objects = await c.env.R2_BUCKET.list({ prefix });
    
    const videos = objects.objects.map((obj: { key: string; size: number; uploaded: Date }) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      url: `/api/sessions/${sessionId}/video/${obj.key.split('/').pop()}`
    }));

    return c.json({ videos });
  } catch (error) {
    console.error("Error listing videos:", error);
    return c.json({ error: "Failed to list videos" }, 500);
  }
});

// Get video recording
app.get("/api/sessions/:id/video/:filename", async (c) => {
  const sessionId = c.req.param("id");
  const filename = c.req.param("filename");
  
  try {
    const object = await c.env.R2_BUCKET.get(`sessions/${sessionId}/recording-${filename}`);
    
    if (!object) {
      return c.json({ error: "Video not found" }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);

    return new Response(object.body, {
      headers,
    });
  } catch (error) {
    console.error("Error retrieving video:", error);
    return c.json({ error: "Failed to retrieve video" }, 500);
  }
});

export default app;
