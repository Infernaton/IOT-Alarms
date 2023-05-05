var SerialPort = require("serialport");
var xbee_api = require("xbee-api");
var C = xbee_api.constants;
//var storage = require("./storage");
const mqtt = require("mqtt");
const handler = require("./handler/result");

require("dotenv").config();

const SERIAL_PORT = process.env.SERIAL_PORT;

let isActivated = false;

var xbeeAPI = new xbee_api.XBeeAPI({
  api_mode: 2,
});

const baseTopic = "/alarm-iot";
const activateTopic = baseTopic + "/activate";
const alertTopic = baseTopic + "/alert";
const authTopic = baseTopic + "/authDigi";

const mqttClient = mqtt.connect("wss://test.mosquitto.org:8081");

function sendMessage(topic, message) {
  const payload = JSON.stringify(message);
  console.log("Obstacle in the way !");
  console.log(`--> Send message on ${topic}:`, message);
  mqttClient.publish(topic, payload);
}

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
      const messageAct = isActivated ? "In surveil ..." : "Stopping.";
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
  if (value > 200) {
    sendMessage(alertTopic, "Obstacle in the way !");
  }
}

let inputCode = "";
let password = "1111";

function handleArduinoResult(json) {
  for (const input in json) {
    if (!json[input] || json[input] == "") continue;

    switch (input) {
      case "distance":
        if (json[input] < 30) sendMessage(alertTopic, "Obstacle in the way !");
        break;
      case "digicode":
        inputCode += json[input];
        if (inputCode.length == 4)
          if (inputCode == password) {
            sendMessage(authTopic + "/correct", "Intruder deactivates alarm.");
            isActivated = false;
          } else {
            sendMessage(authTopic + "/incorrect", "Bad authenticate.");
            inputCode = "";
          }
        break;
    }
  }
}

xbeeAPI.parser.on("data", function (frame) {
  //on new device is joined, register it

  //on packet received, dispatch event
  //let dataReceived = String.fromCharCode.apply(null, frame.data);

  let dataReceived;
  switch (frame.type) {
    case C.FRAME_TYPE.ZIGBEE_RECEIVE_PACKET:
      //Digicode
      //Expect to receive data like '{ digicode: string, distance: float }'
      //console.log("C.FRAME_TYPE.ZIGBEE_RECEIVE_PACKET");
      dataReceived = String.fromCharCode.apply(null, frame.data);
      console.log(
        ">> ZIGBEE_RECEIVE_PACKET >",
        handler.isJson(dataReceived),
        dataReceived
      );

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
      //console.log("ZIGBEE_IO_DATA_SAMPLE_RX");
      //console.log("laser isLighted:", frame.analogSamples);
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
