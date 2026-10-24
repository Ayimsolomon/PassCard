import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Configuration
const SIGNING_SECRET = process.env.PASS_SIGNING_SECRET || 'gemma4_secret_default_key_2026';
let currentProvider = (process.env.PROVIDER || 'api').toLowerCase(); // 'api' or 'local'
const gemmaModel = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
const ollamaModel = process.env.OLLAMA_MODEL || 'gemma4:e2b';

// Helper: Canonical signature generation for tamper-proof digital stamp
export function generateDigitalStamp(data: {
  id: string;
  fullName: string;
  email: string;
  role: string;
  hostOrg: string;
  issueDate: string;
  expiryDate: string;
  customFields?: Record<string, string>;
}): { signature: string; hashPayload: string } {
  // Sort keys deterministically
  const canonicalString = JSON.stringify({
    id: data.id,
    fullName: data.fullName.trim().toLowerCase(),
    email: data.email.trim().toLowerCase(),
    role: data.role.trim().toLowerCase(),
    hostOrg: data.hostOrg.trim().toLowerCase(),
    issueDate: data.issueDate,
    expiryDate: data.expiryDate,
    customFields: data.customFields || {},
  });

  const hmac = crypto.createHmac('sha256', SIGNING_SECRET);
  hmac.update(canonicalString);
  const signature = hmac.digest('hex');

  return { signature, hashPayload: canonicalString };
}

// Helper: Verify digital stamp
export function verifyDigitalStamp(
  data: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    hostOrg: string;
    issueDate: string;
    expiryDate: string;
    customFields?: Record<string, string>;
  },
  providedSignature: string
): { isValid: boolean; calculatedSignature: string } {
  const { signature } = generateDigitalStamp(data);
  return {
    isValid: signature === providedSignature,
    calculatedSignature: signature,
  };
}

// Unified Gemma 4 caller
export async function callGemma(prompt: string, systemInstruction?: string): Promise<string> {
  if (currentProvider === 'local') {
    // Call Ollama local instance
    const combinedPrompt = systemInstruction
      ? `${systemInstruction}\n\nTask: ${prompt}`
      : prompt;

    try {
      const response = await fetch(`${ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: combinedPrompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: HTTP ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { response?: string };
      return data.response || 'No text returned from Ollama';
    } catch (err: any) {
      throw new Error(`Failed to reach local Ollama (${ollamaHost}): ${err.message}`);
    }
  } else {
    // Call Google AI Studio Gemma 4 API via @google/genai
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the environment.');
    }

    const ai = new GoogleGenAI();
    
    // We try the configured Gemma 4 model, with smart fallback to Gemma 4 alternatives
    try {
      const response = await ai.models.generateContent({
        model: gemmaModel,
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      return response.text || 'Gemma 4 generated an empty response.';
    } catch (apiErr: any) {
      // If specific model variant isn't available, try gemma-4-26b-a4b-it or gemma-2-27b-it
      console.warn(`Primary Gemma model (${gemmaModel}) failed:`, apiErr.message);
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemma-4-26b-a4b-it',
          contents: prompt,
          config: systemInstruction ? { systemInstruction } : undefined,
        });
        return fallbackResponse.text || 'Fallback Gemma response generated.';
      } catch (fallbackErr: any) {
        throw new Error(`Gemma 4 API call failed: ${apiErr.message}`);
      }
    }
  }
}

// API Routes

// 1. System status and provider info
app.get('/api/status', async (req: Request, res: Response) => {
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  let ollamaOnline = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const ollamaCheck = await fetch(`${ollamaHost}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    ollamaOnline = ollamaCheck.ok;
  } catch {
    ollamaOnline = false;
  }

  const hasSmtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

  res.json({
    provider: currentProvider,
    hasApiKey,
    gemmaModel,
    ollamaHost,
    ollamaModel,
    ollamaOnline,
    hasSmtpConfigured,
  });
});

// 2. Toggle or set provider runtime switch
app.post('/api/set-provider', (req: Request, res: Response) => {
  const { provider } = req.body;
  if (provider === 'api' || provider === 'local') {
    currentProvider = provider;
    return res.json({ success: true, provider: currentProvider });
  }
  res.status(400).json({ error: 'Provider must be "api" or "local"' });
});

// 3. User Onboarding & Pass Creation with Gemma 4 verification + Digital Stamp + QR
app.post('/api/onboard', async (req: Request, res: Response) => {
  try {
    const { fullName, email, role, hostOrg, expiryDate, customFields, avatarUrl } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({ error: 'Full name and email are required.' });
    }

    const passId = `PASS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const issueDate = new Date().toISOString().split('T')[0];
    const calculatedExpiry = expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const userRole = role || 'Standard Member';
    const organization = hostOrg || 'Global Access Network';

    // 1. Generate digital stamp HMAC
    const stampData = {
      id: passId,
      fullName,
      email,
      role: userRole,
      hostOrg: organization,
      issueDate,
      expiryDate: calculatedExpiry,
      customFields: customFields || {},
    };

    const { signature } = generateDigitalStamp(stampData);

    // 2. Generate QR Code
    // QR contains a compact verification packet
    const qrPayload = JSON.stringify({
      v: 1,
      id: passId,
      n: fullName,
      e: email,
      r: userRole,
      org: organization,
      exp: calculatedExpiry,
      stamp: signature.substring(0, 16), // Stamp snippet
      sig: signature,
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    // 3. Gemma 4 AI Analysis & Personalization
    let aiVerification: {
      welcomeMessage: string;
      securityTier: string;
      clearanceLevel: string;
      personalizedBadgeTip: string;
    } = {
      welcomeMessage: `Welcome aboard, ${fullName}! Your digital onboarding pass has been verified and stamped.`,
      securityTier: 'TIER-1 VERIFIED',
      clearanceLevel: 'Standard Certified Access',
      personalizedBadgeTip: 'Keep your digital stamp QR handy for touchless entry.',
    };

    try {
      const prompt = `A user has just completed onboarding:
Name: ${fullName}
Email: ${email}
Role/Access: ${userRole}
Host Organization/Event: ${organization}
Additional Details: ${JSON.stringify(customFields || {})}

Please review this onboarding submission and provide:
1. A warm, professional 1-2 sentence welcome message.
2. An appropriate security tier name (e.g. "TIER-1 GENERAL", "TIER-2 STAFF", "TIER-3 VIP CLEARANCE").
3. Clearance badge label (e.g. "Full Summit Access", "Guest Visitor Access").
4. A 1-sentence personalized onboarding tip for their pass card.

Format your response strictly as JSON with keys:
"welcomeMessage", "securityTier", "clearanceLevel", "personalizedBadgeTip"`;

      const systemInstruction = 'You are Gemma 4, an intelligent onboarding security and hospitality AI assistant. Always output clean JSON only.';

      const gemmaText = await callGemma(prompt, systemInstruction);
      
      // Parse JSON from Gemma response
      const jsonMatch = gemmaText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        aiVerification = {
          welcomeMessage: parsed.welcomeMessage || aiVerification.welcomeMessage,
          securityTier: parsed.securityTier || aiVerification.securityTier,
          clearanceLevel: parsed.clearanceLevel || aiVerification.clearanceLevel,
          personalizedBadgeTip: parsed.personalizedBadgeTip || aiVerification.personalizedBadgeTip,
        };
      }
    } catch (aiErr: any) {
      console.warn('Gemma 4 enrichment fallback used:', aiErr.message);
      // Use fallback default values
    }

    const passCard = {
      id: passId,
      fullName,
      email,
      role: userRole,
      hostOrg: organization,
      issueDate,
      expiryDate: calculatedExpiry,
      customFields: customFields || {},
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(fullName)}`,
      digitalStamp: signature,
      qrCodeDataUrl: qrDataUrl,
      aiVerification,
      providerUsed: currentProvider,
      isVerified: true,
    };

    res.json({
      success: true,
      passCard,
    });
  } catch (error: any) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: error.message || 'Internal server error during onboarding' });
  }
});

// 4. Verify Digital Stamp (Detect Forgery / Tampering)
app.post('/api/verify-stamp', (req: Request, res: Response) => {
  try {
    const { passCard, signatureToTest } = req.body;

    if (!passCard || !signatureToTest) {
      return res.status(400).json({ error: 'Pass card data and signature are required.' });
    }

    const stampData = {
      id: passCard.id,
      fullName: passCard.fullName,
      email: passCard.email,
      role: passCard.role,
      hostOrg: passCard.hostOrg,
      issueDate: passCard.issueDate,
      expiryDate: passCard.expiryDate,
      customFields: passCard.customFields || {},
    };

    const { isValid, calculatedSignature } = verifyDigitalStamp(stampData, signatureToTest);

    if (isValid) {
      return res.json({
        verified: true,
        status: 'GENUINE',
        message: 'Digital Stamp Validated: Data is completely genuine and unmodified.',
        passId: passCard.id,
        user: passCard.fullName,
        timestamp: new Date().toISOString(),
        stamp: signatureToTest,
      });
    } else {
      return res.json({
        verified: false,
        status: 'FORGED_OR_TAMPERED',
        message: 'SECURITY ALERT: Digital Stamp mismatch! The pass card has been altered, forged, or signed with an invalid key.',
        expectedStamp: calculatedSignature,
        providedStamp: signatureToTest,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error verifying pass card' });
  }
});

// 5. Send Pass Card to User's Email (simulated email dispatch with log & inbox preview)
const sentEmailsLog: Array<{
  id: string;
  to: string;
  subject: string;
  timestamp: string;
  passId: string;
  userName: string;
  previewHtml: string;
}> = [];

app.post('/api/send-email', async (req: Request, res: Response) => {
  const { passCard } = req.body;
  if (!passCard || !passCard.email) {
    return res.status(400).json({ error: 'Valid pass card and recipient email required.' });
  }

  const subject = `Your Verified Onboarding Pass Card for ${passCard.hostOrg} [ID: ${passCard.id}]`;
  const previewHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 16px; padding: 28px; background: #ffffff; color: #1e293b;">
      <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 18px;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #2563eb;">${passCard.hostOrg}</span>
        <h2 style="color: #0f172a; margin: 6px 0 0 0; font-size: 22px;">Official Verified Onboarding Pass</h2>
      </div>
      <div style="padding: 24px 0; text-align: center;">
        <h3 style="color: #0f172a; margin: 0 0 6px 0; font-size: 18px;">Hello, ${passCard.fullName}!</h3>
        <p style="color: #475569; font-size: 14px; margin: 0 0 16px 0;">
          ${passCard.aiVerification?.welcomeMessage || 'Your digital onboarding pass has been issued and certified.'}
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 16px 0; text-align: left;">
          <p style="font-size: 13px; color: #64748b; margin: 0 0 8px 0;">Pass ID: <strong style="color: #0f172a; font-family: monospace;">${passCard.id}</strong></p>
          <p style="font-size: 13px; color: #64748b; margin: 0 0 8px 0;">Role: <strong style="color: #0f172a;">${passCard.role}</strong></p>
          <p style="font-size: 13px; color: #64748b; margin: 0 0 8px 0;">Valid Until: <strong style="color: #0f172a;">${passCard.expiryDate}</strong></p>
          <p style="font-size: 13px; color: #16a34a; font-weight: bold; margin: 0;">✓ Digital Stamp: Cryptographically Verified & Genuine</p>
        </div>
        <p style="font-size: 13px; color: #475569; margin: 16px 0 4px 0;">
          Present the QR code below at access gates or check-in desks:
        </p>
        <div style="display: inline-block; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin: 8px 0;">
          <img src="${passCard.qrCodeDataUrl}" alt="QR Code" width="180" height="180" style="display: block; margin: 0 auto;" />
        </div>
        <p style="font-size: 11px; color: #94a3b8; font-family: monospace; word-break: break-all; margin-top: 12px;">
          Stamp Signature: ${passCard.digitalStamp}
        </p>
      </div>
    </div>
  `;

  let liveDelivered = false;
  let deliveryDetails = '';

  // Check if live SMTP server credentials are provided
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"PassCard System" <${process.env.SMTP_USER}>`,
        to: passCard.email,
        subject,
        html: previewHtml,
      });

      liveDelivered = true;
      deliveryDetails = `Real email dispatched via SMTP (${process.env.SMTP_HOST}) to ${passCard.email}`;
    } catch (smtpErr: any) {
      console.error('SMTP live delivery failed:', smtpErr.message);
      deliveryDetails = `SMTP attempt failed: ${smtpErr.message}. Saved to in-app outbox instead.`;
    }
  } else {
    deliveryDetails = 'Saved to in-app outbox. (Live SMTP credentials not configured in .env yet).';
  }

  const emailRecord = {
    id: `EMAIL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    to: passCard.email,
    subject,
    timestamp: new Date().toLocaleString(),
    passId: passCard.id,
    userName: passCard.fullName,
    previewHtml,
    liveDelivered,
  };

  sentEmailsLog.unshift(emailRecord);
  if (sentEmailsLog.length > 50) sentEmailsLog.pop();

  res.json({
    success: true,
    liveDelivered,
    message: liveDelivered
      ? `Real email successfully delivered to ${passCard.email} via SMTP!`
      : `Pass card stored in the In-App Email Outbox for ${passCard.email}!`,
    deliveryDetails,
    emailRecord,
  });
});

app.get('/api/sent-emails', (req: Request, res: Response) => {
  res.json({ emails: sentEmailsLog });
});

// 6. Host dynamic field template suggestions powered by Gemma 4
app.post('/api/suggest-fields', async (req: Request, res: Response) => {
  const { hostType } = req.body;
  const prompt = `Suggest 3 to 4 custom onboarding fields for this organization or event type: "${hostType || 'Conference Summit'}".
For each field, provide a JSON array of objects with:
- id: unique string key (e.g., "dietary", "badgeTitle", "department", "company")
- label: friendly title (e.g. "Dietary Preferences", "Department / Team")
- type: "text" | "select"
- options: array of string choices if type is select, otherwise empty array
- required: boolean

Output strictly valid JSON with key "fields".`;

  try {
    const text = await callGemma(prompt, 'You are an onboarding workflow expert. Return JSON only.');
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return res.json({ fields: parsed.fields || [] });
    }
  } catch (err) {
    console.warn('Field suggestions fallback used');
  }

  // Fallback defaults
  res.json({
    fields: [
      { id: 'organization_unit', label: 'Department / Organization', type: 'text', required: true, options: [] },
      { id: 'access_zone', label: 'Access Zone', type: 'select', required: true, options: ['Main Hall', 'VIP Lounge', 'All Zones'] },
      { id: 'emergency_contact', label: 'Emergency Phone Number', type: 'text', required: false, options: [] },
    ],
  });
});

// Configure Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static files
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [Provider: ${currentProvider}]`);
  });
}

startServer();
