// src/components/UploadPage.js

import React, { useState, useEffect } from 'react';
import './UploadPage.css';

// Import Firebase app and Vertex AI in Firebase SDK
import { app as firebaseApp } from '../firebase.js'; // Adjust the path as needed
import { getVertexAI, getGenerativeModel } from 'firebase/vertexai-preview';

// Import axios for API calls
import axios from 'axios';

// Initialize the Vertex AI service
const vertexAI = getVertexAI(firebaseApp);
// Initialize the generative model (ensure it's vision-capable)
const model = getGenerativeModel(vertexAI, { model: 'gemini-1.5-flash' }); // Use the same model as AttractivenessEvaluator.js

function UploadPage() {
  const [image, setImage] = useState(null); // Data URL of the image
  const [displayImage, setDisplayImage] = useState(null); // For image preview
  const [loading, setLoading] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [opencvLoaded, setOpencvLoaded] = useState(false);
  const [skinIssues, setSkinIssues] = useState('');
  const [typedText, setTypedText] = useState(''); // For typing effect
  const [typingIndex, setTypingIndex] = useState(0);
  const [productRecommendations, setProductRecommendations] = useState([]); // New state for product recommendations

  // Access Token from environment variables
  const ACCESS_TOKEN = process.env.REACT_APP_ACCESS_TOKEN;

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

  // Typing effect for Cosmily API output
  useEffect(() => {
    let typingTimer;
    if (responseText && typingIndex < responseText.length) {
      typingTimer = setTimeout(() => {
        setTypedText((prev) => prev + responseText.charAt(typingIndex));
        setTypingIndex((prev) => prev + 1);
      }, 25); // Adjusted typing speed here (faster)
    }
    return () => clearTimeout(typingTimer);
  }, [responseText, typingIndex]);

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
   * Analyzes the image using OpenCV to detect skin issues.
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
          window.cv.GaussianBlur(gray, blur, new window.cv.Size(5, 5), 0, 0, window.cv.BORDER_DEFAULT);

          // Use adaptive thresholding to find potential acne spots
          const binary = new window.cv.Mat();
          window.cv.adaptiveThreshold(
            blur,
            binary,
            255,
            window.cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            window.cv.THRESH_BINARY_INV,
            11,
            2
          );

          // Find contours (potential acne spots)
          const contours = new window.cv.MatVector();
          const hierarchy = new window.cv.Mat();
          window.cv.findContours(
            binary,
            contours,
            hierarchy,
            window.cv.RETR_CCOMP,
            window.cv.CHAIN_APPROX_SIMPLE
          );

          // Count the number of contours as an indicator
          const acneCount = contours.size();

          // Clean up
          src.delete();
          gray.delete();
          blur.delete();
          binary.delete();
          contours.delete();
          hierarchy.delete();

          let skinIssuesDescription = '';
          if (acneCount > 100) {
            skinIssuesDescription = 'significant acne detected';
          } else if (acneCount > 50) {
            skinIssuesDescription = 'moderate acne detected';
          } else if (acneCount > 20) {
            skinIssuesDescription = 'mild acne detected';
          } else {
            skinIssuesDescription = 'clear skin';
          }

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
    setResponseText(''); // Reset previous response
    setTypedText('');
    setTypingIndex(0);
    setSkinIssues('');
    setProductRecommendations([]);

    try {
      // Analyze the image with OpenCV
      const skinAnalysis = await analyzeImageWithOpenCV();
      setSkinIssues(skinAnalysis);

      // Prepare data for Cosmily API based on skin issues
      let ingredients = '';
      let ingredient_group = '';

      if (skinAnalysis.includes('acne')) {
        ingredients = 'Salicylic Acid, Benzoyl Peroxide, Tea Tree Oil';
        ingredient_group = 'acne_treatment';
      } else if (skinAnalysis.includes('clear skin')) {
        ingredients = 'Hyaluronic Acid, Vitamin C, Niacinamide';
        ingredient_group = 'hydration_and_brightening';
      } else {
        ingredients = 'Retinol, Glycolic Acid, Lactic Acid';
        ingredient_group = 'anti-aging';
      }

      // **Updated Axios Call to Match the Exact cURL Statement**

      const cosmilyResponse = await axios({
        method: 'post',
        url: 'https://api.cosmily.com/api/v1/analyze/ingredient_list',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`, // Exact header as per cURL
          'Content-Type': 'application/json', // Exact header as per cURL
        },
        data: JSON.stringify({
          ingredients: ingredients,
          ingredient_group: ingredient_group,
        }), // Ensure the payload is a JSON string
      });

      // **Alternative Approach Using axios.post (Equivalent to Above)**
      /*
      const cosmilyResponse = await axios.post(
        'https://api.cosmily.com/api/v1/analyze/ingredient_list',
        {
          ingredients: ingredients,
          ingredient_group: ingredient_group,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }
      );
      */

      // Extract product recommendations from the response
      if (cosmilyResponse.status === 201 && cosmilyResponse.data.analysis) {
        const analysis = cosmilyResponse.data.analysis;
        const positiveEffects = analysis.positive;
        const recommendations = [];

        // Collect positive effect ingredients
        for (const effect in positiveEffects) {
          const effectData = positiveEffects[effect];
          effectData.list.forEach((item) => {
            recommendations.push(item.title);
          });
        }

        // Remove duplicates
        const uniqueRecommendations = [...new Set(recommendations)];
        setProductRecommendations(uniqueRecommendations);

        // Prepare the response text
        const response = `Based on your skin analysis (${skinAnalysis}), we recommend the following ingredients:\n\n${uniqueRecommendations.join(
          ', '
        )}\n\nConsider products containing these ingredients for better results.`;

        setResponseText(response);
      } else {
        console.error('Unexpected response from Cosmily API:', cosmilyResponse);
        setResponseText('Unable to retrieve product recommendations at this time.');
      }
    } catch (error) {
      console.error('Error:', error);
      // Check if the error response exists and provide more detailed messages
      if (error.response) {
        // Server responded with a status other than 2xx
        alert(`Error: ${error.response.status} - ${error.response.data.message || error.message}`);
      } else if (error.request) {
        // Request was made but no response received
        alert('Error: No response received from Cosmily API.');
      } else {
        // Something else happened
        alert(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-page">
      <h1 className="upload-title">Upload Your Front Profile Image</h1>
      {!loading ? (
        <form onSubmit={handleUpload} className="upload-form">
          <div className="upload-section">
            <div
              className="upload-box"
              onClick={() => document.getElementById('image-input').click()}
            >
              {displayImage ? (
                <img
                  src={displayImage}
                  alt="Preview"
                  className="uploaded-image"
                />
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
          <button type="submit" className="upload-button">
            Upload & Analyze
          </button>
        </form>
      ) : (
        <div className="loading-spinner">
          <p>Processing your image...</p>
        </div>
      )}
      {skinIssues && (
        <div className="analysis-section">
          <h2>Skin Analysis:</h2>
          <p>{skinIssues}</p>
        </div>
      )}
      {typedText && (
        <div className="response-section">
          <h2>Product Recommendations:</h2>
          <p className="typed-text">{typedText}</p>
        </div>
      )}
      {productRecommendations.length > 0 && (
        <div className="recommendations-section">
          <h2>Recommended Products:</h2>
          <ul>
            {productRecommendations.map((product, index) => (
              <li key={index}>{product}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default UploadPage;
