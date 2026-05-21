import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageSquare } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Feedback() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) {
      toast({ title: "Rating Required", description: "Please select a star rating.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const username = user?.user_metadata?.name || user?.email || "Anonymous";
      await api.post("/feedback", { rating, comment, username });
      toast({ title: "Feedback Submitted", description: "Thank you for your response!" });
      
      // Track GA Event
      const { trackEvent, AnalyticsCategory, AnalyticsAction } = await import("@/lib/analytics");
      trackEvent(AnalyticsCategory.FEEDBACK, AnalyticsAction.FEEDBACK_SUBMIT, `Rating: ${rating}`);

      setRating(0);
      setComment("");
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 py-10">
      <Card className="mx-auto max-w-2xl border-primary/20 bg-muted/30 dark:bg-primary/5 transition-all hover:shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">User Feedback</CardTitle>
          </div>
          <CardDescription className="text-foreground/70">Tell us how we're doing and how we can improve.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Overall Experience</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="p-1 transition-transform hover:scale-110 active:scale-95"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        (hover || rating) >= star
                          ? "fill-primary text-primary"
                          : "fill-transparent text-primary/20"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Your Suggestions</Label>
              <Textarea
                placeholder="What can we do better? (e.g. data visualization, speed, device support...)"
                className="min-h-[120px] bg-muted/40"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Feedback"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
