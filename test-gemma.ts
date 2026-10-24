/**
 * Gemma 4 Smoke Test Script
 * Sends a realistic onboarding verification request through the active provider
 * (Google AI Studio Gemma 4 or local Ollama) and prints PASS or FAIL.
 */

import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const provider = (process.env.PROVIDER || 'api').toLowerCase();
const gemmaModel = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
const ollamaModel = process.env.OLLAMA_MODEL || 'gemma4:e2b';

async function runSmokeTest() {
  console.log('========================================');
  console.log('       GEMMA 4 ONBOARDING SMOKE TEST    ');
  console.log('========================================');
  console.log(`Active Provider: ${provider.toUpperCase()}`);

  const sampleInput = {
    fullName: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    role: 'Lead Architect',
    hostOrg: 'Global Cyber Summit 2026',
    customFields: {
      team: 'Cloud Security',
      dietary: 'Vegetarian',
      clearance: 'Level 3',
    },
  };

  const testPrompt = `Please verify the following user onboarding data and generate a 1-sentence welcome summary:
User: ${sampleInput.fullName}
Role: ${sampleInput.role}
Organization: ${sampleInput.hostOrg}
Department: ${sampleInput.customFields.team}
Clearance: ${sampleInput.customFields.clearance}`;

  try {
    let resultText = '';

    if (provider === 'local') {
      console.log(`Calling Ollama endpoint at: ${ollamaHost}`);
      console.log(`Model: ${ollamaModel}`);

      const response = await fetch(`${ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: testPrompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as { response?: string };
      resultText = data.response || '';
    } else {
      // API Provider (Google AI Studio Gemma 4)
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is missing.');
      }

      console.log(`Calling Google AI Studio with model: ${gemmaModel}`);
      const ai = new GoogleGenAI();
      const response = await ai.models.generateContent({
        model: gemmaModel,
        contents: testPrompt,
      });

      resultText = response.text || '';
    }

    if (resultText && resultText.trim().length > 0) {
      console.log('\n--- Model Output ---');
      console.log(resultText.trim());
      console.log('--------------------');
      console.log('\nResult: PASS\n');
      process.exit(0);
    } else {
      throw new Error('Received empty response from Gemma provider.');
    }
  } catch (error: any) {
    console.error('\n--- Error Details ---');
    console.error(error.message || error);
    console.error('---------------------');
    console.log('\nResult: FAIL\n');
    process.exit(1);
  }
}

runSmokeTest();
