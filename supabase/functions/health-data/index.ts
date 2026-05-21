import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { device_id, heart_rate, spo2, temperature, latitude, longitude } = await req.json();

    if (!device_id) {
      return new Response(JSON.stringify({ error: "device_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify device exists
    const { data: device } = await supabase
      .from("devices")
      .select("user_id")
      .eq("device_id", device_id)
      .single();

    if (!device) {
      return new Response(JSON.stringify({ error: "Device not registered" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert health data
    const { error: insertError } = await supabase.from("health_data").insert({
      device_id,
      heart_rate,
      spo2,
      temperature,
      latitude,
      longitude,
    });

    if (insertError) throw insertError;

    // Update device last_sync
    await supabase
      .from("devices")
      .update({ last_sync: new Date().toISOString(), status: "connected" })
      .eq("device_id", device_id);

    // Check for abnormal vitals and create alert
    const isAbnormal =
      (heart_rate && (heart_rate > 120 || heart_rate < 50)) ||
      (spo2 && spo2 < 90) ||
      (temperature && (temperature > 38.5 || temperature < 35));

    if (isAbnormal) {
      const messages: string[] = [];
      if (heart_rate > 120) messages.push(`High heart rate: ${heart_rate} BPM`);
      if (heart_rate < 50) messages.push(`Low heart rate: ${heart_rate} BPM`);
      if (spo2 < 90) messages.push(`Low SpO2: ${spo2}%`);
      if (temperature > 38.5) messages.push(`High temperature: ${temperature}°C`);
      if (temperature < 35) messages.push(`Low temperature: ${temperature}°C`);

      await supabase.from("alerts").insert({
        user_id: device.user_id,
        message: `⚠️ Abnormal vitals detected: ${messages.join(", ")}`,
        severity: "high",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
