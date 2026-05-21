import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/' || location.pathname.startsWith('/admin')) return null;

  return (
    <Button 
      variant="outline" 
      size="icon" 
      onClick={() => navigate(-1)} 
      className="fixed bottom-6 right-6 z-50 rounded-full shadow-premium bg-background/80 backdrop-blur-md hover:scale-105 active:scale-95 transition-all w-12 h-12 border-primary/20"
      title="Go back"
    >
      <ArrowLeft className="h-6 w-6 text-primary" />
    </Button>

  );
}
