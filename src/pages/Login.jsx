import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

const ADMIN_EMAIL = "monsanto.bryann@gmail.com";

export default function LoginSupabase() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        redirectUser(session.user.email);
      }
    };
    checkSession();

    // Listen for auth changes (after magic link click)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        redirectUser(session.user.email);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const redirectUser = (email) => {
    if (email === ADMIN_EMAIL) {
      navigate("/admin", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      setMessage(`✨ Magic link sent to ${email}! Check your inbox (and spam folder).`);
      setEmail("");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src="/musubi.png" alt="Spam Musubi" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#0a0a0a]" />
      </div>
      <div className="relative z-10 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🍱</div>
          <h1 className="text-3xl font-black text-white">Nori-Knot</h1>
          <p className="text-white/50 mt-2 text-sm">Sign in to reserve your Spam Musubi</p>
        </div>

        {error && <div className="text-red-400 text-sm text-center animate-pulse mb-4">{error}</div>}
        {message && <div className="text-green-400 text-sm text-center mb-4">{message}</div>}

        <form onSubmit={handleMagicLink} className="space-y-4">
          <input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-white"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-400 hover:bg-amber-300 text-black font-bold py-3 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? "Sending..." : "📧 Send Magic Link"}
          </button>
        </form>

        <p className="text-white/30 text-xs text-center mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}