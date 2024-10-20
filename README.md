# FaceAI Skincare Assistant

Let AI guide you through personalized skincare, ingredient insights, and the complexities of the beauty industry.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Live Demo](#live-demo)
- [Installation](#installation)
- [Usage](#usage)
- [Technologies Used](#technologies-used)
- [Contact](#contact)

## Introduction

AI Skincare Consultant is a web application designed to simplify and personalize the skincare journey. By uploading a selfie, users can receive an analysis of their skin, identifying issues such as acne, oiliness, pigmentation, and wrinkles. The application then generates personalized skincare routines tailored to the user's unique skin profile, complete with product recommendations and detailed ingredient insights. Additionally, users can interact with the AI assistant to refine their preferences and gain in-depth knowledge about skincare ingredients, learning about the ingredients' usage and safety, ensuring informed and effective skincare choices.

## Features

- **Image Analysis**: Upload a selfie to get a comprehensive analysis of your skin, including acne detection, oiliness/dryness levels, pigmentation assessment, and wrinkle identification using OpenCV.js.
- **Personalized Skincare Routines**: Receive AI-generated skincare routines tailored to your specific skin needs.
- **Ingredient Insights**: Explore detailed information about recommended skincare ingredients, including benefits and safety ratings based on EWG (Environmental Working Group) data.
- **Interactive Chat Interface**: Engage with the AI assistant to refine your skincare routine preferences and specifications.
- **Ingredient Details Modal**: Click on any ingredient to view in-depth details, including properties and safety information.
- **Responsive Design**: Accessible and user-friendly across various devices and screen sizes.

## Live Demo

Experience the application in action without any setup [here](#).

## Installation

To run FaceAI Skincare Assistant locally, follow these steps:

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/faceai-skincare-assistant.git
cd faceai-skincare-assistant

2. Install Dependencies
Ensure you have Node.js installed. Then, install the required packages:
npm install

4. Start the Application
npm start
The application will run in development mode. Open http://localhost:3000 to view it in your browser.

Usage
1. Upload Your Image
Click on the upload box to select a selfie from your device.

2. Review Skin Analysis
The AI will display detected skin conditions such as acne severity, oiliness, pigmentation, and wrinkles.

3. Confirm Traits
After reviewing, click "Confirm Traits" to proceed.

4. Specify Preferences
Provide any additional specifications or preferences for your skincare routine.

5. Receive Personalized Routine
The AI will generate a detailed skincare routine tailored to your needs, including product recommendations and ingredient insights.

6. Explore Ingredients
Click on any ingredient in the sidebar to view detailed information about its properties and safety ratings.

Technologies Used
Frontend:
- React
- OpenCV.js
- Firebase
- Vertex AI
- Axios

Backend:
- Firebase Cloud Functions
- Gemini AI Model

Others:
- CSS3
- HTML5

Contact
For any inquiries or feedback, please reach out to:

Email: harry_yuan@berkeley.edu