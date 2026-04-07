import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const ADMIN_EMAIL = "monsanto.bryann@gmail.com";
const CLOUD_NAME = "dvbbusgra";
const UPLOAD_PRESET = "spam_musubi_preset";

// Avatar component (fetches from profiles)
const Avatar = ({ userId, name, size = "w-8 h-8" }) => {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const fetchAvatar = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', userId)
          .single();
        setAvatarUrl(data?.avatar_url || null);
      } catch (err) {
        console.error("Error fetching avatar:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAvatar();
  }, [userId]);

  if (loading) return <div className={`${size} rounded-full bg-white/10 animate-pulse`} />;
  if (avatarUrl) return <img src={avatarUrl} alt={name} className={`${size} rounded-full object-cover`} />;

  const initials = name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";
  const colors = ["bg-amber-400", "bg-green-400", "bg-blue-400", "bg-purple-400", "bg-pink-400"];
  const color = colors[name?.charCodeAt(0) % colors.length] || "bg-amber-400";
  return (
    <div className={`${size} rounded-full ${color} flex items-center justify-center font-bold text-black text-sm flex-shrink-0`}>
      {initials}
    </div>
  );
};

// StarRating (same as original)
const StarRating = ({ rating, onRatingChange, size = "text-2xl", readonly = false }) => {
  const [hover, setHover] = useState(0);
  if (readonly) {
    return (
      <div className="flex gap-1">
        {[1,2,3,4,5].map(star => (
          <span key={star} className={`${size} ${star <= rating ? "text-amber-400" : "text-white/30"}`}>★</span>
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(star => (
        <button key={star} type="button" onClick={() => onRatingChange(star)} onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
          className={`${size} ${(hover || rating) >= star ? "text-amber-400" : "text-white/30"} transition-colors`}>★</button>
      ))}
    </div>
  );
};

// Rating distribution chart (unchanged)
const RatingDistribution = ({ reviews }) => {
  const distribution = {5:0,4:0,3:0,2:0,1:0};
  reviews.forEach(r => distribution[r.rating]++);
  const total = reviews.length;
  const maxCount = Math.max(...Object.values(distribution), 1);
  return (
    <div className="space-y-2 mb-6">
      {[5,4,3,2,1].map(star => {
        const count = distribution[star];
        const percent = total === 0 ? 0 : ((count/total)*100).toFixed(0);
        const barWidth = total === 0 ? 0 : (count/maxCount)*100;
        return (
          <div key={star} className="flex items-center gap-2 text-sm">
            <div className="w-12 text-amber-400 font-bold">{star} ★</div>
            <div className="flex-1 bg-white/10 rounded-full h-6 overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full" style={{ width: `${barWidth}%` }} />
            </div>
            <div className="w-16 text-white/70 text-right">{count} ({percent}%)</div>
          </div>
        );
      })}
    </div>
  );
};

const PublicReviews = ({ addToast }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Get current user from Supabase
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        setIsAdmin(session.user.email === ADMIN_EMAIL);
        setName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "Customer");
      } else {
        setName("");
      }
    };
    fetchUser();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      if (addToast) addToast("Failed to load reviews", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const openCloudinaryWidget = () => {
    if (!window.cloudinary) {
      alert("Cloudinary widget not loaded. Please refresh the page.");
      return;
    }
    setUploadingImage(true);
    window.cloudinary.openUploadWidget(
      { cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET, sources: ["local","camera"], cropping: true, multiple: false, maxFileSize: 5000000 },
      (error, result) => {
        setUploadingImage(false);
        if (error || result.event !== "success") return;
        setImageUrl(result.info.secure_url);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      (addToast || alert)("Please select a rating ⭐", "error");
      return;
    }
    if (!comment.trim()) {
      (addToast || alert)("Please write a comment 💬", "error");
      return;
    }
    if (!name.trim()) {
      (addToast || alert)("Please enter your name", "error");
      return;
    }
    setSubmitting(true);
    try {
      const reviewData = {
        user_id: currentUser?.id || null,
        user_name: name.trim(),
        rating,
        comment: comment.trim(),
        image_url: imageUrl || null,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('reviews').insert(reviewData);
      if (error) throw error;
      setRating(0);
      setComment("");
      setImageUrl("");
      if (addToast) addToast("Thank you for your review! We truly appreciate your presence. 🙏", "success");
      else alert("Thank you for your review!");
      fetchReviews();
    } catch (error) {
      console.error("Submit error:", error);
      if (addToast) addToast("Failed to submit. Please try again.", "error");
      else alert("Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteReview = async (reviewId) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this review?")) return;
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
      if (error) throw error;
      if (addToast) addToast("Review deleted", "info");
      fetchReviews();
    } catch (error) {
      console.error("Delete error:", error);
      if (addToast) addToast("Failed to delete review", "error");
    }
  };

  const avgRating = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0;
  const displayedReviews = showAll ? reviews : reviews.slice(0, 2);
  const hasMore = reviews.length > 2;

  return (
    <div className="bg-black/40 border border-white/10 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-black text-amber-400">⭐ Customer Reviews</h3>
        <div className="text-right">
          <p className="text-2xl font-bold text-amber-400">{avgRating}</p>
          <p className="text-white/40 text-xs">average • {reviews.length} reviews</p>
        </div>
      </div>
      {reviews.length > 0 && <RatingDistribution reviews={reviews} />}
      <form onSubmit={handleSubmit} className="mb-6 p-4 bg-white/5 rounded-xl">
        <p className="text-white/70 text-sm mb-3">Leave a review</p>
        <div className="space-y-3">
          <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-amber-400 focus:outline-none text-white text-sm" required />
          <StarRating rating={rating} onRatingChange={setRating} size="text-2xl" />
          <textarea placeholder="Share your experience with our musubi..." value={comment} onChange={(e) => setComment(e.target.value)} rows="3" className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-amber-400 focus:outline-none text-white text-sm" required />
          <div>
            <button type="button" onClick={openCloudinaryWidget} disabled={uploadingImage} className="w-full bg-white/10 text-white py-2 rounded-lg text-sm hover:bg-white/20 transition-all">
              {uploadingImage ? "Uploading..." : imageUrl ? "✅ Image uploaded" : "📸 Upload a photo (optional)"}
            </button>
            {imageUrl && (
              <div className="mt-2 relative inline-block">
                <img src={imageUrl} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
                <button type="button" onClick={() => setImageUrl("")} className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 text-white text-xs flex items-center justify-center">✕</button>
              </div>
            )}
          </div>
          <button type="submit" disabled={submitting} className="w-full bg-amber-400 text-black font-bold py-2 rounded-lg hover:bg-amber-300 transition-all disabled:opacity-50">
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      </form>
      {loading ? (
        <p className="text-white/40 text-center py-4">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-white/40 text-center py-4">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {displayedReviews.map((review) => (
            <div key={review.id} className="bg-white/5 rounded-xl p-3 relative">
              {isAdmin && (
                <button onClick={() => deleteReview(review.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs bg-black/50 px-1 rounded z-10">🗑️ Delete</button>
              )}
              <div className="flex gap-3">
                <Avatar userId={review.user_id} name={review.user_name} size="w-10 h-10" />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div><p className="font-bold text-white text-sm">{review.user_name}</p><StarRating rating={review.rating} readonly size="text-sm" /></div>
                    <p className="text-white/30 text-[10px]">{review.created_at ? new Date(review.created_at).toLocaleDateString() : "Recently"}</p>
                  </div>
                  <p className="text-white/70 text-sm mt-2">{review.comment}</p>
                  {review.image_url && <img src={review.image_url} alt="review" className="mt-2 w-24 h-24 object-cover rounded-lg" />}
                </div>
              </div>
            </div>
          ))}
          {hasMore && !showAll && <button onClick={() => setShowAll(true)} className="w-full mt-2 text-amber-400 text-sm hover:underline">Load more reviews ({reviews.length - 2} more)</button>}
          {showAll && hasMore && <button onClick={() => setShowAll(false)} className="w-full mt-2 text-white/40 text-sm hover:underline">Show less</button>}
        </div>
      )}
    </div>
  );
};

export default PublicReviews;