import React, { useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/AuthContext";

function normalizePhone(raw) {
  if (!raw) return raw;
  let digits = raw.replace(/[\s\-()]/g, '');
  let countryPrefix = '';
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
    if (digits.startsWith('420') && digits.length === 12) {
      countryPrefix = '+420';
      digits = digits.slice(3);
    } else {
      return raw.replace(/\s+/g, ' ').trim();
    }
  } else if (digits.startsWith('420') && digits.length === 12) {
    countryPrefix = '+420';
    digits = digits.slice(3);
  } else if (digits.length === 9 && /^\d{9}$/.test(digits)) {
    countryPrefix = '+420';
  } else {
    return raw;
  }
  const fmt = digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  return `${countryPrefix} ${fmt}`;
}

export default function Login() {
  const { reloadProfile } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "reset" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [registered, setRegistered] = useState(false);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setResetSent(false);
    setRegistered(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    console.log("[Login] Pokus o přihlášení:", email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("[Login] Chyba přihlášení:", error.message, error);
      setError("Špatný email nebo heslo.");
    } else {
      console.log("[Login] Auth OK — user ID:", data?.user?.id, "session:", !!data?.session);
    }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) {
      if (error.status === 429 || error.message?.toLowerCase().includes('security purposes')) {
        setError("Příliš mnoho pokusů. Vyčkejte prosím minutu a zkuste znovu.");
      } else {
        setError("Nepodařilo se odeslat email. Zkontrolujte adresu.");
      }
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Hesla se neshodují.");
      return;
    }
    if (password.length < 6) {
      setError("Heslo musí mít alespoň 6 znaků.");
      return;
    }

    setLoading(true);
    setError("");

    // 1. Ověřit duplicitu telefonu — nesmí být přiřazen jinému uživateli
    if (phone) {
      const normalized = normalizePhone(phone);
      const { data: workers } = await supabase
        .from('worker')
        .select('id')
        .eq('phone', normalized)
        .limit(1);

      if (workers?.length > 0) {
        const workerId = workers[0].id;
        const { data: existingUsers } = await supabase
          .from('users')
          .select('id')
          .eq('worker_profile_id', workerId)
          .limit(1);
        if (existingUsers?.length > 0) {
          setError("Toto telefonní číslo je již přiřazeno jinému účtu.");
          setLoading(false);
          return;
        }
      }
    }

    // 2. Vytvořit auth účet (phone uložíme do metadata pro případ onboardingu po potvrzení emailu)
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone: phone ? normalizePhone(phone) : null },
      },
    });
    if (signUpError) {
      const msg = signUpError.message?.toLowerCase() ?? '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError("Tento email je již registrován. Přihlaste se.");
      } else if (msg.includes('rate limit')) {
        setError("Příliš mnoho pokusů. Zkuste to za chvíli.");
      } else {
        setError("Registrace selhala: " + signUpError.message);
      }
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setError("Registrace selhala. Zkuste to znovu.");
      setLoading(false);
      return;
    }

    // Detekce duplicitního emailu — Supabase nevrátí chybu, ale vrátí prázdné identities
    if (authData.user.identities?.length === 0) {
      setError("Tento email je již registrován. Přihlaste se.");
      setLoading(false);
      return;
    }

    // 3. Zkusit najít shodu v tabulce worker podle telefonu
    let workerProfileId = null;
    if (phone) {
      const normalized = normalizePhone(phone);
      const { data: workers } = await supabase
        .from('worker')
        .select('id')
        .eq('phone', normalized)
        .limit(1);
      if (workers?.length > 0) {
        workerProfileId = workers[0].id;
      }
    }

    // 4. Upsert profilu v tabulce users
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    await supabase.from('users').upsert({
      id: userId,
      email,
      full_name: fullName,
      phone: normalizedPhone || null,
      app_role: workerProfileId ? 'installer' : 'pending',
      worker_profile_id: workerProfileId,
    });

    // Vynutit reload profilu, aby Layout viděl správný app_role hned po registraci
    await reloadProfile();

    setLoading(false);
    // Pokud session není null, onAuthStateChange automaticky přihlásí
    // Pokud session je null, Supabase vyžaduje potvrzení emailu
    setNeedsEmailConfirm(!authData.session);
    setRegistered(true);
  };

  // --- RESET MODE ---
  if (mode === "reset") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Obnovení hesla</h1>
          <p className="text-slate-500 mb-6">Zašleme vám odkaz pro nastavení nového hesla.</p>

          {resetSent ? (
            <div className="space-y-4">
              <p className="text-green-700 text-sm bg-green-50 px-3 py-3 rounded-lg">
                ✓ Email odeslán na <strong>{email}</strong>. Zkontrolujte schránku (i spam).
              </p>
              <button
                onClick={() => switchMode("login")}
                className="w-full text-blue-600 text-sm hover:underline"
              >
                Zpět na přihlášení
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="vas@email.cz"
                />
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Odesílám..." : "Odeslat odkaz"}
              </button>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full text-slate-500 text-sm hover:underline"
              >
                Zpět na přihlášení
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- REGISTER MODE ---
  if (mode === "register") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Registrace</h1>
          <p className="text-slate-500 mb-6">Vytvořte si účet pro přístup do aplikace.</p>

          {registered ? (
            <div className="space-y-4">
              {needsEmailConfirm ? (
                <>
                  <p className="text-green-700 text-sm bg-green-50 px-3 py-3 rounded-lg">
                    ✓ Registrace proběhla úspěšně! Zkontrolujte svůj email a potvrďte účet kliknutím na odkaz.
                  </p>
                  <button
                    onClick={() => switchMode("login")}
                    className="w-full text-blue-600 text-sm hover:underline"
                  >
                    Zpět na přihlášení
                  </button>
                </>
              ) : (
                <p className="text-green-700 text-sm bg-green-50 px-3 py-3 rounded-lg">
                  ✓ Registrace proběhla úspěšně! Přihlašujeme vás…
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Celé jméno</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jan Novák"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="vas@email.cz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Telefonní číslo
                  <span className="text-slate-400 font-normal ml-1">(pro propojení s profilem)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+420 777 123 456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Heslo</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="min. 6 znaků"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Potvrdit heslo</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Registruji..." : "Zaregistrovat se"}
              </button>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full text-slate-500 text-sm hover:underline"
              >
                Již mám účet — přihlásit se
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- LOGIN MODE ---
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Přihlášení</h1>
        <p className="text-slate-500 mb-6">Project Management</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="vas@email.cz"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-slate-700">Heslo</label>
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="text-xs text-blue-600 hover:underline"
              >
                Zapomněli jste heslo?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Přihlašuji..." : "Přihlásit se"}
          </button>
        </form>
        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => switchMode("register")}
            className="text-sm text-blue-600 hover:underline"
          >
            Nemáte účet? Zaregistrujte se
          </button>
        </div>
      </div>
    </div>
  );
}
