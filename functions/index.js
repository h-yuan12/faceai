// functions/index.js

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const axios = require("axios");
const cors = require("cors")({origin: true});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// Function to analyze ingredient list via Cosmily API
exports.analyzeIngredientList = onRequest(async (req, res) => {
  // Handle CORS
  await new Promise((resolve) => {
    cors(req, res, resolve);
  });

  // Only allow POST requests
  if (req.method !== "POST") {
    res.status(405).json({message: "Method Not Allowed. Use POST."});
    return;
  }

  const {ingredients, ingredientGroup} = req.body;

  // Basic validation
  if (!ingredients || !ingredientGroup) {
    res.status(400).json({
      message: "Missing 'ingredients' or 'ingredientGroup' in request body.",
    });
    return;
  }

  try {
    // Fetch the access token from environment variables
    const ACCESS_TOKEN = "";

    // if (!ACCESS_TOKEN) {
    //   logger.error(
    //       "COSMILY_ACCESS_TOKEN is not set in environment variables.",
    //   );
    //   res.status(500).json({message: "Server configuration error."});
    //   return;
    // }

    // Make the request to Cosmily API
    const cosmilyResponse = await axios.post(
        "https://api.cosmily.com/api/v1/analyze/ingredient_list",
        {
          ingredients,
          ingredientGroup,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ACCESS_TOKEN}`,
          },
        },
    );

    // Forward the response from Cosmily API to the frontend
    res.status(cosmilyResponse.status).json(cosmilyResponse.data);
  } catch (error) {
    logger.error("Error communicating with Cosmily API:", error.message);

    if (error.response) {
      res.status(error.response.status).json({
        message: error.response.data.message || "Error from Cosmily API",
      });
    } else if (error.request) {
      // The request was made, but no response was received
      res.status(500).json({message: "No response from Cosmily API."});
    } else {
      // Something happened in setting up the request
      res.status(500).json({message:
        "Error setting up request to Cosmily API."});
    }
  }
});
