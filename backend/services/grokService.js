const axios = require('axios');

/**
 * Grok AI Service
 * Uses the xAI OpenAI-compatible chat completions endpoint.
 */
const queryGrok = async (userInput) => {
  console.log("[Grok] Doctor AI route hit");
  console.log("[Grok] Prompt:", userInput);

  const apiKey = process.env.GROK_API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      message: "Grok API Key is missing. Please add GROK_API_KEY to your .env file."
    };
  }

  // Handle both string input and object input (from aiAgentRoutes)
  const promptText = typeof userInput === 'string' ? userInput : userInput?.prompt || JSON.stringify(userInput);

  if (!promptText || promptText.trim() === '') {
    return {
      success: false,
      message: "Prompt is required"
    };
  }

  const requestBody = {
    model: "grok-3-mini-fast",
    messages: [
      {
        role: "system",
        content: "You are an expert AI medical doctor. Analyze symptoms, blood reports, and health data. Provide structured medical insights, precautions, and suggestions. Always remind the user to consult a real doctor for serious conditions."
      },
      {
        role: "user",
        content: promptText
      }
    ],
    temperature: 0.3
  };

  try {
    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiReply = response.data?.choices?.[0]?.message?.content;
    
    if (!aiReply) {
      console.error("[Grok] Unexpected response shape:", JSON.stringify(response.data).slice(0, 500));
      return {
        success: false,
        message: "Received empty response from Grok AI."
      };
    }

    return {
      success: true,
      reply: aiReply
    };
  } catch (error) {
    const errData = error.response?.data;
    const errMsg = typeof errData === 'string'
      ? errData
      : errData?.error?.message || errData?.message || error.message || "Unknown Grok API error";
    
    console.error("[Grok Service] Error:", errMsg);
    return {
      success: false,
      message: `AI request failed: ${errMsg}`
    };
  }
};

module.exports = { queryGrok };
