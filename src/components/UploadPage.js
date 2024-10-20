// src/components/UploadPage.js

import React, { useState, useEffect, useRef, useMemo } from 'react';
import './UploadPage.css';
import { app as firebaseApp } from '../firebase.js';
import { getVertexAI, getGenerativeModel } from 'firebase/vertexai-preview';
import axios from 'axios';

import allIngredients from './data/all_ingredients.json'; // Importing the ingredients data

// Initialize Vertex AI and Gemini Model
const vertexAI = getVertexAI(firebaseApp);
const model = getGenerativeModel(vertexAI, { model: 'gemini-1.5-flash' });

// Define Skin Traits and Their Possible Levels
const TRAITS = {
  acne: ['clear', 'mild', 'moderate', 'significant'],
  oiliness: ['balanced', 'high', 'low'],
  pigmentation: ['none', 'mild', 'moderate', 'pronounced'],
  wrinkles: ['none', 'early'],
};

/**
 * Formats a string by removing underscores and capitalizing each word.
 * @param {string} str - The string to format.
 * @returns {string} - The formatted string.
 */
const formatPropertyName = (str) => {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Returns a CSS class based on the integer value.
 * @param {number} value - The integer value (0-4).
 * @returns {string} - The corresponding CSS class.
 */
const getClassForValue = (value) => {
  return `color-${value}`;
};

/**
 * Function to map EWG decision to safety class.
 * (Existing function retained)
 */
const getSafetyClass = (decision) => {
  if (decision.includes('Safe') && !decision.includes('hazard')) {
    return 'safety-safe';
  } else if (decision.includes('Safe - Low hazard')) {
    return 'safety-lightgreen';
  } else if (
    decision.includes('Safe - Moderate hazard') ||
    decision.includes('Fair') ||
    decision.includes('Limited')
  ) {
    return 'safety-moderate';
  } else if (decision.includes('Moderate hazard')) {
    return 'safety-warning';
  } else if (decision.includes('Unsafe') || decision.includes('High hazard')) {
    return 'safety-unsafe';
  } else {
    return 'safety-unknown';
  }
};

function UploadPage() {
  // State Variables
  const [image, setImage] = useState(null); // Data URL of the image
  const [displayImage, setDisplayImage] = useState(null); // For image preview
  const [loading, setLoading] = useState(false);
  const [skinIssues, setSkinIssues] = useState('');
  const [chatMessages, setChatMessages] = useState([]); // Chat messages between user and Gemini
  const [userInput, setUserInput] = useState(''); // User's chat input
  const [opencvLoaded, setOpencvLoaded] = useState(false); // State to track OpenCV loading

  // **State for Product Recommendations**
  const [productRecommendations, setProductRecommendations] = useState([]); // Product recommendations

  // **State to Track Conversation Steps**
  const [conversationStep, setConversationStep] = useState('initial'); // 'initial', 'confirm', 'specifications', 'chat'

  // **State for Image Zoom**
  const [isZoomed, setIsZoomed] = useState(false);

  // **State for Selected Traits**
  const [selectedTraits, setSelectedTraits] = useState({
    acne: 'clear',
    oiliness: 'balanced',
    pigmentation: 'none',
    wrinkles: 'none',
  });

  // **State for Ingredient Details**
  const [ingredientDetails, setIngredientDetails] = useState([]); // Ingredient details with benefits and risks

  // **State for Selected Ingredient (for Modal)**
  const [selectedIngredient, setSelectedIngredient] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // **Refs for Real-time Ingredient Detection**
  const wordBufferRef = useRef([]); // Buffer to hold recent words
  const foundIngredientsRef = useRef(new Set()); // Set to track found ingredients

  // **Preprocess Ingredient Titles for Efficient Searching**
  const titlesByWordCount = useMemo(() => {
    const map = new Map();
    allIngredients.forEach((ingredient) => {
      const title = ingredient.title.toLowerCase();
      const wordCount = title.split(/\s+/).length;
      if (!map.has(wordCount)) {
        map.set(wordCount, new Set());
      }
      map.get(wordCount).add(title);
    });
    return map;
  }, []);

  const maxWords = useMemo(() => {
    let max = 1;
    allIngredients.forEach((ingredient) => {
      const wordCount = ingredient.title.split(/\s+/).length;
      if (wordCount > max) max = wordCount;
    });
    return max;
  }, []);

  const titleToIngredientMap = useMemo(() => {
    const map = new Map();
    allIngredients.forEach((ingredient) => {
      map.set(ingredient.title.toLowerCase(), ingredient);
    });
    return map;
  }, []);

  // Auto-scroll to the bottom when messages update
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Load OpenCV.js
  useEffect(() => {
    const checkOpenCV = setInterval(() => {
      if (window.cv) {
        setOpencvLoaded(true);
        clearInterval(checkOpenCV);
      }
    }, 100);
    return () => clearInterval(checkOpenCV);
  }, []);

  /**
   * Handles the change event when a user selects an image.
   */
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataURL = reader.result; // Full data URL
        setImage(dataURL);
        setDisplayImage(URL.createObjectURL(file));
      };
      reader.readAsDataURL(file);
    } else {
      setImage(null);
      setDisplayImage(null);
    }
  };

  /**
   * Analyzes the image using OpenCV to detect multiple skin issues.
   */
  const analyzeImageWithOpenCV = () => {
    return new Promise((resolve, reject) => {
      if (!opencvLoaded) {
        reject('OpenCV is not loaded yet.');
        return;
      }
      try {
        const imgElement = new Image();
        imgElement.src = image;
        imgElement.crossOrigin = 'Anonymous'; // Handle CORS if needed
        imgElement.onload = () => {
          // Create a canvas to draw the image
          const canvas = document.createElement('canvas');
          canvas.width = imgElement.width;
          canvas.height = imgElement.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(imgElement, 0, 0);
          const imgData = ctx.getImageData(0, 0, imgElement.width, imgElement.height);

          // Convert image data to OpenCV Mat
          const src = window.cv.matFromImageData(imgData);

          // Convert to grayscale
          const gray = new window.cv.Mat();
          window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY, 0);

          // Apply Gaussian blur
          const blur = new window.cv.Mat();
          window.cv.GaussianBlur(
            gray,
            blur,
            new window.cv.Size(5, 5),
            0,
            0,
            window.cv.BORDER_DEFAULT
          );

          // **Acne Detection**
          // Use adaptive thresholding to find potential acne spots
          const binaryAcne = new window.cv.Mat();
          window.cv.adaptiveThreshold(
            blur,
            binaryAcne,
            255,
            window.cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            window.cv.THRESH_BINARY_INV,
            11,
            2
          );

          // Find contours (potential acne spots)
          const contoursAcne = new window.cv.MatVector();
          const hierarchyAcne = new window.cv.Mat();
          window.cv.findContours(
            binaryAcne,
            contoursAcne,
            hierarchyAcne,
            window.cv.RETR_CCOMP,
            window.cv.CHAIN_APPROX_SIMPLE
          );

          // Count the number of contours as an indicator
          const acneCount = contoursAcne.size();

          // **Oiliness/Dryness Detection**
          // Calculate average brightness
          const meanScalar = window.cv.mean(gray);
          const averageBrightness = meanScalar[0]; // Grayscale mean

          // **Pigmentation Detection**
          // Threshold to detect dark spots
          const binaryPigmentation = new window.cv.Mat();
          window.cv.threshold(
            gray,
            binaryPigmentation,
            60, // Threshold value
            255,
            window.cv.THRESH_BINARY_INV
          );

          // Find contours for pigmentation
          const contoursPigmentation = new window.cv.MatVector();
          const hierarchyPigmentation = new window.cv.Mat();
          window.cv.findContours(
            binaryPigmentation,
            contoursPigmentation,
            hierarchyPigmentation,
            window.cv.RETR_CCOMP,
            window.cv.CHAIN_APPROX_SIMPLE
          );

          const pigmentationCount = contoursPigmentation.size();

          // **Wrinkles Detection**
          // Use Canny edge detection
          const edges = new window.cv.Mat();
          window.cv.Canny(gray, edges, 100, 200, 3, false);

          // Calculate edge density
          const edgePixels = window.cv.countNonZero(edges);
          const totalPixels = edges.rows * edges.cols;
          const edgeDensity = (edgePixels / totalPixels) * 100; // Percentage

          // **Determine Skin Issues**
          let skinIssuesDescription = '';

          // Acne
          if (acneCount > 100) {
            skinIssuesDescription += 'Significant acne detected, ';
            setSelectedTraits((prev) => ({ ...prev, acne: 'significant' }));
          } else if (acneCount > 50) {
            skinIssuesDescription += 'Moderate acne detected, ';
            setSelectedTraits((prev) => ({ ...prev, acne: 'moderate' }));
          } else if (acneCount > 20) {
            skinIssuesDescription += 'Mild acne detected, ';
            setSelectedTraits((prev) => ({ ...prev, acne: 'mild' }));
          } else {
            skinIssuesDescription += 'Clear skin, ';
            setSelectedTraits((prev) => ({ ...prev, acne: 'clear' }));
          }

          // Oiliness/Dryness
          if (averageBrightness > 130) {
            skinIssuesDescription += 'High oiliness detected, ';
            setSelectedTraits((prev) => ({ ...prev, oiliness: 'high' }));
          } else if (averageBrightness < 70) {
            skinIssuesDescription += 'High dryness detected, ';
            setSelectedTraits((prev) => ({ ...prev, oiliness: 'low' }));
          } else {
            skinIssuesDescription += 'Balanced oiliness and dryness, ';
            setSelectedTraits((prev) => ({ ...prev, oiliness: 'balanced' }));
          }

          // Pigmentation
          if (pigmentationCount > 50) {
            skinIssuesDescription += 'Pronounced pigmentation detected, ';
            setSelectedTraits((prev) => ({ ...prev, pigmentation: 'pronounced' }));
          } else if (pigmentationCount > 20) {
            skinIssuesDescription += 'Moderate pigmentation detected, ';
            setSelectedTraits((prev) => ({ ...prev, pigmentation: 'moderate' }));
          } else if (pigmentationCount > 5) {
            skinIssuesDescription += 'Mild pigmentation detected, ';
            setSelectedTraits((prev) => ({ ...prev, pigmentation: 'mild' }));
          } else {
            skinIssuesDescription += 'No significant pigmentation, ';
            setSelectedTraits((prev) => ({ ...prev, pigmentation: 'none' }));
          }

          // Wrinkles
          if (edgeDensity > 15) {
            skinIssuesDescription += 'Early signs of wrinkles detected.';
            setSelectedTraits((prev) => ({ ...prev, wrinkles: 'early' }));
          } else {
            skinIssuesDescription += 'No visible wrinkles.';
            setSelectedTraits((prev) => ({ ...prev, wrinkles: 'none' }));
          }

          // Clean up
          src.delete();
          gray.delete();
          blur.delete();
          binaryAcne.delete();
          contoursAcne.delete();
          hierarchyAcne.delete();
          binaryPigmentation.delete();
          contoursPigmentation.delete();
          hierarchyPigmentation.delete();
          edges.delete();

          resolve(skinIssuesDescription);
        };
        imgElement.onerror = () => {
          reject('Error loading image for OpenCV processing.');
        };
      } catch (error) {
        reject(`OpenCV processing error: ${error.message}`);
      }
    });
  };

  /**
   * Handles the form submission to upload the image, analyze it, and get recommendations.
   */
  const handleUpload = async (e) => {
    e.preventDefault();

    if (!image) {
      alert('Please select an image to upload');
      return;
    }

    setLoading(true);
    setSkinIssues('');
    setProductRecommendations([]); // Reset product recommendations
    setChatMessages([]);
    setConversationStep('initial'); // Set to initial step
    setIngredientDetails([]); // Reset ingredient details
    wordBufferRef.current = [];
    foundIngredientsRef.current = new Set(); // Reset found ingredients

    try {
      // Analyze the image with OpenCV
      const skinAnalysis = await analyzeImageWithOpenCV();
      setSkinIssues(skinAnalysis);

      // Prepare data for Cosmify API based on skin issues
      const conditions = skinAnalysis.toLowerCase();

      const ingredientsSet = new Set();
      const ingredientGroups = new Set();

      if (conditions.includes('acne')) {
        ingredientsSet.add('Salicylic Acid');
        ingredientsSet.add('Benzoyl Peroxide');
        ingredientsSet.add('Tea Tree Oil');
        ingredientGroups.add('acne_treatment');
      }
      if (conditions.includes('oiliness') || conditions.includes('dryness')) {
        ingredientsSet.add('Niacinamide');
        ingredientsSet.add('Zinc PCA');
        ingredientsSet.add('Hyaluronic Acid');
        ingredientsSet.add('Glycerin');
        ingredientGroups.add('oil_control');
        ingredientGroups.add('hydration');
      }
      if (conditions.includes('pigmentation')) {
        ingredientsSet.add('Vitamin C');
        ingredientsSet.add('Niacinamide');
        ingredientGroups.add('brightening');
      }
      if (conditions.includes('wrinkles')) {
        ingredientsSet.add('Retinol');
        ingredientsSet.add('Peptides');
        ingredientGroups.add('anti-aging');
      }

      const ingredients = Array.from(ingredientsSet).join(', ');
      const ingredient_group = Array.from(ingredientGroups).join(',');

      console.log('Sending request to Cosmify API:', {
        ingredients,
        ingredientGroup: ingredient_group,
      });

      // const cosmifyResponse = await axios.post(
      //   BACKEND_FUNCTION_URL,
      //   {
      //     ingredients: ingredients,
      //     ingredientGroup: ingredient_group,
      //   },
      //   {
      //     headers: {
      //       'Content-Type': 'application/json',
      //     },
      //   }
      // );

      // console.log('Cosmify API Response:', cosmifyResponse);

      // let parsedData = cosmifyResponse.data;
      // if (typeof parsedData === 'string') {
      //   try {
      //     parsedData = JSON.parse(parsedData);
      //   } catch (parseError) {
      //     console.error('Error parsing Cosmify API response:', parseError);
      //     setLoading(false);
      //     return;
      //   }
      // }

      // if (cosmifyResponse.status === 200 || cosmifyResponse.status === 201) {
      //   console.log('Parsed Cosmify Response Data:', parsedData);

      //   // Process the response to extract product recommendations
      //   const ingredientsTable = parsedData.analysis.ingredients_table;

      //   const recommendations = [];

      //   if (Array.isArray(ingredientsTable)) {
      //     ingredientsTable.forEach((ingredient) => {
      //       if (ingredient.title) {
      //         recommendations.push(ingredient.title);
      //       }
      //     });
      //   }
        const recommendations = [];
        // Remove duplicates
        const uniqueRecommendations = [...new Set(recommendations)];
        setProductRecommendations(uniqueRecommendations); // **Set Product Recommendations**

        // **Set Initial Chat Messages with Evaluation Details**
        const initialEvaluationMessage = `This is what I got from your face, please edit anything that is wrong using the buttons below. Once you're satisfied, click "Confirm Traits" to proceed.`;

        setChatMessages([{ sender: 'Gemini', text: initialEvaluationMessage }]);
        setConversationStep('confirm'); // Move to confirmation step
      // } else {
      //   console.error('Unexpected response from Cosmify API:', parsedData);
      //   alert('Unexpected response from the recommendation service. Please try again later.');
      // }
    } catch (error) {
      console.error('Error:', error);
      if (error.response) {
        alert(`Error: ${error.response.status} - ${error.response.data.message || error.message}`);
      } else if (error.request) {
        alert('Error: No response received from the recommendation service.');
      } else {
        alert(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles sending a message to Gemini and receiving a response.
   */
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!userInput.trim()) {
      return;
    }

    const newMessages = [...chatMessages, { sender: 'User', text: userInput }];
    setChatMessages(newMessages);
    setUserInput('');
    setLoading(true);

    try {
      let prompt = '';

      if (conversationStep === 'confirm') {
        // User is confirming or correcting initial evaluation
        prompt = `User: ${userInput}\nGemini:`;
      } else if (conversationStep === 'specifications') {
        // User is providing specifications
        prompt = `User: ${userInput}\nGemini:`;
      } else {
        // General chat
        const context = newMessages.map((msg) => `${msg.sender}: ${msg.text}`).join('\n');

        // **Include Product Recommendations in Prompt**
        prompt = `${context}\nGemini: Based on the analysis and user preferences, please provide a detailed skincare routine. Make sure to include specific product recommendations for each step, and for each product, include the key ingredients used.`;
      }

      // **Check Conversation Steps**
      if (conversationStep === 'confirm') {
        // After confirmation, display specific text and proceed to specifications
        const responseText = `Based on your adjustments, here are the updated skin conditions:

- Acne: ${capitalize(selectedTraits.acne)}
- Oiliness/Dryness: ${capitalize(selectedTraits.oiliness)}
- Pigmentation: ${capitalize(selectedTraits.pigmentation)}
- Wrinkles: ${capitalize(selectedTraits.wrinkles)}

Is there any specifications before I start generating your skincare routine? Please let me know if you have any specific preferences or requirements.`;

        await displayTypingEffect(responseText);
        setConversationStep('specifications');
        setLoading(false);
        return;
      }

      if (conversationStep === 'specifications') {
        // After receiving specifications, acknowledge and proceed to generate skincare routine
        const responseText = `Great! Based on your specifications and the analysis of your skin, I'll generate a comprehensive skincare routine tailored just for you. Let's get started!`;

        await displayTypingEffect(responseText);
        setConversationStep('chat');

        // **Automatically Generate Skincare Routine After the Confirmation Message**
        await generateSkincareRoutine();

        setLoading(false);
        return;
      }

      // Generate content using the model
      const result = await model.generateContent(prompt, {
        temperature: 0.7,
        maxOutputTokens: 800,
      });

      console.log('Gemini API Response:', result); // Inspect the response structure

      // Safely extract the Gemini response using response.text()
      let geminiResponse = 'No response text received.';

      if (result.response && typeof result.response.text === 'function') {
        geminiResponse = await result.response.text();
        geminiResponse = geminiResponse.trim();
      } else {
        console.warn('response.text() is not a function or response is undefined.');
      }

      // Simulate typing effect with faster speed and real-time ingredient detection
      await displayTypingEffect(geminiResponse);
    } catch (error) {
      console.error('Error communicating with Gemini:', error);

      let errorMessage = 'Sorry, there was an error processing your request.';
      if (error.response) {
        errorMessage = `Error: ${error.response.status} - ${error.response.data.message || error.message}`;
      } else if (error.request) {
        errorMessage = 'Error: No response received from Gemini API.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }

      alert(errorMessage);

      setChatMessages([
        ...newMessages,
        {
          sender: 'Gemini',
          text: 'Sorry, there was an error processing your request.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Automatically generates the skincare routine by sending a prompt to Gemini.
   */
  const generateSkincareRoutine = async () => {
    setLoading(true);
    try {
      // **Include Confirmed Traits in the Prompt**
      const { acne, oiliness, pigmentation, wrinkles } = selectedTraits;

      const traitsDescription = `
Based on your confirmed skin conditions:
- Acne: ${capitalize(acne)}
- Oiliness/Dryness: ${capitalize(oiliness)}
- Pigmentation: ${capitalize(pigmentation)}
- Wrinkles: ${capitalize(wrinkles)}
`;

      const prompt = `Based on the following skin conditions:${traitsDescription}
and any additional user preferences, please provide a detailed skincare routine. Make sure to include specific product recommendations for each step, and for each product, include the key ingredients used. At the end of your response, provide a JSON list of ingredients for each product in the following format:

<JSON>{
  "products": [
    {
      "name": "Product 1",
      "ingredients": ["Ingredient A", "Ingredient B"]
    },
    {
      "name": "Product 2",
      "ingredients": ["Ingredient C", "Ingredient D"]
    }
  ]
}</JSON>`;

      // Generate content using the model
      const result = await model.generateContent(prompt, {
        temperature: 0.7,
        maxOutputTokens: 800,
      });

      console.log('Gemini API Response for Skincare Routine:', result); // Inspect the response structure

      // Safely extract the Gemini response using response.text()
      let geminiResponse = 'No response text received.';

      if (result.response && typeof result.response.text === 'function') {
        geminiResponse = await result.response.text();
        geminiResponse = geminiResponse.trim();
      } else {
        console.warn('response.text() is not a function or response is undefined.');
      }

      // Simulate typing effect with faster speed and real-time ingredient detection
      await displayTypingEffect(geminiResponse);
    } catch (error) {
      console.error('Error generating skincare routine:', error);

      let errorMessage = 'Sorry, there was an error generating your skincare routine.';
      if (error.response) {
        errorMessage = `Error: ${error.response.status} - ${error.response.data.message || error.message}`;
      } else if (error.request) {
        errorMessage = 'Error: No response received from Gemini API.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }

      alert(errorMessage);

      setChatMessages([
        ...chatMessages,
        {
          sender: 'Gemini',
          text: 'Sorry, there was an error generating your skincare routine.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Simulates a typing effect for Gemini's responses with adjustable speed and real-time ingredient detection.
   */
  const displayTypingEffect = async (text) => {
    const typingSpeed = 10; // Reduced milliseconds per character for faster display
    let displayedText = '';
    let currentWord = '';
    let i = 0;

    // Append a new Gemini message with empty text
    setChatMessages((prevMessages) => [...prevMessages, { sender: 'Gemini', text: '' }]);

    while (i < text.length) {
      // If the document is hidden, process the rest of the text immediately
      if (document.hidden) {
        const remainingText = text.substring(i);
        displayedText += remainingText;

        // Update the last Gemini message with the full text
        setChatMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          const lastIndex = updatedMessages.length - 1;
          if (updatedMessages[lastIndex]?.sender === 'Gemini') {
            updatedMessages[lastIndex].text = displayedText;
          } else {
            updatedMessages.push({ sender: 'Gemini', text: displayedText });
          }
          return updatedMessages;
        });

        // Process the remaining text for ingredient detection
        processTextForIngredients(remainingText);

        break;
      }

      const char = text.charAt(i);
      displayedText += char;

      // Check for word boundaries (space or punctuation)
      if (/\s|[.,!?;:]/.test(char)) {
        if (currentWord) {
          const lowerCaseWord = currentWord.toLowerCase();
          wordBufferRef.current.push(lowerCaseWord);
          if (wordBufferRef.current.length > maxWords) {
            wordBufferRef.current.shift();
          }

          // Check for matches in the titlesByWordCount
          for (let n = 1; n <= maxWords; n++) {
            if (wordBufferRef.current.length >= n) {
              const ngram = wordBufferRef.current.slice(-n).join(' ');
              if (titlesByWordCount.has(n) && titlesByWordCount.get(n).has(ngram)) {
                if (!foundIngredientsRef.current.has(ngram)) {
                  const ingredient = titleToIngredientMap.get(ngram);
                  if (
                    ingredient &&
                    (ingredient.introtext ||
                      ingredient.content ||
                      (ingredient.ewg && ingredient.ewg.decision))
                  ) {
                    setIngredientDetails((prev) => [...prev, ingredient]);
                    foundIngredientsRef.current.add(ngram);
                  }
                }
              }
            }
          }

          currentWord = '';
        }
      } else {
        currentWord += char;
      }

      // Update the last Gemini message with the new character
      setChatMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        const lastIndex = updatedMessages.length - 1;
        if (updatedMessages[lastIndex]?.sender === 'Gemini') {
          updatedMessages[lastIndex].text = displayedText;
        } else {
          updatedMessages.push({ sender: 'Gemini', text: displayedText });
        }
        return updatedMessages;
      });

      await new Promise((resolve) => setTimeout(resolve, typingSpeed));
      i++;
    }

    // After typing is complete, check if the last word needs to be processed
    if (currentWord) {
      const lowerCaseWord = currentWord.toLowerCase();
      wordBufferRef.current.push(lowerCaseWord);
      if (wordBufferRef.current.length > maxWords) {
        wordBufferRef.current.shift();
      }

      // Check for matches in the titlesByWordCount
      for (let n = 1; n <= maxWords; n++) {
        if (wordBufferRef.current.length >= n) {
          const ngram = wordBufferRef.current.slice(-n).join(' ');
          if (titlesByWordCount.has(n) && titlesByWordCount.get(n).has(ngram)) {
            if (!foundIngredientsRef.current.has(ngram)) {
              const ingredient = titleToIngredientMap.get(ngram);
              if (
                ingredient &&
                (ingredient.introtext ||
                  ingredient.content ||
                  (ingredient.ewg && ingredient.ewg.decision))
              ) {
                setIngredientDetails((prev) => [...prev, ingredient]);
                foundIngredientsRef.current.add(ngram);
              }
            }
          }
        }
      }
    }
  };

  /**
   * Processes text for ingredient detection.
   */
  const processTextForIngredients = (text) => {
    const words = text.split(/\s+/);
    words.forEach((word) => {
      const lowerCaseWord = word.toLowerCase();
      wordBufferRef.current.push(lowerCaseWord);
      if (wordBufferRef.current.length > maxWords) {
        wordBufferRef.current.shift();
      }
      // Check for matches in the titlesByWordCount
      for (let n = 1; n <= maxWords; n++) {
        if (wordBufferRef.current.length >= n) {
          const ngram = wordBufferRef.current.slice(-n).join(' ');
          if (titlesByWordCount.has(n) && titlesByWordCount.get(n).has(ngram)) {
            if (!foundIngredientsRef.current.has(ngram)) {
              const ingredient = titleToIngredientMap.get(ngram);
              if (
                ingredient &&
                (ingredient.introtext ||
                  ingredient.content ||
                  (ingredient.ewg && ingredient.ewg.decision))
              ) {
                setIngredientDetails((prev) => [...prev, ingredient]);
                foundIngredientsRef.current.add(ngram);
              }
            }
          }
        }
      }
    });
  };

  /**
   * Formats Gemini's messages to display products on separate lines.
   */
  const formatGeminiMessage = (text) => {
    // Remove the JSON part from the message
    const splitText = text.split('<JSON>');
    const messagePart = splitText[0];

    return messagePart.split('\n').map((str, idx) => <p key={idx}>{str}</p>);
  };

  /**
   * Parses the JSON ingredients list from Gemini's response.
   */
  const parseIngredientsJSON = (text) => {
    const jsonStart = text.indexOf('<JSON>');
    const jsonEnd = text.indexOf('</JSON>');

    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonString = text.substring(jsonStart + 6, jsonEnd).trim();
      try {
        const jsonData = JSON.parse(jsonString);
        return jsonData;
      } catch (error) {
        console.error('Error parsing JSON from Gemini response:', error);
      }
    }
    return null;
  };

  /**
   * Handles confirming the traits and proceeding to the next step.
   */
  const handleConfirmTraits = async () => {
    const responseText = `Based on your adjustments, here are the updated skin conditions:

- Acne: ${capitalize(selectedTraits.acne)}
- Oiliness/Dryness: ${capitalize(selectedTraits.oiliness)}
- Pigmentation: ${capitalize(selectedTraits.pigmentation)}
- Wrinkles: ${capitalize(selectedTraits.wrinkles)}

Is there any specifications before I start generating your skincare routine? Please let me know if you have any specific preferences or requirements.`;

    await displayTypingEffect(responseText);
    setConversationStep('specifications');
  };

  /**
   * Handles toggling traits based on user interaction.
   */
  const handleTraitToggle = (trait, level) => {
    setSelectedTraits((prevTraits) => ({
      ...prevTraits,
      [trait]: prevTraits[trait] === level ? 'none' : level,
    }));
  };

  /**
   * Handles clicking on an ingredient to show details.
   */
  const handleIngredientClick = (ingredient) => {
    setSelectedIngredient(ingredient);
  };

  /**
   * Closes the ingredient details modal.
   */
  const closeModal = () => {
    setSelectedIngredient(null);
  };

  /**
   * Capitalizes the first letter of a string.
   */
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  /**
   * Backend Function URL from environment variables
   */
  const BACKEND_FUNCTION_URL =
    process.env.REACT_APP_BACKEND_FUNCTION_URL ||
    'https://us-central1-calhacks-9cf7c.cloudfunctions.net/analyzeIngredientList';

  /**
   * Handles skipping the image upload and proceeding directly to trait selection.
   */
  const handleSkipUpload = () => {
    setSkinIssues('User chose to skip image upload.');
    setConversationStep('confirm');
    setIngredientDetails([]); // Reset ingredient details
    wordBufferRef.current = [];
    foundIngredientsRef.current = new Set(); // Reset found ingredients
  };

  return (
    <div className="upload-page">
      {/* Zoom Modal */}
      {isZoomed && (
        <div className="zoom-modal" onClick={() => setIsZoomed(false)}>
          <img src={displayImage} alt="Zoomed" className="zoomed-image" />
        </div>
      )}

      {/* Ingredient Details Modal */}
      {selectedIngredient && (
        <div className="ingredient-modal" onClick={closeModal}>
          <div className="ingredient-content" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedIngredient.title}</h2>
            {/* Removed Description Section */}
            {selectedIngredient.ewg && (
              <>
                <h3>EWG Decision:</h3>
                <p>{selectedIngredient.ewg.decision}</p>
              </>
            )}
            {selectedIngredient.categories && selectedIngredient.categories.trim() !== '' && (
              <>
                <h3>Categories:</h3>
                <p>{selectedIngredient.categories}</p>
              </>
            )}

            {/* Combined Properties */}
            {selectedIngredient && (
              <>
                <h3>Properties:</h3>
                <div className="properties-container">
                  {/* Boolean Properties */}
                  {selectedIngredient.boolean_properties &&
                    Object.entries(selectedIngredient.boolean_properties)
                      .filter(([key, value]) => value) // Only include properties with value true
                      .map(([key]) => (
                        <span key={key} className="property-bubble boolean-bubble">
                          {formatPropertyName(key)}
                        </span>
                      ))}

                  {/* Integer Properties */}
                  {selectedIngredient.integer_properties &&
                    Object.entries(selectedIngredient.integer_properties).map(([key, value]) => (
                      <span
                        key={key}
                        className={`property-bubble integer-bubble ${getClassForValue(value)}`}
                        title={`Rating: ${value}`}
                      >
                        {formatPropertyName(key)}
                      </span>
                    ))}
                </div>
              </>
            )}

            {/* Key for Safety Levels */}
            <h3>Key:</h3>
            <div className="key-container">
              <div className="key-item">
                <span className="safety-color-box safety-safe"></span> Safe
              </div>
              <div className="key-item">
                <span className="safety-color-box safety-lightgreen"></span> Low Hazard
              </div>
              <div className="key-item">
                <span className="safety-color-box safety-moderate"></span> Moderate Hazard
              </div>
              <div className="key-item">
                <span className="safety-color-box safety-warning"></span> Warning
              </div>
              <div className="key-item">
                <span className="safety-color-box safety-unsafe"></span> Risky
              </div>
              <div className="key-item">
                <span className="safety-color-box safety-unknown"></span> Unknown
              </div>
            </div>

            <button onClick={closeModal} className="close-modal-button">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Uploaded Image and Ingredient Sidebar */}
      <div className="image-corner">
        {displayImage && (
          <>
            <img
              src={displayImage}
              alt="Uploaded"
              className="uploaded-image-corner"
              onClick={() => setIsZoomed(true)}
            />
            {ingredientDetails.length > 0 && (
              <div className="ingredient-sidebar">
                <h3>Ingredients</h3>
                <div className="ingredient-buttons">
                  {ingredientDetails.map((ingredient, index) => (
                    <button
                      key={index}
                      className={`ingredient-button drag-in ${getSafetyClass(
                        ingredient.ewg?.decision || ''
                      )}`}
                      onClick={() => handleIngredientClick(ingredient)}
                    >
                      <span
                        className={`safety-indicator ${getSafetyClass(ingredient.ewg?.decision || '')}`}
                      ></span>
                      {ingredient.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="right-panel">
        {!skinIssues ? (
          <form onSubmit={handleUpload} className="upload-form">
            <h1 className="upload-title">Create Your Skincare Routine</h1>
            <div className="upload-section">
              <div
                className="upload-box"
                onClick={() => document.getElementById('image-input').click()}
              >
                {displayImage ? (
                  <img src={displayImage} alt="Preview" className="uploaded-image" />
                ) : (
                  <div className="placeholder-text">Click to select image</div>
                )}
                <input
                  id="image-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
            <button type="submit" className="upload-button" disabled={loading}>
              {loading ? 'Processing...' : 'Upload & Analyze'}
            </button>
            <button
              type="button"
              className="skip-button"
              onClick={handleSkipUpload}
              disabled={loading}
            >
              Skip Upload, Select Traits Directly
            </button>
          </form>
        ) : (
          <div className="chat-container">
            {conversationStep === 'confirm' && (
              <div className="traits-section">
                <h2>
                  This is what I got from your face, please edit anything that is wrong using the
                  buttons below.
                </h2>
                <div className="traits-buttons">
                  {Object.keys(TRAITS).map((trait) => (
                    <div key={trait} className="trait-group">
                      <h3>{capitalize(trait)}</h3>
                      <div className="buttons">
                        {TRAITS[trait].map((level) => (
                          <button
                            key={level}
                            className={`trait-button ${
                              selectedTraits[trait] === level ? 'active' : ''
                            }`}
                            onClick={() => handleTraitToggle(trait, level)}
                          >
                            {capitalize(level)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button className="confirm-button" onClick={handleConfirmTraits} disabled={loading}>
                  Confirm Traits
                </button>
              </div>
            )}

            {(conversationStep === 'specifications' || conversationStep === 'chat') && (
              <div className="chat-messages" ref={messagesContainerRef}>
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`chat-message ${
                      msg.sender === 'User' ? 'user-message' : 'gemini-message'
                    }`}
                  >
                    <div className="message-content">
                      <strong>{msg.sender}:</strong>{' '}
                      {msg.sender === 'Gemini' ? formatGeminiMessage(msg.text) : <p>{msg.text}</p>}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {(conversationStep === 'specifications' || conversationStep === 'chat') && (
              <form onSubmit={handleSendMessage} className="chat-input-form">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type your message..."
                  className="chat-input"
                  disabled={loading}
                  aria-label="Chat input"
                />
                <button type="submit" className="chat-send-button" disabled={loading}>
                  Send
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadPage;
