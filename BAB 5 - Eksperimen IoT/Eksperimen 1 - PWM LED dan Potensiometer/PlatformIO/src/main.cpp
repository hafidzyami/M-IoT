#include <Arduino.h>

const int ledPin = 5; 
const int potentioPin = 2;

// setting PWM properties
const int freq = 15000;
const int ledChannel = 5;
const int resolution = 12;

void setup(){
  Serial.begin(9600);
  // configure LED PWM functionalities
  ledcSetup(ledChannel, freq, resolution);
  // attach the channel to the GPIOto be controlled
  ledcAttachPin(ledPin, ledChannel);
}

void loop(){
   int potentioValue =  analogRead(potentioPin); 
   Serial.println(potentioValue);
   // changing the LED brightness with PWM
   ledcWrite(ledChannel, potentioValue);
   delay(15);
}

