import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import pool from '../config/db';

const router = Router();

// Helper to fetch dynamic AI keys (prioritize process.env then database system_settings)
async function getAiKey(keyName: string): Promise<string> {
  const envVal = process.env[keyName];
  if (envVal && envVal.trim() !== '') return envVal;
  
  try {
    const res = await pool.query('SELECT value FROM system_settings WHERE key = $1', [keyName]);
    if (res.rows.length > 0 && res.rows[0].value) {
      return res.rows[0].value;
    }
  } catch (err) {
    console.error(`[AI Key Lookup Error] Failed to read ${keyName} from database:`, err);
  }
  return '';
}

// FAQ Chatbot endpoint for donation widget (using Gemini)
router.post('/chat', async (req: Request, res: Response) => {
  const { query, campaignContext, sessionId } = req.body;

  try {
    if (!query) {
      return res.status(400).json({ success: false, message: 'User query is required.' });
    }

    const key = await getAiKey('GEMINI_API_KEY');
    if (!key) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API key not configured. Please configure GEMINI_API_KEY in System Settings.'
      });
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemContext = `
      You are DanaPro AI, an assistant helping a donor on an NGO donation page.
      Campaign Context: ${JSON.stringify(campaignContext || 'General fundraising')}
      Please answer the donor query professionally, encourage donations, keep answers under 3 sentences, and never make up bank account details.
    `;

    const prompt = `${systemContext}\n\nDonor Query: ${query}`;
    
    console.log(`Sending prompt to Gemini: "${query}"`);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Log the interaction asynchronously in PostgreSQL if organization is resolved
    let targetOrgId = req.body.organizationId || (typeof campaignContext === 'object' ? campaignContext?.organization_id : null);
    if (!targetOrgId && typeof campaignContext === 'object' && campaignContext?.id) {
      const campOrgRes = await pool.query('SELECT organization_id FROM campaigns WHERE id = $1', [campaignContext.id]);
      targetOrgId = campOrgRes.rows[0]?.organization_id || null;
    }

    if (targetOrgId) {
      pool.query(
        'INSERT INTO ai_interactions (organization_id, session_id, user_query, ai_response) VALUES ($1, $2, $3, $4) RETURNING *',
        [targetOrgId, sessionId || 'anon-session', query, responseText]
      ).catch(err => console.error('Failed to log AI query to Postgres:', err.message));
    }

    return res.status(200).json({
      success: true,
      reply: responseText
    });
  } catch (error: any) {
    console.error('Gemini error:', error);
    return res.status(500).json({ success: false, message: 'Gemini service error: ' + error.message });
  }
});

// Thank-You Email Copilot drafting (using OpenAI)
router.post('/copilot/thankyou-email', async (req: Request, res: Response) => {
  const { donorName, donationAmount, currency, campaignName } = req.body;

  try {
    const key = await getAiKey('OPENAI_API_KEY');
    if (!key) {
      return res.status(500).json({
        success: false,
        message: 'OpenAI API key not configured. Please configure OPENAI_API_KEY in System Settings.'
      });
    }

    const openai = new OpenAI({ apiKey: key });
    const prompt = `Write a heartfelt thank-you email to ${donorName || 'a generous donor'} who contributed ${donationAmount || '100'} ${currency || 'USD'} to our campaign: ${campaignName || 'General Funds'}. Suggest a friendly and professional subject line.`;

    let emailText = '';
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
      });
      emailText = completion.choices[0].message?.content || '';
    } catch (modelErr) {
      const fallback = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
      });
      emailText = fallback.choices[0].message?.content || '';
    }

    return res.status(200).json({
      success: true,
      emailText
    });
  } catch (error: any) {
    console.error('OpenAI error:', error);
    return res.status(500).json({ success: false, message: 'OpenAI service error: ' + error.message });
  }
});

export default router;
