import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

const ADMIN_EMAIL = "monsanto.bryann@gmail.com";

export default function LoginSupabase() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Handle the OAuth redirect on page load
    const handleAuthRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (session.user.email === ADMIN_EMAIL) {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
      }
    };
    
    handleAuthRedirect();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        if (session.user.email === ADMIN_EMAIL) {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    
    try {
      // For Safari, use full redirect without popup
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          skipBrowserRedirect: false, // Important for Safari
          queryParams: {
            access_type: "offline",
            prompt: "select_account", // Forces account selection
          },
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src="/musubi.png" alt="Spam Musubi" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#0a0a0a]" />
      </div>

      <div className="relative z-10 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
        <div className="mb-8">
          <div className="text-6xl mb-4">🍱</div>
          <h1 className="text-3xl font-black text-white">Nori‑+
            Knot</h1>
          <p className="text-white/50 mt-2 text-sm">Sign in to reserve your Spam Musubi</p>
        </div>

        {error && <div className="text-red-400 text-sm text-center animate-pulse mb-4">{error}</div>}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-3 border border-white/20 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? "Redirecting..." : "Sign in with Google"}
        </button>

        <p className="text-white/30 text-xs text-center mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}