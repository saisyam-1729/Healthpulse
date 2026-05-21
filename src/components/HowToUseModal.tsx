import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyRound, ClipboardList, Smartphone, LayoutDashboard, Bell, Volume2, VolumeX } from "lucide-react";

const stepIcons = [KeyRound, ClipboardList, Smartphone, LayoutDashboard, Bell];
const stepColors = [
  "bg-blue-500/10 text-blue-600",
  "bg-green-500/10 text-green-600",
  "bg-orange-500/10 text-orange-600",
  "bg-primary/10 text-primary",
  "bg-red-500/10 text-red-600",
];

export default function HowToUseModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  const speak = useCallback(
    (text: string, idx: number) => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        if (speakingIdx === idx) {
          setSpeakingIdx(null);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.onend = () => setSpeakingIdx(null);
        window.speechSynthesis.speak(utterance);
        setSpeakingIdx(idx);
      }
    },
    [speakingIdx]
  );

  const steps = Array.from({ length: 5 }, (_, i) => ({
    icon: stepIcons[i],
    color: stepColors[i],
    title: t(`howToUse.step${i + 1}Title`),
    desc: t(`howToUse.step${i + 1}Desc`),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold text-center">
            {t("howToUse.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-card hover:bg-muted/50 transition-colors"
              >
                <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${step.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{`${i + 1}. ${step.title}`}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                </div>
                <button
                  onClick={() => speak(`${step.title}. ${step.desc}`, i)}
                  className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                  title={speakingIdx === i ? t("howToUse.stop") : t("howToUse.listen")}
                >
                  {speakingIdx === i ? (
                    <VolumeX className="h-4 w-4 text-destructive" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <Button
          onClick={() => {
            window.speechSynthesis.cancel();
            onOpenChange(false);
          }}
          className="w-full mt-4 rounded-xl h-12 text-base font-bold shadow-lg shadow-primary/20"
        >
          {t("howToUse.close")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
