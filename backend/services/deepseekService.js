const axios = require('axios');

/**
 * DeepSeek AI Agent Service
 * Provides advanced clinical reasoning and conversational health advice.
 */
const queryDeepSeek = async ({ prompt, context = {} }) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  console.log("[DeepSeek Service] API Key detected:", apiKey ? `${apiKey.substring(0, 5)}***` : "MISSING");
  
  if (!apiKey || apiKey === 'your_deepseek_api_key_here' || apiKey.trim() === '') {
    throw new Error("DeepSeek API Key is missing. Please add it to your .env file.");
  }

  // Build the system prompt with user context
  const systemPrompt = `
    You are "Doctor AI", a high-precision medical informatics agent. 
    Your goal is to provide evidence-based clinical guidance and Ayurvedic lifestyle advice.
    
    USER CONTEXT:
    - Age: ${context.age || 'Unknown'}
    - Gender: ${context.gender || 'Unknown'}
    - Symptoms: ${context.symptoms || 'None'}
    - Blood Report: ${JSON.stringify(context.bloodReport || 'No report available')}
    - Skin Analysis: ${JSON.stringify(context.skinAnalysis || 'No skin scan available')}
    
    STRICT RULES:
    1. Always include a medical disclaimer.
    2. Focus on data-driven insights from the provided context.
    3. Provide actionable next steps (Medical + Ayurvedic).
    4. Keep the tone professional yet empathetic.
    5. Be concise.
  `;

  try {
    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("[DeepSeek Service] Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || "Failed to communicate with DeepSeek AI Agent.");
  }
};

module.exports = { queryDeepSeek };
