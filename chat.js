// Netlify Serverless Function
// Code Qubits - Gemini AI Backend

exports.handler = async function (event) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Method not allowed",
      }),
    };
  }

  // Get Gemini API Key from Netlify Environment Variables
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error:
          "Gemini API key is not configured. Add GEMINI_API_KEY in Netlify environment variables.",
      }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const message = String(body.message || "").trim();

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Message is required.",
        }),
      };
    }

    // Gemini model
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    // Previous conversation messages
    const history = Array.isArray(body.history) ? body.history.slice(-24) : [];

    const contents = [];

    for (const item of history) {
      if (
        !item ||
        !["user", "model"].includes(item.role) ||
        typeof item.text !== "string"
      )
        continue;

      contents.push({
        role: item.role,
        parts: [
          {
            text: item.text.slice(0, 12000),
          },
        ],
      });
    }

    // Current user message
    contents.push({
      role: "user",
      parts: [
        {
          text: message.slice(0, 12000),
        },
      ],
    });

    // Saved user memory
    const memory =
      typeof body.memory === "string" ? body.memory.slice(0, 5000).trim() : "";

    // Code Qubits personality and instructions
    const systemText = [
      "You are Code Qubits, a helpful, intelligent and friendly AI assistant.",

      "Answer accurately and clearly.",

      "Explain technical topics step by step whenever useful.",

      "Use simple language when explaining difficult concepts.",

      "Use the user's saved memory as context in future conversations.",

      "Do not claim to remember information that is not available in the supplied conversation or memory.",

      memory
        ? "User saved memory:\n" + memory
        : "No saved user memory was provided.",
    ].join("\n\n");

    // Gemini API request
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const upstream = await fetch(endpoint, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: systemText,
            },
          ],
        },

        contents: contents,

        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    const result = await upstream.json();

    // Handle Gemini API errors
    if (!upstream.ok) {
      const errorMessage =
        result?.error?.message || "Gemini API request failed.";

      return {
        statusCode: upstream.status,

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          error: errorMessage,
        }),
      };
    }

    // Extract AI response
    const reply = (result.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      throw new Error("Gemini returned an empty response.");
    }

    // Successful response
    return {
      statusCode: 200,

      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },

      body: JSON.stringify({
        reply: reply,
      }),
    };
  } catch (error) {
    console.error("Code Qubits Error:", error);

    return {
      statusCode: 500,

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        error: error.message || "Unexpected server error.",
      }),
    };
  }
};
