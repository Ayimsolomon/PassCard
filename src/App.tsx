import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Mail,
  Settings,
  UserCheck,
  Sparkles,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Copy,
  Lock,
  Eye,
  Sliders,
  Send,
  Inbox,
  User,
  Building,
  Calendar,
  KeyRound,
  Printer
} from 'lucide-react';

interface CustomFieldDef {
  id: string;
  label: string;
  type: 'text' | 'select';
  required: boolean;
  options?: string[];
  defaultValue?: string;
}

interface PassCardData {
  id: string;
  fullName: string;
  email: string;
  role: string;
  hostOrg: string;
  issueDate: string;
  expiryDate: string;
  customFields: Record<string, string>;
  avatarUrl: string;
  digitalStamp: string;
  qrCodeDataUrl: string;
  aiVerification?: {
    welcomeMessage: string;
    securityTier: string;
    clearanceLevel: string;
    personalizedBadgeTip: string;
  };
  providerUsed?: string;
}

interface EmailItem {
  id: string;
  to: string;
  subject: string;
  timestamp: string;
  passId: string;
  userName: string;
  previewHtml: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'onboard' | 'pass' | 'fields' | 'verify' | 'emails'>('onboard');

  // Provider & system status
  const [systemStatus, setSystemStatus] = useState<{
    provider: string;
    hasApiKey: boolean;
    gemmaModel: string;
    ollamaHost: string;
    ollamaModel: string;
    ollamaOnline: boolean;
  }>({
    provider: 'api',
    hasApiKey: true,
    gemmaModel: 'gemma-4-31b-it',
    ollamaHost: 'http://localhost:11434',
    ollamaModel: 'gemma4:e2b',
    ollamaOnline: false,
  });

  // Host organization & customizable fields
  const [hostOrg, setHostOrg] = useState('Nexus Innovation Summit 2026');
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([
    { id: 'department', label: 'Department / Organization', type: 'text', required: true, defaultValue: 'Engineering' },
    { id: 'accessTier', label: 'Access Level', type: 'select', required: true, options: ['General Attendee', 'VIP Speaker', 'Staff / Organizer', 'Press Access'], defaultValue: 'VIP Speaker' },
    { id: 'dietary', label: 'Dietary Preferences', type: 'select', required: false, options: ['None / Standard', 'Vegetarian', 'Vegan', 'Halal', 'Gluten-Free'], defaultValue: 'None / Standard' },
  ]);

  // Form inputs for user onboarding
  const [formData, setFormData] = useState<{
    fullName: string;
    email: string;
    role: string;
    expiryDate: string;
    customFields: Record<string, string>;
  }>({
    fullName: 'Sophia Martinez',
    email: 'sophia.martinez@example.com',
    role: 'Lead AI Researcher',
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customFields: {
      department: 'AI Systems Lab',
      accessTier: 'VIP Speaker',
      dietary: 'Vegetarian',
    },
  });

  // Generated pass state
  const [currentPass, setCurrentPass] = useState<PassCardData | null>(null);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardSuccessMessage, setOnboardSuccessMessage] = useState<string | null>(null);

  // Email dispatch status
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [sentEmails, setSentEmails] = useState<EmailItem[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);

  // Verification & Anti-forgery sandbox state
  const [tamperedPass, setTamperedPass] = useState<{
    fullName: string;
    email: string;
    role: string;
    hostOrg: string;
    digitalStamp: string;
  }>({
    fullName: '',
    email: '',
    role: '',
    hostOrg: '',
    digitalStamp: '',
  });

  const [verifyResult, setVerifyResult] = useState<{
    checked: boolean;
    verified: boolean;
    status: string;
    message: string;
  } | null>(null);

  // AI Field Suggestion state
  const [suggestInput, setSuggestInput] = useState('Tech Conference');
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Fetch status on mount
  useEffect(() => {
    fetchStatus();
    fetchEmails();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch status', e);
    }
  };

  const fetchEmails = async () => {
    try {
      const res = await fetch('/api/sent-emails');
      if (res.ok) {
        const data = await res.json();
        setSentEmails(data.emails || []);
      }
    } catch (e) {
      console.warn('Failed to fetch emails', e);
    }
  };

  const handleSwitchProvider = async (provider: 'api' | 'local') => {
    try {
      const res = await fetch('/api/set-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        setSystemStatus(prev => ({ ...prev, provider }));
      }
    } catch (e) {
      alert('Could not switch provider: ' + e);
    }
  };

  // Submit onboarding
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim()) {
      alert('Please fill in your name and email.');
      return;
    }

    setIsOnboarding(true);
    setOnboardSuccessMessage(null);

    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          role: formData.role,
          hostOrg,
          expiryDate: formData.expiryDate,
          customFields: formData.customFields,
        }),
      });

      const data = await res.json();
      if (res.ok && data.passCard) {
        setCurrentPass(data.passCard);
        setTamperedPass({
          fullName: data.passCard.fullName,
          email: data.passCard.email,
          role: data.passCard.role,
          hostOrg: data.passCard.hostOrg,
          digitalStamp: data.passCard.digitalStamp,
        });
        setOnboardSuccessMessage('Onboarding completed! Digital stamp certified & QR generated.');
        setActiveTab('pass');
      } else {
        alert('Onboarding failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error during onboarding: ' + err.message);
    } finally {
      setIsOnboarding(false);
    }
  };

  // Send Pass to User Email
  const handleSendEmail = async () => {
    if (!currentPass) return;
    setIsSendingEmail(true);
    setEmailStatus(null);

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passCard: currentPass }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEmailStatus({ success: true, message: `Pass card dispatched to ${currentPass.email}!` });
        fetchEmails();
      } else {
        setEmailStatus({ success: false, message: data.error || 'Failed to dispatch email' });
      }
    } catch (err: any) {
      setEmailStatus({ success: false, message: 'Network error sending email' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Verify stamp in anti-forgery station
  const handleVerifyStamp = async () => {
    if (!currentPass) return;

    try {
      const simulatedPass = {
        ...currentPass,
        fullName: tamperedPass.fullName,
        email: tamperedPass.email,
        role: tamperedPass.role,
        hostOrg: tamperedPass.hostOrg,
      };

      const res = await fetch('/api/verify-stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passCard: simulatedPass,
          signatureToTest: tamperedPass.digitalStamp,
        }),
      });

      const data = await res.json();
      setVerifyResult({
        checked: true,
        verified: data.verified,
        status: data.status,
        message: data.message,
      });
    } catch (err: any) {
      alert('Verification error: ' + err.message);
    }
  };

  // AI Field Suggestion
  const handleSuggestFields = async () => {
    setIsSuggesting(true);
    try {
      const res = await fetch('/api/suggest-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostType: suggestInput }),
      });
      const data = await res.json();
      if (data.fields && Array.isArray(data.fields)) {
        // Merge or replace
        const formatted: CustomFieldDef[] = data.fields.map((f: any) => ({
          id: f.id || `field_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          label: f.label || 'Custom Field',
          type: f.type === 'select' ? 'select' : 'text',
          required: Boolean(f.required),
          options: Array.isArray(f.options) && f.options.length > 0 ? f.options : undefined,
          defaultValue: f.options && f.options.length > 0 ? f.options[0] : '',
        }));

        setCustomFields(prev => [...prev, ...formatted]);
      }
    } catch (err) {
      console.warn('Field suggestion error:', err);
    } finally {
      setIsSuggesting(false);
    }
  };

  // Add custom field manually
  const handleAddManualField = () => {
    const newId = `field_${Date.now().toString(36)}`;
    setCustomFields(prev => [
      ...prev,
      {
        id: newId,
        label: 'New Question / Requirement',
        type: 'text',
        required: false,
        defaultValue: '',
      },
    ]);
  };

  const handleRemoveField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Banner & Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Gemma 4 PassCard
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Tamper-Proof
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Configurable Onboarding Passes with Cryptographic Digital Stamp & QR Verification
              </p>
            </div>
          </div>

          {/* Provider status & switch */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1 text-xs">
              <button
                onClick={() => handleSwitchProvider('api')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  systemStatus.provider === 'api'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Google AI Studio Gemma 4 Cloud Model"
              >
                Gemma 4 (API)
              </button>
              <button
                onClick={() => handleSwitchProvider('local')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  systemStatus.provider === 'local'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Local Ollama fallback (gemma4:e2b)"
              >
                Ollama Local
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Model: <code className="text-blue-400 font-mono">{systemStatus.provider === 'api' ? systemStatus.gemmaModel : systemStatus.ollamaModel}</code></span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-4 border-t border-slate-800/60 text-sm overflow-x-auto">
          <button
            onClick={() => setActiveTab('onboard')}
            className={`py-3 px-3 sm:px-4 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'onboard'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            1. User Onboarding
          </button>

          <button
            onClick={() => setActiveTab('pass')}
            className={`py-3 px-3 sm:px-4 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'pass'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="h-4 w-4" />
            2. Pass Card & QR
            {currentPass && (
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('verify')}
            className={`py-3 px-3 sm:px-4 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'verify'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            3. Anti-Forgery Stamp Check
          </button>

          <button
            onClick={() => setActiveTab('fields')}
            className={`py-3 px-3 sm:px-4 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'fields'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="h-4 w-4" />
            Host Config & Questions
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={`py-3 px-3 sm:px-4 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'emails'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="h-4 w-4" />
            Dispatched Emails
            {sentEmails.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-mono">
                {sentEmails.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* TAB 1: USER ONBOARDING FORM */}
        {activeTab === 'onboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
                <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-blue-400" />
                      Onboard New User
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Fill out the form below. Once registered, Gemma 4 certifies the profile and creates a signed pass.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Host Organization</span>
                    <p className="text-sm font-semibold text-slate-200">{hostOrg}</p>
                  </div>
                </div>

                <form onSubmit={handleOnboardSubmit} className="mt-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                        required
                        placeholder="e.g. Maya Chen"
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                        Email Address * (For Pass Dispatch)
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        required
                        placeholder="e.g. maya@example.com"
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                        Role / Designation
                      </label>
                      <input
                        type="text"
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                        placeholder="e.g. Lead Engineer, Visitor, Doctor"
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                        Valid Until / Expiry
                      </label>
                      <input
                        type="date"
                        value={formData.expiryDate}
                        onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                      />
                    </div>
                  </div>

                  {/* Host-defined custom fields */}
                  {customFields.length > 0 && (
                    <div className="pt-4 border-t border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                          Host Requirements ({customFields.length} Dynamic Fields)
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('fields')}
                          className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 transition"
                        >
                          <Settings className="h-3.5 w-3.5" /> Modify Host Fields
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {customFields.map(field => (
                          <div key={field.id} className="space-y-1.5">
                            <label className="block text-xs font-medium text-slate-300">
                              {field.label} {field.required && <span className="text-red-400">*</span>}
                            </label>

                            {field.type === 'select' && field.options ? (
                              <select
                                value={formData.customFields[field.id] || ''}
                                onChange={e =>
                                  setFormData({
                                    ...formData,
                                    customFields: { ...formData.customFields, [field.id]: e.target.value },
                                  })
                                }
                                required={field.required}
                                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500 transition text-sm"
                              >
                                <option value="">Select an option...</option>
                                {field.options.map(opt => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={formData.customFields[field.id] || ''}
                                onChange={e =>
                                  setFormData({
                                    ...formData,
                                    customFields: { ...formData.customFields, [field.id]: e.target.value },
                                  })
                                }
                                required={field.required}
                                placeholder={`Enter ${field.label.toLowerCase()}`}
                                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={isOnboarding}
                      className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition disabled:opacity-60 cursor-pointer"
                    >
                      {isOnboarding ? (
                        <>
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          Gemma 4 is Verifying & Generating Stamp...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5 text-amber-300" />
                          Generate Verified Pass Card
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Quick Preview sidebar */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Security Specifications
                </h3>

                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-white">HMAC Digital Stamp:</strong> Generates a cryptographic hash with the host secret. If any character in the pass is changed, the verification immediately fails.
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-white">Offline & Online QR Validation:</strong> Contains signed user identity payload readable by any standard scanner.
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-white">Gemma 4 AI Assistant:</strong> Enriches the pass with automated welcome notes, clearance badges, and security level scoring.
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div>
                      <strong className="text-white">Email Dispatch:</strong> Users receive their digital pass card directly in their inbox with 1-click verification.
                    </div>
                  </li>
                </ul>
              </div>

              {currentPass ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Last Pass Ready
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">{currentPass.fullName}</h4>
                    <p className="text-xs text-slate-400">{currentPass.role} • {currentPass.hostOrg}</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('pass')}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
                  >
                    <Eye className="h-4 w-4" /> View Pass Card & QR
                  </button>
                </div>
              ) : (
                <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
                  Fill in the onboarding form on the left to mint your first verified pass card!
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PASS CARD & QR VIEW */}
        {activeTab === 'pass' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {!currentPass ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
                <QrCode className="h-12 w-12 text-slate-600 mx-auto" />
                <h3 className="text-lg font-semibold text-white">No Pass Created Yet</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Please complete the onboarding step first to generate your official signed pass card with QR verification.
                </p>
                <button
                  onClick={() => setActiveTab('onboard')}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition"
                >
                  Go to Onboarding Form
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {onboardSuccessMessage && (
                  <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <span>{onboardSuccessMessage}</span>
                    </div>
                    <button
                      onClick={() => setOnboardSuccessMessage(null)}
                      className="text-xs text-emerald-400/80 hover:text-emerald-200"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* THE PASS CARD COMPONENT */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-slate-700/80 shadow-2xl p-6 sm:p-8">
                  {/* Holographic Security Ribbon */}
                  <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400"></div>

                  <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
                    {/* Left: User details & Host org */}
                    <div className="flex-1 space-y-5 w-full">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                            {currentPass.hostOrg}
                          </span>
                          <h2 className="text-xs text-slate-400">Official Digital Onboarding Pass</h2>
                        </div>
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {currentPass.aiVerification?.securityTier || 'VERIFIED'}
                        </span>
                      </div>

                      {/* User Info Bar */}
                      <div className="flex items-center gap-4 pt-2">
                        <img
                          src={currentPass.avatarUrl}
                          alt={currentPass.fullName}
                          className="h-16 w-16 rounded-2xl bg-slate-800 border-2 border-slate-700 object-cover shadow"
                        />
                        <div>
                          <h3 className="text-2xl font-black text-white tracking-tight">
                            {currentPass.fullName}
                          </h3>
                          <p className="text-sm font-semibold text-indigo-300">{currentPass.role}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{currentPass.email}</p>
                        </div>
                      </div>

                      {/* Gemma AI Welcome & Tip */}
                      {currentPass.aiVerification && (
                        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 text-xs space-y-1">
                          <p className="text-slate-200 italic">
                            "{currentPass.aiVerification.welcomeMessage}"
                          </p>
                          <p className="text-[11px] text-blue-400 font-medium">
                            Tip: {currentPass.aiVerification.personalizedBadgeTip}
                          </p>
                        </div>
                      )}

                      {/* Meta Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-slate-500 text-[10px] uppercase font-bold block">Pass ID</span>
                          <span className="font-mono text-slate-200 text-xs font-semibold">{currentPass.id}</span>
                        </div>
                        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-slate-500 text-[10px] uppercase font-bold block">Issued</span>
                          <span className="text-slate-200 text-xs">{currentPass.issueDate}</span>
                        </div>
                        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-slate-500 text-[10px] uppercase font-bold block">Valid Until</span>
                          <span className="text-slate-200 text-xs">{currentPass.expiryDate}</span>
                        </div>
                      </div>

                      {/* Custom Host Fields Display */}
                      {Object.keys(currentPass.customFields).length > 0 && (
                        <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Host Registration Fields
                          </span>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {Object.entries(currentPass.customFields).map(([k, v]) => (
                              <span
                                key={k}
                                className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300"
                              >
                                <strong className="capitalize text-slate-400">{k}:</strong> {v}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: QR Code & Digital Stamp */}
                    <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/10 shrink-0 text-center w-full md:w-auto">
                      <div className="p-2 bg-white rounded-xl shadow-inner">
                        <img
                          src={currentPass.qrCodeDataUrl}
                          alt="Pass Verification QR"
                          className="h-44 w-44 object-contain rounded-lg"
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 mt-2 font-medium">Scan to Verify Identity</span>

                      {/* Digital Stamp Token */}
                      <div className="mt-3 w-full max-w-[200px] bg-slate-950/80 border border-emerald-500/30 rounded-lg p-2 text-center">
                        <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-400 font-bold uppercase">
                          <Lock className="h-3 w-3" /> Digital Stamp Valid
                        </div>
                        <div className="font-mono text-[9px] text-slate-400 truncate mt-0.5" title={currentPass.digitalStamp}>
                          {currentPass.digitalStamp.substring(0, 18)}...
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pass Footer */}
                  <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-400" />
                      <span>Certified by Gemma 4 Intelligence & Cryptographic Key</span>
                    </div>
                    <span>Non-transferable • Host Verified</span>
                  </div>
                </div>

                {/* Action Buttons: Email, Print, Test Stamp */}
                <div className="space-y-3 bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleSendEmail}
                        disabled={isSendingEmail}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-md shadow-blue-600/20"
                        title="Send via Server Dispatcher (SMTP if configured, or In-App Outbox)"
                      >
                        {isSendingEmail ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Dispatching...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Dispatch to {currentPass.email}
                          </>
                        )}
                      </button>

                      {/* Direct Gmail / Email Client Mailto Link */}
                      <a
                        href={`mailto:${encodeURIComponent(currentPass.email)}?subject=${encodeURIComponent(
                          `Your Verified Onboarding Pass Card for ${currentPass.hostOrg} [ID: ${currentPass.id}]`
                        )}&body=${encodeURIComponent(
                          `Hello ${currentPass.fullName},\n\nHere is your official verified onboarding pass card for ${currentPass.hostOrg}.\n\nPass ID: ${currentPass.id}\nRole: ${currentPass.role}\nValid Until: ${currentPass.expiryDate}\n\nDigital Stamp: ${currentPass.digitalStamp}\n\nSecurity Status: Cryptographically verified and tamper-proof.\n\nWelcome message:\n"${currentPass.aiVerification?.welcomeMessage || 'Welcome aboard!'}"`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-md shadow-emerald-600/20"
                        title="Opens your device's Gmail or Mail client with the email pre-composed"
                      >
                        <Mail className="h-4 w-4" />
                        Send from Your Gmail / Mail App
                      </a>

                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.download = `${currentPass.fullName.replace(/\s+/g, '_')}_pass_qr.png`;
                          link.href = currentPass.qrCodeDataUrl;
                          link.click();
                        }}
                        className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                        title="Download Pass QR Code Image"
                      >
                        <Download className="h-4 w-4" /> Save QR Image
                      </button>

                      <button
                        onClick={() => window.print()}
                        className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                      >
                        <Printer className="h-4 w-4" /> Print Pass
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setTamperedPass({
                          fullName: currentPass.fullName,
                          email: currentPass.email,
                          role: currentPass.role,
                          hostOrg: currentPass.hostOrg,
                          digitalStamp: currentPass.digitalStamp,
                        });
                        setActiveTab('verify');
                      }}
                      className="px-4 py-2.5 bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Test Anti-Forgery Sandbox
                    </button>
                  </div>

                  {/* Informational delivery note */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                      Tip: Use <strong>"Send from Your Gmail / Mail App"</strong> to deliver directly from your personal mailbox, or configure SMTP credentials in <code className="text-blue-300 font-mono">.env</code> for automated server dispatch.
                    </span>
                    <button
                      onClick={() => setActiveTab('emails')}
                      className="text-blue-400 hover:underline shrink-0 ml-2"
                    >
                      View Dispatched Log →
                    </button>
                  </div>
                </div>

                {emailStatus && (
                  <div
                    className={`p-4 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                      emailStatus.success
                        ? 'bg-blue-950/70 border border-blue-500/40 text-blue-200'
                        : 'bg-red-950/70 border border-red-500/40 text-red-200'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">{emailStatus.message}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        You can view the full HTML pass email in the <strong>Dispatched Emails</strong> tab, or click "Send from Your Gmail / Mail App" above.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('emails')}
                      className="underline font-semibold text-blue-300 hover:text-white shrink-0"
                    >
                      Open Email Log
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ANTI-FORGERY STAMP CHECKER */}
        {activeTab === 'verify' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-3 pb-6 border-b border-slate-800">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Digital Stamp & Anti-Forgery Station</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Verify whether a pass card is 100% genuine or if the data has been altered/forged.
                  </p>
                </div>
              </div>

              {/* Explanation box */}
              <div className="my-6 bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-2">
                <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Lock className="h-4 w-4" /> How the Digital Stamp protects against forgery:
                </p>
                <p className="text-slate-400">
                  When a pass card is issued, a secret cryptographic signature (HMAC SHA-256) is minted combining the user's name, email, role, host organization, and validity dates. Even if someone inspects or edits the visual card, the mathematical stamp cannot be forged without the host's private signing key.
                </p>
              </div>

              {/* Tamper testing playground */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Live Data Inspector (Try modifying any field to simulate a forgery attempt!)
                  </span>

                  {currentPass && (
                    <button
                      type="button"
                      onClick={() => {
                        setTamperedPass({
                          fullName: currentPass.fullName,
                          email: currentPass.email,
                          role: currentPass.role,
                          hostOrg: currentPass.hostOrg,
                          digitalStamp: currentPass.digitalStamp,
                        });
                        setVerifyResult(null);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> Reset to Original Pass
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Pass Card Name</label>
                    <input
                      type="text"
                      value={tamperedPass.fullName}
                      onChange={e => setTamperedPass({ ...tamperedPass, fullName: e.target.value })}
                      placeholder="Full Name"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Pass Card Email</label>
                    <input
                      type="text"
                      value={tamperedPass.email}
                      onChange={e => setTamperedPass({ ...tamperedPass, email: e.target.value })}
                      placeholder="Email"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Pass Card Role</label>
                    <input
                      type="text"
                      value={tamperedPass.role}
                      onChange={e => setTamperedPass({ ...tamperedPass, role: e.target.value })}
                      placeholder="Role (try changing to VIP Host or Executive)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Host Organization</label>
                    <input
                      type="text"
                      value={tamperedPass.hostOrg}
                      onChange={e => setTamperedPass({ ...tamperedPass, hostOrg: e.target.value })}
                      placeholder="Host Organization"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Digital Stamp Signature (Hex)
                  </label>
                  <input
                    type="text"
                    value={tamperedPass.digitalStamp}
                    onChange={e => setTamperedPass({ ...tamperedPass, digitalStamp: e.target.value })}
                    placeholder="Signature hash"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={handleVerifyStamp}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                  >
                    <ShieldCheck className="h-4 w-4" /> Run Digital Stamp Verification
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTamperedPass(prev => ({ ...prev, role: 'IMPOSTER / VIP EXECUTIVE (MODIFIED)' }));
                      setVerifyResult(null);
                    }}
                    className="px-4 py-2.5 bg-red-950/60 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-xl text-xs font-medium transition"
                  >
                    ⚡ Simulate Forged Role (Tamper Test)
                  </button>
                </div>

                {/* Verification Outcome */}
                {verifyResult && (
                  <div
                    className={`mt-6 p-5 rounded-2xl border transition-all ${
                      verifyResult.verified
                        ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                        : 'bg-red-950/60 border-red-500/60 text-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {verifyResult.verified ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <h4 className="font-bold text-sm">
                          {verifyResult.verified
                            ? 'PASS CARD VERIFIED AUTHENTIC'
                            : 'FORGERY / TAMPERING DETECTED!'}
                        </h4>
                        <p className="text-xs mt-1 text-slate-300">{verifyResult.message}</p>
                        <p className="text-[11px] font-mono mt-2 opacity-80">Status: {verifyResult.status}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: HOST FIELD CONFIGURATOR */}
        {activeTab === 'fields' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-blue-400" />
                    Host Requirements & Field Customizer
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Modify the onboarding questions to fit your specific event, office, hospital, or organization.
                  </p>
                </div>
              </div>

              {/* Host Organization Name */}
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Host Organization / Event Name
                  </label>
                  <input
                    type="text"
                    value={hostOrg}
                    onChange={e => setHostOrg(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* AI Field Assistant by Gemma 4 */}
                <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-500/20 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-300">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    Ask Gemma 4 to Suggest Relevant Fields
                  </div>
                  <p className="text-xs text-slate-400">
                    Tell Gemma what kind of host you are (e.g. "Music Festival", "Hospital Visitor", "University Dormitory", "Coworking Space") and it will configure relevant questions for your onboarding pass card.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={suggestInput}
                      onChange={e => setSuggestInput(e.target.value)}
                      placeholder="e.g. BioTech Summit, Gym Member, VIP Lounge"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleSuggestFields}
                      disabled={isSuggesting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {isSuggesting ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Suggesting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" /> Suggest Fields
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Field List */}
                <div className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Active Onboarding Fields ({customFields.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddManualField}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Field
                    </button>
                  </div>

                  {customFields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex-1 space-y-2 w-full">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={field.label}
                            onChange={e => {
                              const updated = [...customFields];
                              updated[idx].label = e.target.value;
                              setCustomFields(updated);
                            }}
                            className="bg-transparent border-b border-slate-700 font-medium text-sm text-slate-200 focus:outline-none focus:border-blue-400 py-0.5 flex-1"
                          />
                          <span className="text-[10px] font-mono text-slate-500 uppercase px-2 py-0.5 rounded bg-slate-800">
                            {field.type}
                          </span>
                        </div>

                        {field.options && (
                          <div className="text-[11px] text-slate-400">
                            Options: {field.options.join(', ')}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={e => {
                              const updated = [...customFields];
                              updated[idx].required = e.target.checked;
                              setCustomFields(updated);
                            }}
                            className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                          />
                          Required
                        </label>

                        <button
                          type="button"
                          onClick={() => handleRemoveField(field.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => setActiveTab('onboard')}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition"
                  >
                    Done & Return to Onboarding Form
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DISPATCHED EMAILS INBOX PREVIEW */}
        {activeTab === 'emails' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Dispatched Pass Card Emails</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Review all pass cards sent to users' email addresses.
                    </p>
                  </div>
                </div>
                <button
                  onClick={fetchEmails}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>

              {/* Informative Explanation of Email Delivery */}
              <div className="my-6 bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                <p className="font-semibold text-blue-300 flex items-center gap-1.5">
                  <Mail className="h-4 w-4" /> Why do emails show here?
                </p>
                <p className="text-slate-400">
                  By default, pass cards are saved to this <strong>In-App Email Outbox</strong> so you can inspect the exact HTML pass card as formatted.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <strong className="text-slate-200 block mb-1">Option 1: Send from Your Gmail / Mail App</strong>
                    <span className="text-slate-400 text-[11px]">
                      On Tab 2, click <em>"Send from Your Gmail / Mail App"</em>. This instantly opens your device's email composer with recipient, pass ID, and verification ready to send!
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <strong className="text-slate-200 block mb-1">Option 2: Automated Server SMTP</strong>
                    <span className="text-slate-400 text-[11px]">
                      To send directly from the server to external mailboxes, configure SMTP credentials (e.g. Gmail App Password, SendGrid, or Brevo) in your <code className="text-blue-300 font-mono">.env</code> file.
                    </span>
                  </div>
                </div>
              </div>

              {sentEmails.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Mail className="h-10 w-10 text-slate-600 mx-auto" />
                  <p className="text-sm text-slate-400">No emails dispatched yet.</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Generate a pass card on Tab 1 and click "Send to User's Email" to test the email dispatch.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {sentEmails.map(email => (
                    <div
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        selectedEmail?.id === email.id
                          ? 'bg-blue-950/40 border-blue-500/60'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-200">{email.to}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
                            Delivered
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{email.subject}</p>
                        <p className="text-[11px] text-slate-500">{email.timestamp} • Pass: {email.passId}</p>
                      </div>

                      <button className="text-xs text-blue-400 flex items-center gap-1">
                        Preview <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Email Inspector Modal / Box */}
              {selectedEmail && (
                <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Email HTML Preview (As seen in User Inbox)
                    </span>
                    <button
                      onClick={() => setSelectedEmail(null)}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      Close Preview
                    </button>
                  </div>

                  <div className="bg-slate-100 text-slate-900 rounded-2xl p-6 shadow-xl overflow-hidden">
                    <div className="border-b border-slate-300 pb-3 mb-4 text-xs text-slate-600 space-y-1">
                      <p><strong>To:</strong> {selectedEmail.to}</p>
                      <p><strong>Subject:</strong> {selectedEmail.subject}</p>
                      <p><strong>Date:</strong> {selectedEmail.timestamp}</p>
                    </div>

                    <div
                      dangerouslySetInnerHTML={{ __html: selectedEmail.previewHtml }}
                      className="bg-white rounded-xl p-4 shadow-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>
          Gemma 4 PassCard System • Google AI Studio (API) & Local Ollama Support • Tamper-Proof Cryptographic Stamps
        </p>
      </footer>
    </div>
  );
}
