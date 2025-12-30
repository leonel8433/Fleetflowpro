
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getRouteInsights = async (origin: string, destination: string, lat?: number, lng?: number) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide a detailed route summary for a trip from ${origin} to ${destination}. Mention estimated traffic patterns and any points of interest for professional drivers.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: lat && lng ? { latitude: lat, longitude: lng } : undefined
          }
        }
      },
    });

    return {
      text: response.text,
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Error fetching route insights:", error);
    return { text: "Error fetching route details. Please check your network.", grounding: [] };
  }
};

export const getOptimizedRoute = async (origin: string, destination: string, waypoints: string[] = []) => {
  try {
    const waypointsStr = waypoints.length > 0 ? ` passing through ${waypoints.join(', ')}` : '';
    const prompt = `As a logistics expert, optimize the route from ${origin} to ${destination}${waypointsStr}. 
    Analyze current traffic conditions and distance to suggest the most efficient sequence of stops or alternative paths. 
    Focus on fuel saving and time efficiency. Mention specific roads if possible.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    return {
      text: response.text,
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Error optimizing route:", error);
    return { text: "Falha ao otimizar a rota. Tente novamente em instantes.", grounding: [] };
  }
};

export const getFleetStatsAnalysis = async (fleetData: any) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this fleet data and provide 3 key management insights: ${JSON.stringify(fleetData)}`,
    });
    return response.text;
  } catch (error) {
    return "Insights unavailable at the moment.";
  }
};
