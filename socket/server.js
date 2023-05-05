var SerialPort = require("serialport");
var xbee_api = require("xbee-api");
var C = xbee_api.constants;
//var storage = require("./storage");
const handler = require("./handler/result");
const mqtt = require("mqtt");

require("dotenv").config();

const SERIAL_PORT = process.env.SERIAL_PORT;

let isActivated = false;
let hasDetectedLaser = false;
let hasDetectedSonar = false;

const baseTopic = "/alarm-iot";
const activateTopic = baseTopic + "/activate";
const alertTopic = baseTopic + "/alert";
const authTopic = baseTopic + "/authDigi";

const mqttClient = mqtt.connect("wss://test.mosquitto.org:8081");

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
  mqttClient.subscribe(activateTopic);
});

mqttClient.on("message", (topic, message) => {
  const payload = JSON.parse(message.toString());
  console.log(`Received message on ${topic}:`, payload);
  switch (topic) {
    case activateTopic:
      isActivated = payload.activate;
      if (!isActivated) hasDetectedLaser = hasDetectedSonar = false;
      const messageAct = isActivated ? "In surveillance ..." : "Stopping.";
      sendMessage(
        activateTopic + "/" + (isActivated ? "on" : "off"),
        messageAct
      );
      break;
  }
});

mqttClient.on("error", (error) => {
  console.error("MQTT error:", error);
});

function sendMessage(topic, message) {
  const payload = JSON.stringify(message);
  console.log(`--> Send message on ${topic}:`, message);
  mqttClient.publish(topic, payload);
}

var xbeeAPI = new xbee_api.XBeeAPI({
  api_mode: 2,
});

let serialport = new SerialPort(
  SERIAL_PORT,
  {
    baudRate: parseInt(process.env.SERIAL_BAUDRATE) || 9600,
  },
  function (err) {
    if (err) {
      return console.error("Error: ", err.message);
    }
  }
);

serialport.pipe(xbeeAPI.parser);
xbeeAPI.builder.pipe(serialport);

//Define the default obj to give to xbeeAPI
var frame_obj = {
  type: C.FRAME_TYPE.AT_COMMAND,
  command: "NI",
  commandParameter: [],
};

serialport.on("open", function () {
  // const PAN_ID = 5544;
  //ID -> PAN_ID

  //#region 013A20041FB76B1 -> Arduino
  frame_obj = {
    // AT Request to be sent
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB76B1",
    command: "AP",
    commandParameter: ["0"],
  };
  xbeeAPI.builder.write(frame_obj);
  //#endregion

  //#region 0013A20041FB5A5C -> Laser
  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "D0",
    commandParameter: ["2"],
  };
  xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "IC",
    commandParameter: ["1"],
  };
  xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "IR",
    commandParameter: ["1000"],
  };
  xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "AP",
    commandParameter: ["2"],
  };
  xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "KY",
    commandParameter: ["00"],
  };
  xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: "0013A20041FB5A5C",
    command: "NK",
    commandParameter: ["00"],
  };
  xbeeAPI.builder.write(frame_obj);
  //#endregion
});

// All frames parsed by the XBee will be emitted here

// storage.listSensors().then((sensors) => sensors.forEach((sensor) => console.log(sensor.data())))

function checkLaserEntry(value) {
  if (value > 500 && !hasDetectedLaser) {
    sendMessage(alertTopic, "Door is open.");
    hasDetectedLaser = true;
  }
}

let inputCode = "";
let password = process.env.PASSWORD;

function handleArduinoResult(json) {
  for (const input in json) {
    if (!json[input] || json[input] == "") continue;

    switch (input) {
      case "distance":
        if (json[input] < 30 && !hasDetectedSonar && hasDetectedLaser) {
          sendMessage(alertTopic, "Intruder is the house !!");
          hasDetectedSonar = true;
        }
        break;
      case "digicode":
        inputCode += json[input];
        if (inputCode.length == 4) {
          if (inputCode == password) {
            sendMessage(authTopic + "/correct", "Intruder deactivates alarm.");
            isActivated = hasDetectedLaser = hasDetectedSonar = false;
          } else {
            sendMessage(authTopic + "/incorrect", "Bad authenticate.");
          }
          inputCode = "";
        }
        break;
    }
  }
}

xbeeAPI.parser.on("data", function (frame) {
  if (!isActivated) return;
  //on new device is joined, register it

  //on packet received, dispatch event
  //let dataReceived = String.fromCharCode.apply(null, frame.data);

  let dataReceived;
  switch (frame.type) {
    case C.FRAME_TYPE.ZIGBEE_RECEIVE_PACKET:
      dataReceived = String.fromCharCode.apply(null, frame.data);
      console.log(">> ZIGBEE_RECEIVE_PACKET >", dataReceived);

      if (handler.isJson(dataReceived)) {
        handleArduinoResult(JSON.parse(dataReceived));
      }
      break;
    case C.FRAME_TYPE.NODE_IDENTIFICATION:
      // let dataReceived = String.fromCharCode.apply(null, frame.nodeIdentifier);
      console.log("NODE_IDENTIFICATION");
      //storage.registerSensor(frame.remote64)
      break;
    case C.FRAME_TYPE.ZIGBEE_IO_DATA_SAMPLE_RX:
      checkLaserEntry(frame.analogSamples.AD0);
      //storage.registerSample(frame.remote64,frame.analogSamples.AD0 )
      break;
    case C.FRAME_TYPE.REMOTE_COMMAND_RESPONSE:
      //console.log("REMOTE_COMMAND_RESPONSE", frame);
      break;
    default:
      console.debug(frame, "test");
      dataReceived = String.fromCharCode.apply(null, frame.commandData);
      console.log(dataReceived);
      break;
  }
});
