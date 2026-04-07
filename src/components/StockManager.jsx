import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const StockManager = ({ onClose }) => {
  const [stock, setStock] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const PRODUCTS = [
    { id: "classic", name: "Classic Spam Musubi" },
    { id: "kimchi", name: "Kimchi Musubi" },
    { id: "cheesy", name: "Cheesy Musubi" },
    { id: "katsubi", name: "Katsubi" },
    { id: "ricebowl", name: "🍚 Rice Bowl Musubi" },
  ];

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, stock');
        if (error) throw error;
        const stockData = {};
        data.forEach(product => {
          stockData[product.id] = product.stock || 0;
        });
        setStock(stockData);
      } catch (error) {
        console.error("Error fetching stock:", error);
        alert("Failed to load stock. Please refresh.");
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, []);

  const updateStock = (productId, newValue) => {
    setStock(prev => ({ ...prev, [productId]: Math.max(0, newValue) }));
  };

  const saveAllStock = async () => {
    setSaving(true);
    try {
      // Update each product's stock in the database
      for (const [productId, stockValue] of Object.entries(stock)) {
        const { error } = await supabase
          .from('products')
          .update({ stock: stockValue })
          .eq('id', productId);
        if (error) throw error;
      }
      alert("Stock saved successfully!");
      onClose();
    } catch (error) {
      console.error("Error saving stock:", error);
      alert("Failed to save stock. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-black text-amber-400">📦 Manage Stock Levels</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl">✕</button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-white/40">Loading...</div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {PRODUCTS.map(product => (
                <div key={product.id} className="flex justify-between items-center">
                  <span className="text-white text-sm">{product.name}</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateStock(product.id, (stock[product.id] || 0) - 1)}
                      className="w-8 h-8 rounded-lg bg-white/10 text-white hover:bg-white/20"
                    >
                      -
                    </button>
                    <span className="text-white font-bold w-12 text-center">{stock[product.id] || 0}</span>
                    <button
                      onClick={() => updateStock(product.id, (stock[product.id] || 0) + 1)}
                      className="w-8 h-8 rounded-lg bg-white/10 text-white hover:bg-white/20"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={saveAllStock}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-amber-400 text-black font-bold hover:bg-amber-300 transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default StockManager;