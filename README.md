# Gemma 4 PassCard Studio

A simple, secure AI web app that creates custom digital onboarding pass cards with QR codes and anti-forgery digital stamps.

Powered by **Gemma 4** through Google AI Studio (Gemini API) with local fallback to **Ollama** (`gemma4:e2b`).

---

## What It Does

1. **Custom Onboarding by Host Needs**: The host can easily change the questions and fields (for conferences, office visits, hospitals, or clubs). Gemma 4 can also suggest smart fields automatically.
2. **AI Identity Verification & Welcome**: When a user onboards, Gemma 4 reviews the details and provides a certified security clearance level and personalized welcome note.
3. **Tamper-Proof Digital Stamp**: Every pass is cryptographically signed using an HMAC SHA-256 digital stamp. If anyone alters the pass details (like changing a role or name), the verification system immediately catches the forgery.
4. **QR Code Verification**: Generates a standard QR code containing the signed pass payload for touchless verification at entry gates.
5. **Direct Email Dispatch**: Passes are sent directly to the user's email address with full HTML preview and print options.
6. **Dual Provider (Cloud & Local)**: Seamlessly switch between Google AI Studio's Gemma 4 cloud model and local Ollama (`gemma4:e2b`).

---

## Setup in 2 Easy Steps

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Environment (.env)
Copy the example file:
```bash
cp .env.example .env
```

Open `.env` and configure your settings:
```ini
# Google AI Studio Gemini API Key (keep this secret on the server)
GEMINI_API_KEY="your-gemini-api-key-here"

# Choose your provider: "api" or "local"
PROVIDER="api"

# Gemma 4 Cloud Model ID (official Gemini API ID)
GEMMA_MODEL="gemma-4-31b-it"

# Ollama Local Settings (if using PROVIDER="local")
OLLAMA_HOST="http://localhost:11434"
OLLAMA_MODEL="gemma4:e2b"

# Secret key for the digital anti-forgery stamp
PASS_SIGNING_SECRET="my_custom_secret_key_123"
```

---

## How to Run

### Running with Google AI Studio (API)
1. In `.env`, set:
   ```ini
   PROVIDER="api"
   ```
2. Start the app:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Running with Local Ollama
1. Make sure Ollama is installed and running on your machine:
   ```bash
   ollama run gemma4:e2b
   ```
2. In `.env`, set:
   ```ini
   PROVIDER="local"
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
4. You can also toggle between API and Local directly in the top header of the web app at any time!

---

## Running the Smoke Test

To verify that your active provider is working and responding properly to realistic user onboarding input:

```bash
npm run test:smoke
```

- If successful, it prints the Gemma 4 response and:
  ```
  Result: PASS
  ```
- If there is an issue (missing key or unreachable Ollama), it prints details and:
  ```
  Result: FAIL
  ```

---

## Anti-Forgery Testing Station

The app includes an **Anti-Forgery Stamp Check** tab. You can:
1. Load a real pass card.
2. Click **Run Digital Stamp Verification** to see it marked **PASS CARD VERIFIED AUTHENTIC**.
3. Click **Simulate Forged Role (Tamper Test)** or change any character in the name or role.
4. The system recalculates the signature and instantly alerts **FORGERY / TAMPERING DETECTED!** because the digital stamp signature no longer matches the altered data.
