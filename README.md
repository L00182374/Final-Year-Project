![Expo](https://img.shields.io/badge/Expo-SDK-blue)
![React Native](https://img.shields.io/badge/React%20Native-Android-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6)
![BLE](https://img.shields.io/badge/BLE-react--native--ble--plx-green)
![Python](https://img.shields.io/badge/Python-FastAPI%20helper-yellow)
![Platform](https://img.shields.io/badge/Platform-Android-lightgrey)

# Final Year Project
Project Title: A sensor fusion system for maintaining zone 2 training and enhancing user motivation.

Description: The project consists of a react native/expo mobile application, multiple BLE sensors (Wahoo RPM Cadence, Garmin Chest strap and Google Pixel Watch 3) and a Python Media controller that controls media playback in real time based on the zone of the user. 
The purpose of the project is to create an application that bolsters user motivation and simultaneously enhances the quality of their training via sensor fusion. 

<p align="center">
  <img src="./Project%20Demonstration/Video/Final%20Year%20Project%20Video.gif" alt="Project Demo" />
</p>

## Setup Requirements:
   - Node.js latest
   - Node Package Manager latest
   - Python latest
   - Pip Latest

## Setup Instructions:
For a simple installation:
- first fork the repository.
- Open your terminal and ensure that you are in the ExerciseEnhancer directory.
- Then run **npm install** or **npm ci** to install all required Node depencies.
- Once installed type **npx expo start** / **npx expo start --tunnel** to start the development build and just scan the QR code in the APP

## Python virtual evironment and setup:
- Ensure that you are in the Python folder.
- Run **python -m venv .venv** to create a new virtual environment
- Then activate the virtual environment by running the file in **.venv\Scripts\activate**
- Then navigate to the folder containing requirements.txt and run **pip install -r requirements.txt** to install the required python libraries
- Finally run the mediaHelper script to start media playback control.

If that doesn't work

Run the following commands in your terminal/IDE:
  
   - npm install expo
   - npx create-expo-app@latest
   - npm install react-native-ble-plx
   - npm install react-native-safe-area-context
   - npm install @react-navigation/native
   - npm install @react-navigation/native-stack
   - npm install @react-native-async-storage/async-storage
   - npx expo install expo-dev-client
   - npx expo install expo-device
   - npm install -g eas-cli
   - eas login
   - eas init
   - eas build:configure(select Android)
   - npx expo install --check
   - npx expo prebuild
   - eas build --profile development --platform android
   - (if necessary)npm audit fix
   - (for starting an expo go server)npx expo start *or if there are connection issues* npx expo start --tunnel
   - If necessary create an App.tsx file
   - npm install --save-dev jest (--save-dev for installing only for development as users don't need it)

## Build/Installation Instructions:
   - npx expo prebuild
   - npx expo run:android (--device to be added if building on android device)

   For EAS
   - eas build --profile development --platform android (this has to be ran from your root or the correct folder or it will create issues)

## Usage Intructions:
   - build the apk and run it on your phone by scanning the eas qr code
   - ensure bluetooth is on
   - test the app and ensure everything is setup correctly

## Usage Examples:
  - Use the app in a Gym on a stationary bike
  - Use the app at home on a stationary bike or treadmill
  - Use the app when out for a run via HR only mode

## VsCode Extensions Used:
   - ESLint
   - Prettier
