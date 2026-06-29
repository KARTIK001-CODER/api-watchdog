import Groq from 'groq-sdk';

const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY 
});

export async function diagnoseAPIFailure(
  serviceName: string, 
  statusCode: number, 
  history: number[]
): Promise<string> {
  const prompt = `
    You are a Senior Site Reliability Engineer. 
    The ${serviceName} API just failed with HTTP status ${statusCode}.
    The last 5 successful response times (ms) were: ${history.join(', ')}.
    
    Provide a concise analysis:
    1. 1-line root cause
    2. 1-line recommended fix
    3. 1-line severity level (LOW/MEDIUM/HIGH)
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are an expert SRE diagnosing API failures. Be concise and technical." 
        },
        { role: "user", content: prompt }
      ],
      model: "llama-3.3-70b-versatile",
      max_tokens: 200,
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content || "Analysis unavailable.";
  } catch (error) {
    console.error('Groq API error:', error);
    return "AI analysis temporarily unavailable.";
  }
}

export async function analyzeTrend(
  serviceName: string, 
  responseTimes: number[]
): Promise<string> {
  const prompt = `
    Analyze this trend for ${serviceName} API:
    Response times (ms): ${responseTimes.join(', ')}
    
    Predict if this service will fail in the next 10 minutes.
    Return exactly one of: "LIKELY TO FAIL", "DEGRADING", or "STABLE"
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You predict API reliability. Return exactly one of: LIKELY TO FAIL, DEGRADING, STABLE" },
        { role: "user", content: prompt }
      ],
      model: "llama-3.3-70b-versatile",
      max_tokens: 50,
      temperature: 0.2,
    });

    const result = completion.choices[0]?.message?.content || "STABLE";
    if (result.includes('LIKELY TO FAIL')) return 'LIKELY TO FAIL';
    if (result.includes('DEGRADING')) return 'DEGRADING';
    return 'STABLE';
  } catch (error) {
    console.error('Groq trend analysis error:', error);
    return "STABLE";
  }
}