# Final Year Project
Project Title: A sensor fusion system for maintaining zone 2 training and enhancing user motivation.

Description: The project consists of a react native/expo mobile application, multiple BLE sensors (Wahoo RPM Cadence, Garmin Chest strap and Google Pixel Watch 3) and a Fast API backend for data storage and analytics. 
The purpose of the project is to create an application that bolsters user motivation and simultaneously enhances the quality of their training via sensor fusion. 

## Setup Requirements:
   --Node.js latest
   --Android Studio latest
   --Java version 11

## Setup Instructions:
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
   - eas build --profile development --platform android
   - (if necessary)npm audit fix
   - (for starting an expo go server)npx expo start *or if there are connection issues* npx expo start --tunnel
   - If necessary create an App.tsx file 

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

## Technologies Used:

## Research Aims:

The aim of this project is to thoroughly research areas such as optimal zones for aerobic training, Modern sensor technologies used in exercise monitoring and the Influences of media on motivation. Additionally, the project aims to design a develop an exercise enhancement system that conducts a VT1 test to for calibration and utilises sensor fusion to monitor heart rate and cadence, thus allowing for the maintenance of zone 2 training at high volumes. Finally, to enhance motivation during training the project aims to integrate adaptive media controls. 

## Research Objectives:

-	Research optimal visual and aural user feedback systems.

-	Research the motivation effects of media. 

-	Research optimal sensors that are specifically used in zone 2 studies.

-	Research methods to uniquely calibrate parameters that define whether an individual is in zone 2 or not.

## Development Objectives:

-	To implement and validate a VT1 estimation test using heart rate data and the talk test.

-	To develop a system that fuses real time heart rate and cadence data from Bluetooth sensors.

-	To read and manipulate sensor data. 

-	To develop an application that provides aural and visual feedback when a user deviates from zone 2

## Desired Objectives:

-	To add gamification to exercise in order to bolster user motivation

-	To pause media based on the zone the user is currently in

-	To use CV to determine when a user is in a standing or seated position.

-	To allow the user to select zone 3 target to allow them to improve their aerobic capacity and add diversity to their training.

## License Information:
(if you're using a dataset with a licence select the same licence as that dataset)
